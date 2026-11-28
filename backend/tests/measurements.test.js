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
]);
const parameters = [
  { id: PARAM_PM25, code: 'pm25', name: 'PM2.5', domain: 'AIR', isactive: true, units: { symbol: 'µg/m³' } },
  { id: PARAM_PH, code: 'ph', name: 'pH', domain: 'WATER', isactive: true, units: { symbol: 'pH' } },
  { id: PARAM_INACTIVE, code: 'inactive_param', name: 'Inactive', domain: 'AIR', isactive: false, units: { symbol: 'x' } },
];
const assignments = [{ userid: OPERATOR_ID, stationid: STATION_AIR, endedat: null }, { userid: OPERATOR_ID, stationid: STATION_WATER, endedat: null }];
const records = [];
let lastFindManyArgs;
let lastCreateArgs;
let createError = null;

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
      lastFindManyArgs = args;
      return records.filter((record) => {
        const station = stations.get(record.stationid);
        const parameter = parameters.find((entry) => entry.id === record.parameterid);
        return record.stationid === args.where.stationid && parameter?.domain === args.where.parameters.is.domain &&
          (!args.where.parameterid || record.parameterid === args.where.parameterid) &&
          (!args.where.measuredat?.gte || record.measuredat >= args.where.measuredat.gte) &&
          (!args.where.measuredat?.lte || record.measuredat <= args.where.measuredat.lte) && Boolean(station);
      }).sort((a, b) => b.measuredat - a.measuredat).slice(args.skip, args.skip + args.take).map(hydrate);
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

  console.log('Measurement route tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
