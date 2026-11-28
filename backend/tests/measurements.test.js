const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

process.env.JWT_SECRET = 'measurement-tests-only-secret';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const OPERATOR_ID = '22222222-2222-4222-8222-222222222222';
const STATION_AIR = '33333333-3333-4333-8333-333333333333';
const STATION_WATER = '44444444-4444-4444-8444-444444444444';
const STATION_UNASSIGNED = '55555555-5555-4555-8555-555555555555';
const STATION_INACTIVE = '66666666-6666-4666-8666-666666666666';
const STATION_ENDED_ASSIGNMENT = '88888888-8888-4888-8888-888888888888';
const PARAM_PM25 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PARAM_PH = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PARAM_INACTIVE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const users = new Map([
  [ADMIN_ID, { id: ADMIN_ID, fullname: 'Admin', email: 'admin@test.invalid', isactive: true, userroles: [{ role: { name: 'ADMIN' } }] }],
  [OPERATOR_ID, { id: OPERATOR_ID, fullname: 'Operator', email: 'operator@test.invalid', isactive: true, userroles: [{ role: { name: 'OPERATOR' } }] }],
]);
const stations = new Map([
  [STATION_AIR, { id: STATION_AIR, name: 'Air station', stationtype: 'AIR', status: 'ACTIVE' }],
  [STATION_WATER, { id: STATION_WATER, name: 'Water station', stationtype: 'WATER', status: 'ACTIVE' }],
  [STATION_UNASSIGNED, { id: STATION_UNASSIGNED, name: 'Unassigned station', stationtype: 'BOTH', status: 'ACTIVE' }],
  [STATION_INACTIVE, { id: STATION_INACTIVE, name: 'Inactive station', stationtype: 'AIR', status: 'INACTIVE' }],
  [STATION_ENDED_ASSIGNMENT, { id: STATION_ENDED_ASSIGNMENT, name: 'Previously assigned station', stationtype: 'AIR', status: 'ACTIVE' }],
]);
const parameters = [
  { id: PARAM_PM25, code: 'pm25', name: 'PM2.5', domain: 'AIR', isactive: true, units: { symbol: 'µg/m³' } },
  { id: PARAM_PH, code: 'ph', name: 'pH', domain: 'WATER', isactive: true, units: { symbol: 'pH' } },
  { id: PARAM_INACTIVE, code: 'inactive_param', name: 'Inactive', domain: 'AIR', isactive: false, units: { symbol: 'x' } },
];
const assignments = [
  { userid: OPERATOR_ID, stationid: STATION_AIR, endedat: null },
  { userid: OPERATOR_ID, stationid: STATION_WATER, endedat: null },
  { userid: OPERATOR_ID, stationid: STATION_ENDED_ASSIGNMENT, endedat: new Date('2026-11-01T00:00:00.000Z') },
];
const records = [];
let lastFindManyArgs;
let lastRecentArgs;
let lastCreateArgs;
let createError = null;
let recentError = null;

function hydrate(record) {
  return {
    ...record,
    stations: stations.get(record.stationid),
    parameters: parameters.find((parameter) => parameter.id === record.parameterid),
    indexresultmeasurements: record.indexresultmeasurements || [],
  };
}

const prismaMock = {
  user: { async findUnique({ where }) { return users.get(where.id) || null; } },
  monitoringstation: { async findUnique({ where }) { return stations.get(where.id) || null; } },
  stationAssignment: {
    async findFirst({ where }) {
      return assignments.find((assignment) => assignment.userid === where.userid && assignment.stationid === where.stationid && assignment.endedat === null) || null;
    },
  },
  parameter: {
    async findFirst({ where }) {
      return parameters.find((parameter) => where.OR.some((condition) =>
        condition.id ? parameter.id === condition.id : parameter.code.toLowerCase() === condition.code.equals.toLowerCase()
      )) || null;
    },
  },
  measurement: {
    async create(args) {
      lastCreateArgs = args;
      if (createError) throw createError;
      const record = { id: `measurement-${records.length + 1}`, source: 'MANUAL', validationstatus: 'ACCEPTED', ...args.data };
      records.unshift(record);
      return hydrate(record);
    },
    async findMany(args) {
      const isRecentQuery = !Object.hasOwn(args.where, 'stationid');
      if (isRecentQuery) lastRecentArgs = args;
      else lastFindManyArgs = args;
      if (isRecentQuery && recentError) throw recentError;
      const assignmentFilter = args.where.stations?.is?.stationassignments?.some;
      return records.filter((record) => {
        const station = stations.get(record.stationid);
        const parameter = parameters.find((entry) => entry.id === record.parameterid);
        return (!args.where.stationid || record.stationid === args.where.stationid) &&
          (!args.where.parameters?.is?.domain || parameter?.domain === args.where.parameters.is.domain) &&
          (!args.where.validationstatus || record.validationstatus === args.where.validationstatus) &&
          (!args.where.parameterid || record.parameterid === args.where.parameterid) &&
          (!args.where.measuredat?.gte || record.measuredat >= args.where.measuredat.gte) &&
          (!args.where.measuredat?.lte || record.measuredat <= args.where.measuredat.lte) &&
          (!assignmentFilter || assignments.some((assignment) =>
            assignment.userid === assignmentFilter.userid &&
            assignment.endedat === assignmentFilter.endedat &&
            assignment.stationid === record.stationid
          )) && Boolean(station);
      }).sort((a, b) => {
        const orderBy = args.orderBy || [{ measuredat: 'desc' }];
        for (const order of Array.isArray(orderBy) ? orderBy : [orderBy]) {
          const [field, direction] = Object.entries(order)[0];
          const difference = new Date(a[field] || 0) - new Date(b[field] || 0);
          if (difference) return direction === 'desc' ? -difference : difference;
        }
        return 0;
      }).slice(args.skip || 0, (args.skip || 0) + args.take).map(hydrate);
    },
  },
};

const configPath = require.resolve('../config');
require.cache[configPath] = { id: configPath, filename: configPath, loaded: true, exports: prismaMock };
const app = express();
app.use(express.json());
app.use('/api/air', require('../routes/air'));
app.use('/api/water', require('../routes/water'));
app.use('/api/measurements', require('../routes/measurements'));

function authToken(userId) {
  return `Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' })}`;
}
const admin = authToken(ADMIN_ID);
const operator = authToken(OPERATOR_ID);

async function run() {
  const genericAir = await request(app).post('/api/measurements').set('Authorization', operator).send({
    stationId: STATION_AIR, stationName: 'untrusted name', parameter: 'pm25', value: '8.4', recordedAt: '2026-03-04T05:06:07.000Z',
  });
  assert.equal(genericAir.status, 201);
  assert.equal(genericAir.body.stationName, 'Air station');
  assert.equal(genericAir.body.parameter, 'pm25');
  assert.equal(lastCreateArgs.data.recordedbyuserid, OPERATOR_ID);
  assert.equal(lastCreateArgs.data.source, 'MANUAL');
  assert.equal(lastCreateArgs.data.validationstatus, 'ACCEPTED');

  const genericWater = await request(app).post('/api/measurements').set('Authorization', admin).send({
    stationId: STATION_WATER, parameter: 'ph', value: 7.1, recordedAt: '2026-03-04T05:06:07.000Z', domain: 'WATER',
  });
  assert.equal(genericWater.status, 201);
  assert.equal(genericWater.body.parameter, 'ph');
  assert.equal(lastCreateArgs.data.parameterid, PARAM_PH);

  const genericWrongDomain = await request(app).post('/api/measurements').set('Authorization', admin).send({
    stationId: STATION_AIR, parameter: 'ph', value: 7, recordedAt: '2026-03-04T05:06:07.000Z', domain: 'AIR',
  });
  assert.equal(genericWrongDomain.status, 400);
  const genericBadDomain = await request(app).post('/api/measurements').set('Authorization', admin).send({
    stationId: STATION_AIR, parameter: 'pm25', value: 7, recordedAt: '2026-03-04T05:06:07.000Z', domain: 'GAS',
  });
  assert.equal(genericBadDomain.status, 400);
  const genericInvalidParameter = await request(app).post('/api/measurements').set('Authorization', admin).send({
    stationId: STATION_AIR, parameter: 'missing', value: 7, recordedAt: '2026-03-04T05:06:07.000Z',
  });
  assert.equal(genericInvalidParameter.status, 400);
  const genericInactiveParameter = await request(app).post('/api/measurements').set('Authorization', admin).send({
    stationId: STATION_AIR, parameter: 'inactive_param', value: 7, recordedAt: '2026-03-04T05:06:07.000Z',
  });
  assert.equal(genericInactiveParameter.status, 400);
  const genericMissingStation = await request(app).post('/api/measurements').set('Authorization', admin).send({
    stationId: '77777777-7777-4777-8777-777777777777', parameter: 'pm25', value: 7, recordedAt: '2026-03-04T05:06:07.000Z',
  });
  assert.equal(genericMissingStation.status, 404);
  const genericInactiveStation = await request(app).post('/api/measurements').set('Authorization', admin).send({
    stationId: STATION_INACTIVE, parameter: 'pm25', value: 7, recordedAt: '2026-03-04T05:06:07.000Z',
  });
  assert.equal(genericInactiveStation.status, 409);
  const genericUnassigned = await request(app).post('/api/measurements').set('Authorization', operator).send({
    stationId: STATION_UNASSIGNED, parameter: 'pm25', value: 7, recordedAt: '2026-03-04T05:06:07.000Z',
  });
  assert.equal(genericUnassigned.status, 403);
  const genericMissingFields = await request(app).post('/api/measurements').set('Authorization', admin).send({ stationId: STATION_AIR });
  assert.equal(genericMissingFields.status, 400);
  const genericInvalidValue = await request(app).post('/api/measurements').set('Authorization', admin).send({
    stationId: STATION_AIR, parameter: 'pm25', value: 'Infinity', recordedAt: '2026-03-04T05:06:07.000Z',
  });
  assert.equal(genericInvalidValue.status, 400);
  const genericFutureDate = await request(app).post('/api/measurements').set('Authorization', admin).send({
    stationId: STATION_AIR, parameter: 'pm25', value: 7, recordedAt: new Date(Date.now() + 120_000).toISOString(),
  });
  assert.equal(genericFutureDate.status, 400);
  const genericUnauthenticated = await request(app).post('/api/measurements').send({});
  assert.equal(genericUnauthenticated.status, 401);
  createError = new Error('mock database failure');
  const databaseFailure = await request(app).post('/api/measurements').set('Authorization', admin).send({
    stationId: STATION_AIR, parameter: 'pm25', value: 7, recordedAt: '2026-03-04T05:06:07.000Z',
  });
  assert.equal(databaseFailure.status, 500);
  createError = null;

  const airCreated = await request(app).post(`/api/air/stations/${STATION_AIR}`).set('Authorization', operator).send({
    timestamp: '2026-02-03T04:05:06.000Z', parameter: 'PM25', value: '12.5',
  });
  assert.equal(airCreated.status, 201);
  assert.equal(airCreated.body.parameter, 'pm25');
  assert.equal(airCreated.body.stationId, STATION_AIR);
  assert.equal(airCreated.body.value, 12.5);
  assert.equal(airCreated.body.unit, 'µg/m³');
  assert.equal(airCreated.body.aqi, null);
  assert.equal(lastCreateArgs.data.stationid, STATION_AIR);
  assert.equal(lastCreateArgs.data.parameterid, PARAM_PM25);
  assert.equal(lastCreateArgs.data.recordedbyuserid, OPERATOR_ID);
  assert.equal(lastCreateArgs.data.source, 'MANUAL');
  assert.ok(lastCreateArgs.data.measuredat instanceof Date);

  const waterCreated = await request(app).post(`/api/water/stations/${STATION_WATER}`).set('Authorization', admin).send({
    recordedAt: '2026-02-03T04:05:06.000Z', parameter: 'ph', value: 7.2,
  });
  assert.equal(waterCreated.status, 201);
  assert.equal(waterCreated.body.parameter, 'ph');
  assert.equal(waterCreated.body.wqi, null);
  assert.equal(lastCreateArgs.data.parameterid, PARAM_PH);

  const wrongDomain = await request(app).post(`/api/air/stations/${STATION_AIR}`).set('Authorization', admin).send({ timestamp: new Date().toISOString(), parameter: 'ph', value: 7 });
  assert.equal(wrongDomain.status, 400);
  const invalidStation = await request(app).post('/api/air/stations/not-a-uuid').set('Authorization', admin).send({ timestamp: new Date().toISOString(), parameter: 'pm25', value: 1 });
  assert.equal(invalidStation.status, 400);
  const missingStation = await request(app).post('/api/air/stations/77777777-7777-4777-8777-777777777777').set('Authorization', admin).send({ timestamp: new Date().toISOString(), parameter: 'pm25', value: 1 });
  assert.equal(missingStation.status, 404);
  const incompatibleStation = await request(app).post(`/api/air/stations/${STATION_WATER}`).set('Authorization', admin).send({ timestamp: new Date().toISOString(), parameter: 'pm25', value: 1 });
  assert.equal(incompatibleStation.status, 400);
  const invalidDate = await request(app).post(`/api/water/stations/${STATION_WATER}`).set('Authorization', admin).send({ timestamp: 'not-a-date', parameter: 'ph', value: 7 });
  assert.equal(invalidDate.status, 400);
  const invalidValue = await request(app).post(`/api/air/stations/${STATION_AIR}`).set('Authorization', admin).send({ timestamp: new Date().toISOString(), parameter: 'pm25', value: 'NaN' });
  assert.equal(invalidValue.status, 400);

  const forbidden = await request(app).post(`/api/air/stations/${STATION_UNASSIGNED}`).set('Authorization', operator).send({ timestamp: new Date().toISOString(), parameter: 'pm25', value: 2 });
  assert.equal(forbidden.status, 403);
  const forbiddenRead = await request(app).get(`/api/air/stations/${STATION_UNASSIGNED}`).set('Authorization', operator);
  assert.equal(forbiddenRead.status, 403);

  records[0].indexresultmeasurements = [{ indexresults: { value: 42, category: 'GOOD', methodversions: { indextype: 'WQI' } } }];
  const history = await request(app).get(`/api/water/history?stationId=${STATION_WATER}&limit=10&from=2026-02-03T04:05:06.000Z&to=2026-02-03T04:05:06.000Z`).set('Authorization', operator);
  assert.equal(history.status, 200);
  assert.equal(history.body.length, 1);
  assert.equal(history.body[0].ph, 7.2);
  assert.equal(history.body[0].wqi, 42);
  assert.equal(lastFindManyArgs.take, 10);
  assert.equal(lastFindManyArgs.where.parameters.is.domain, 'WATER');
  assert.equal(lastFindManyArgs.where.validationstatus, 'ACCEPTED');

  const badPagination = await request(app).get(`/api/air/history?stationId=${STATION_AIR}&page=0`).set('Authorization', admin);
  assert.equal(badPagination.status, 400);
  const badDates = await request(app).get(`/api/air/history?stationId=${STATION_AIR}&from=invalid`).set('Authorization', admin);
  assert.equal(badDates.status, 400);
  const latest = await request(app).get(`/api/air/latest?stationId=${STATION_AIR}`).set('Authorization', operator);
  assert.equal(latest.status, 200);
  assert.equal(latest.body.pm25, 8.4);
  records.find((record) => record.stationid === STATION_AIR).indexresultmeasurements = [{ indexresults: { value: 64, category: 'MODERATE', methodversions: { indextype: 'AQI' } } }];
  const latestWithIndex = await request(app).get(`/api/air/latest?stationId=${STATION_AIR}`).set('Authorization', operator);
  assert.equal(latestWithIndex.body.aqi, 64);
  assert.equal(latestWithIndex.body.aqiCategory, 'MODERATE');

  const statusRows = [
    { id: 'air-accepted', stationid: STATION_AIR, parameterid: PARAM_PM25, value: 101, measuredat: new Date('2026-02-04T00:00:00.000Z'), source: 'SENSOR', validationstatus: 'ACCEPTED' },
    { id: 'air-flagged', stationid: STATION_AIR, parameterid: PARAM_PM25, value: 102, measuredat: new Date('2026-02-04T00:01:00.000Z'), source: 'SENSOR', validationstatus: 'FLAGGED' },
    { id: 'air-rejected', stationid: STATION_AIR, parameterid: PARAM_PM25, value: 103, measuredat: new Date('2026-02-04T00:02:00.000Z'), source: 'SENSOR', validationstatus: 'REJECTED' },
    { id: 'water-accepted', stationid: STATION_WATER, parameterid: PARAM_PH, value: 201, measuredat: new Date('2026-02-04T00:00:00.000Z'), source: 'SENSOR', validationstatus: 'ACCEPTED' },
    { id: 'water-flagged', stationid: STATION_WATER, parameterid: PARAM_PH, value: 202, measuredat: new Date('2026-02-04T00:01:00.000Z'), source: 'SENSOR', validationstatus: 'FLAGGED' },
    { id: 'water-rejected', stationid: STATION_WATER, parameterid: PARAM_PH, value: 203, measuredat: new Date('2026-02-04T00:02:00.000Z'), source: 'SENSOR', validationstatus: 'REJECTED' },
  ];
  records.push(...statusRows);

  for (const { domain, stationId, parameter, acceptedValue } of [
    { domain: 'air', stationId: STATION_AIR, parameter: 'pm25', acceptedValue: 101 },
    { domain: 'water', stationId: STATION_WATER, parameter: 'ph', acceptedValue: 201 },
  ]) {
    for (const historyPath of [
      `/api/${domain}/history?stationId=${stationId}&from=2026-02-04T00:00:00.000Z&to=2026-02-04T00:03:00.000Z&validationStatus=FLAGGED`,
      `/api/${domain}/stations/${stationId}?from=2026-02-04T00:00:00.000Z&to=2026-02-04T00:03:00.000Z&parameter=${parameter}`,
    ]) {
      const acceptedOnlyHistory = await request(app)
        .get(historyPath)
        .set('Authorization', operator);
      assert.equal(acceptedOnlyHistory.status, 200);
      assert.equal(lastFindManyArgs.where.validationstatus, 'ACCEPTED');
      assert.equal(lastFindManyArgs.where.parameters.is.domain, domain.toUpperCase());
      assert.deepEqual(acceptedOnlyHistory.body.map((row) => row[parameter]), [acceptedValue]);
      assert.ok(acceptedOnlyHistory.body[0].id);
      assert.equal(acceptedOnlyHistory.body[0].stationId, stationId);
      assert.ok(acceptedOnlyHistory.body[0].recordedAt);
    }

    for (const latestPath of [
      `/api/${domain}/latest?stationId=${stationId}&from=2026-02-04T00:00:00.000Z&to=2026-02-04T00:03:00.000Z&validationStatus=REJECTED`,
      `/api/${domain}/stations/${stationId}/latest?from=2026-02-04T00:00:00.000Z&to=2026-02-04T00:03:00.000Z`,
    ]) {
      const acceptedOnlyLatest = await request(app)
        .get(latestPath)
        .set('Authorization', admin);
      assert.equal(acceptedOnlyLatest.status, 200);
      assert.equal(lastFindManyArgs.where.validationstatus, 'ACCEPTED');
      assert.equal(lastFindManyArgs.where.parameters.is.domain, domain.toUpperCase());
      assert.equal(acceptedOnlyLatest.body[parameter], acceptedValue);
      assert.equal(acceptedOnlyLatest.body.stationId, stationId);
    }

    const nonAcceptedWindowHistory = await request(app)
      .get(`/api/${domain}/history?stationId=${stationId}&from=2026-02-04T00:01:00.000Z&to=2026-02-04T00:03:00.000Z`)
      .set('Authorization', admin);
    assert.equal(nonAcceptedWindowHistory.status, 200);
    assert.equal(lastFindManyArgs.where.validationstatus, 'ACCEPTED');
    assert.deepEqual(nonAcceptedWindowHistory.body, []);

    const nonAcceptedWindowLatest = await request(app)
      .get(`/api/${domain}/latest?stationId=${stationId}&from=2026-02-04T00:01:00.000Z&to=2026-02-04T00:03:00.000Z`)
      .set('Authorization', admin);
    assert.equal(nonAcceptedWindowLatest.status, 200);
    assert.equal(lastFindManyArgs.where.validationstatus, 'ACCEPTED');
    assert.equal(nonAcceptedWindowLatest.body, null);
  }

  const unauthHistory = await request(app).get(`/api/air/history?stationId=${STATION_AIR}`);
  assert.equal(unauthHistory.status, 401);
  const unassignedHistory = await request(app).get(`/api/water/history?stationId=${STATION_UNASSIGNED}`).set('Authorization', operator);
  assert.equal(unassignedHistory.status, 403);
  const unassignedLatest = await request(app).get(`/api/air/stations/${STATION_UNASSIGNED}/latest`).set('Authorization', operator);
  assert.equal(unassignedLatest.status, 403);

  const firstPage = await request(app)
    .get(`/api/air/history?stationId=${STATION_AIR}&from=2026-02-04T00:00:00.000Z&to=2026-02-04T00:03:00.000Z&parameter=pm25&limit=1&page=1`)
    .set('Authorization', admin);
  assert.equal(firstPage.status, 200);
  assert.equal(lastFindManyArgs.where.validationstatus, 'ACCEPTED');
  assert.equal(lastFindManyArgs.where.parameterid, PARAM_PM25);
  assert.equal(lastFindManyArgs.skip, 0);
  assert.equal(lastFindManyArgs.take, 1);
  assert.deepEqual(firstPage.body.map((row) => row.pm25), [101]);

  const paginatedHistory = await request(app)
    .get(`/api/air/history?stationId=${STATION_AIR}&from=2026-02-04T00:00:00.000Z&to=2026-02-04T00:03:00.000Z&parameter=pm25&limit=1&page=2`)
    .set('Authorization', admin);
  assert.equal(paginatedHistory.status, 200);
  assert.deepEqual(paginatedHistory.body, []);
  assert.equal(lastFindManyArgs.skip, 1);
  assert.equal(lastFindManyArgs.take, 1);

  assert.deepEqual(
    records.filter((row) => row.validationstatus !== 'ACCEPTED').map((row) => [row.id, row.validationstatus]),
    [
      ['air-flagged', 'FLAGGED'],
      ['air-rejected', 'REJECTED'],
      ['water-flagged', 'FLAGGED'],
      ['water-rejected', 'REJECTED'],
    ]
  );

  const recentRows = [
    { id: 'recent-air-manual', stationid: STATION_AIR, parameterid: PARAM_PM25, value: '35.5', measuredat: new Date('2026-11-28T10:00:00.000Z'), createdat: new Date('2026-11-28T10:00:02.000Z'), source: 'MANUAL', validationstatus: 'ACCEPTED' },
    { id: 'recent-water-sensor', stationid: STATION_WATER, parameterid: PARAM_PH, value: '7.2', measuredat: new Date('2026-11-28T10:00:00.000Z'), createdat: new Date('2026-11-28T10:00:03.000Z'), source: 'SENSOR', validationstatus: 'ACCEPTED' },
    { id: 'recent-air-csv', stationid: STATION_AIR, parameterid: PARAM_PM25, value: '36.5', measuredat: new Date('2026-11-28T10:00:00.000Z'), createdat: new Date('2026-11-28T10:00:04.000Z'), source: 'CSV', validationstatus: 'ACCEPTED' },
    { id: 'recent-water-api', stationid: STATION_WATER, parameterid: PARAM_PH, value: '7.1', measuredat: new Date('2026-11-28T09:00:00.000Z'), createdat: new Date('2026-11-28T09:00:01.000Z'), source: 'API', validationstatus: 'ACCEPTED' },
    { id: 'recent-unassigned', stationid: STATION_UNASSIGNED, parameterid: PARAM_PM25, value: 20, measuredat: new Date('2026-11-28T08:00:00.000Z'), createdat: new Date('2026-11-28T08:00:01.000Z'), source: 'SENSOR', validationstatus: 'ACCEPTED' },
    { id: 'recent-ended-assignment', stationid: STATION_ENDED_ASSIGNMENT, parameterid: PARAM_PM25, value: 21, measuredat: new Date('2026-11-28T07:00:00.000Z'), createdat: new Date('2026-11-28T07:00:01.000Z'), source: 'MANUAL', validationstatus: 'ACCEPTED' },
    { id: 'recent-flagged', stationid: STATION_AIR, parameterid: PARAM_PM25, value: 999, measuredat: new Date('2026-11-28T12:00:00.000Z'), createdat: new Date('2026-11-28T12:00:01.000Z'), source: 'SENSOR', validationstatus: 'FLAGGED' },
    { id: 'recent-rejected', stationid: STATION_WATER, parameterid: PARAM_PH, value: 999, measuredat: new Date('2026-11-28T13:00:00.000Z'), createdat: new Date('2026-11-28T13:00:01.000Z'), source: 'CSV', validationstatus: 'REJECTED' },
  ];
  records.push(...recentRows);

  const recentDefault = await request(app).get('/api/measurements/recent').set('Authorization', admin);
  assert.equal(recentDefault.status, 200);
  assert.equal(lastRecentArgs.take, 15);
  assert.deepEqual(lastRecentArgs.where, { validationstatus: 'ACCEPTED' });
  assert.deepEqual(lastRecentArgs.include, {
    stations: true,
    parameters: { include: { units: true } },
  });
  assert.deepEqual(lastRecentArgs.orderBy, [{ measuredat: 'desc' }, { createdat: 'desc' }]);
  assert.ok(recentDefault.body.some((row) => row.domain === 'AIR'));
  assert.ok(recentDefault.body.some((row) => row.domain === 'WATER'));
  assert.ok(recentDefault.body.some((row) => row.id === 'recent-unassigned'));
  assert.ok(recentDefault.body.some((row) => row.id === 'recent-ended-assignment'));
  assert.ok(!recentDefault.body.some((row) => ['recent-flagged', 'recent-rejected'].includes(row.id)));

  const limitedRecent = await request(app).get('/api/measurements/recent?limit=2').set('Authorization', admin);
  assert.equal(limitedRecent.status, 200);
  assert.equal(lastRecentArgs.take, 2);
  assert.deepEqual(limitedRecent.body.map((row) => row.id), ['recent-air-csv', 'recent-water-sensor']);
  const newestFirstRecent = await request(app).get('/api/measurements/recent?limit=4').set('Authorization', admin);
  assert.deepEqual(newestFirstRecent.body.map((row) => row.id), [
    'recent-air-csv', 'recent-water-sensor', 'recent-air-manual', 'recent-water-api',
  ]);

  const responseRow = recentDefault.body.find((row) => row.id === 'recent-air-manual');
  assert.deepEqual(responseRow, {
    id: 'recent-air-manual',
    stationId: STATION_AIR,
    stationName: 'Air station',
    stationType: 'AIR',
    domain: 'AIR',
    parameter: 'pm25',
    parameterId: PARAM_PM25,
    parameterName: 'PM2.5',
    value: 35.5,
    unit: 'µg/m³',
    recordedAt: '2026-11-28T10:00:00.000Z',
    source: 'MANUAL',
    validationStatus: 'ACCEPTED',
    status: 'VALIDATED',
  });
  assert.ok(Number.isFinite(responseRow.value));
  assert.equal(new Date(responseRow.recordedAt).toISOString(), responseRow.recordedAt);
  assert.deepEqual(
    recentDefault.body.filter((row) => row.id.startsWith('recent-')).map((row) => row.source).sort(),
    ['API', 'CSV', 'MANUAL', 'MANUAL', 'SENSOR', 'SENSOR'].sort()
  );

  const statusOverride = await request(app)
    .get('/api/measurements/recent?limit=100&validationstatus=FLAGGED&status=REJECTED')
    .set('Authorization', admin);
  assert.equal(statusOverride.status, 200);
  assert.deepEqual(lastRecentArgs.where, { validationstatus: 'ACCEPTED' });
  assert.ok(statusOverride.body.every((row) => row.validationStatus === 'ACCEPTED'));

  const operatorRecent = await request(app).get('/api/measurements/recent?limit=100').set('Authorization', operator);
  assert.equal(operatorRecent.status, 200);
  assert.deepEqual(lastRecentArgs.where, {
    validationstatus: 'ACCEPTED',
    stations: { is: { stationassignments: { some: { userid: OPERATOR_ID, endedat: null } } } },
  });
  assert.ok(operatorRecent.body.some((row) => row.id === 'recent-air-manual'));
  assert.ok(operatorRecent.body.some((row) => row.id === 'recent-water-sensor'));
  assert.ok(!operatorRecent.body.some((row) => ['recent-unassigned', 'recent-ended-assignment'].includes(row.id)));

  const invalidTokenRecent = await request(app).get('/api/measurements/recent').set('Authorization', 'Bearer invalid-token');
  assert.equal(invalidTokenRecent.status, 401);
  const unauthenticatedRecent = await request(app).get('/api/measurements/recent');
  assert.equal(unauthenticatedRecent.status, 401);
  for (const invalidLimit of ['0', '-1', '1.5', 'not-a-number', '', '101']) {
    const invalidRecent = await request(app)
      .get(`/api/measurements/recent?limit=${encodeURIComponent(invalidLimit)}`)
      .set('Authorization', admin);
    assert.equal(invalidRecent.status, 400, `limit ${JSON.stringify(invalidLimit)} should be rejected`);
    assert.deepEqual(invalidRecent.body, { error: 'Limit must be an integer between 1 and 100' });
  }

  const savedRecords = records.splice(0, records.length);
  const emptyRecent = await request(app).get('/api/measurements/recent').set('Authorization', admin);
  assert.equal(emptyRecent.status, 200);
  assert.deepEqual(emptyRecent.body, []);
  records.push(...savedRecords);

  recentError = new Error('internal mocked Prisma failure');
  const failedRecent = await request(app).get('/api/measurements/recent').set('Authorization', admin);
  assert.equal(failedRecent.status, 500);
  assert.deepEqual(failedRecent.body, { error: 'Unable to load recent measurements' });
  recentError = null;

  console.log('Measurement route tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
