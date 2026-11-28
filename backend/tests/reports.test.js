const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

process.env.JWT_SECRET = 'report-tests-only-secret';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const OPERATOR_ID = '22222222-2222-4222-8222-222222222222';
const AIR_STATION = '33333333-3333-4333-8333-333333333333';
const WATER_STATION = '44444444-4444-4444-8444-444444444444';
const OTHER_STATION = '55555555-5555-4555-8555-555555555555';
const AIR_MEASUREMENT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WATER_MEASUREMENT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const day = new Date(Date.now() - 60 * 60 * 1000);
const stations = [
  { id: AIR_STATION, name: 'Air One', stationtype: 'AIR' },
  { id: WATER_STATION, name: 'Water One', stationtype: 'WATER' },
  { id: OTHER_STATION, name: 'Other', stationtype: 'BOTH' },
];
const users = new Map([
  [ADMIN_ID, { id: ADMIN_ID, fullname: 'Admin', email: 'admin@test.invalid', isactive: true, userroles: [{ role: { name: 'ADMIN' } }] }],
  [OPERATOR_ID, { id: OPERATOR_ID, fullname: 'Operator', email: 'operator@test.invalid', isactive: true, userroles: [{ role: { name: 'OPERATOR' } }] }],
]);
const assignments = new Set([`${OPERATOR_ID}:${AIR_STATION}`, `${OPERATOR_ID}:${WATER_STATION}`]);
const measurements = [
  {
    id: AIR_MEASUREMENT, stationid: AIR_STATION, parameterid: 'pm25-id', value: 10, measuredat: new Date(day.getTime() + 1000),
    validationstatus: 'ACCEPTED', stations: stations[0], parameters: { id: 'pm25-id', code: 'pm25', name: 'PM2.5', domain: 'AIR', units: { symbol: 'µg/m³' } },
  },
  {
    id: WATER_MEASUREMENT, stationid: WATER_STATION, parameterid: 'ph-id', value: 7.1, measuredat: new Date(day.getTime() + 2000),
    validationstatus: 'ACCEPTED', stations: stations[1], parameters: { id: 'ph-id', code: 'ph', name: 'pH', domain: 'WATER', units: { symbol: 'pH' }, wqiparameterconfigs: [] },
  },
  { id: 'flagged-air', stationid: AIR_STATION, parameterid: 'pm25-id', value: 999, measuredat: day, validationstatus: 'FLAGGED', stations: stations[0], parameters: { code: 'pm25', name: 'PM2.5', domain: 'AIR', units: { symbol: 'µg/m³' } } },
  { id: 'rejected-air', stationid: AIR_STATION, parameterid: 'pm25-id', value: 888, measuredat: day, validationstatus: 'REJECTED', stations: stations[0], parameters: { code: 'pm25', name: 'PM2.5', domain: 'AIR', units: { symbol: 'µg/m³' } } },
];
let lastMeasurementArgs;
let lastIndexResultArgs;
const indexResults = [
  { id: 'air-index-id', methodversionid: 'aqi-v1', datastatus: 'SUFFICIENT', stationid: AIR_STATION, value: 35, category: 'GOOD', calculatedat: day, periodstart: day, periodend: new Date(day.getTime() + 5000), methodversions: { indextype: 'AQI', version: '1', methodname: 'AQI test method' }, indexresultmeasurements: [{ measurements: { id: AIR_MEASUREMENT, stationid: AIR_STATION, validationstatus: 'ACCEPTED', parameters: { domain: 'AIR' } } }] },
  { id: 'water-index-id', methodversionid: 'wqi-v1', datastatus: 'SUFFICIENT', stationid: WATER_STATION, value: 22, category: 'GOOD', calculatedat: day, periodstart: day, periodend: new Date(day.getTime() + 5000), methodversions: { indextype: 'WQI', version: '1', methodname: 'WQI test method' }, indexresultmeasurements: [{ measurements: { id: WATER_MEASUREMENT, stationid: WATER_STATION, validationstatus: 'ACCEPTED', parameters: { domain: 'WATER' } } }] },
  { id: 'insufficient-index', methodversionid: 'aqi-v1', datastatus: 'INSUFFICIENT', stationid: AIR_STATION, value: 499, category: 'SEVERE', calculatedat: day, periodstart: day, periodend: new Date(day.getTime() + 5000), methodversions: { indextype: 'AQI' }, indexresultmeasurements: [{ measurements: { id: AIR_MEASUREMENT, stationid: AIR_STATION, validationstatus: 'ACCEPTED', parameters: { domain: 'AIR' } } }] },
  { id: 'wrong-domain-index', methodversionid: 'aqi-v1', datastatus: 'SUFFICIENT', stationid: WATER_STATION, value: 450, category: 'SEVERE', calculatedat: day, periodstart: day, periodend: new Date(day.getTime() + 5000), methodversions: { indextype: 'AQI' }, indexresultmeasurements: [{ measurements: { id: WATER_MEASUREMENT, stationid: WATER_STATION, validationstatus: 'ACCEPTED', parameters: { domain: 'WATER' } } }] },
];

const prismaMock = {
  user: { async findUnique({ where }) { return users.get(where.id) || null; } },
  monitoringstation: {
    async findMany({ where }) {
      let selected = stations;
      if (where.id) selected = selected.filter((station) => station.id === where.id);
      if (where.stationassignments) {
        const { userid, endedat } = where.stationassignments.some;
        selected = selected.filter((station) => endedat === null && assignments.has(`${userid}:${station.id}`));
      }
      return selected;
    },
  },
  measurement: {
    async findMany(args) {
      lastMeasurementArgs = args;
      return measurements.filter((row) => args.where.stationid.in.includes(row.stationid) &&
        row.validationstatus === args.where.validationstatus &&
        row.measuredat >= args.where.measuredat.gte && row.measuredat <= args.where.measuredat.lte &&
        (!args.where.parameters || row.parameters.domain === args.where.parameters.is.domain))
        .sort((left, right) => right.measuredat - left.measuredat);
    },
  },
  indexResult: {
    async findMany(args) {
      lastIndexResultArgs = args;
      return indexResults.filter((row) => args.where.stationid.in.includes(row.stationid) &&
        row.datastatus === args.where.datastatus &&
        row.periodstart <= args.where.periodstart.lte && row.periodend >= args.where.periodend.gte &&
        (!args.where.methodversions || row.methodversions.indextype === args.where.methodversions.is.indextype));
    },
  },
  alert: {
    async findMany({ where }) {
      return [{
        id: 'alert-one', stationid: OTHER_STATION, message: 'Test alert', status: 'OPEN', createdat: day,
        stations: stations[2], measurements: null, indexresults: null,
      }].filter((alert) => where.stationid.in.includes(alert.stationid) && alert.createdat >= where.createdat.gte && alert.createdat <= where.createdat.lte);
    },
  },
};

const configPath = require.resolve('../config');
require.cache[configPath] = { id: configPath, filename: configPath, loaded: true, exports: prismaMock };
const app = express();
app.use(express.json());
app.use('/api/reports', require('../routes/reports'));

function bearer(userId) {
  return `Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' })}`;
}

async function run() {
  const response = await request(app).post('/api/reports').set('Authorization', bearer(ADMIN_ID)).send({ stationId: 'ALL', hours: 168, detailed: true });
  assert.equal(response.status, 200);
  assert.equal(response.body.air.samples, 1);
  assert.equal(response.body.air.stats[0].limit, null);
  assert.equal(response.body.air.stats[0].exceedances, null);
  assert.deepEqual(response.body.air.aqi, { min: 35, avg: 35, max: 35 });
  assert.equal(response.body.air.indexMethodVersion.id, 'aqi-v1');
  assert.equal(response.body.water.samples, 1);
  assert.equal(response.body.water.stats[0].ideal, null);
  assert.deepEqual(response.body.water.wqi, { min: 22, avg: 22, max: 22 });
  assert.equal(response.body.water.indexMethodVersion.id, 'wqi-v1');
  assert.equal(response.body.readings.length, 2);
  assert.ok(response.body.readings.every((row) => row.id && row.parameterLabel && row.value != null));
  assert.equal(response.body.alerts[0].type, null, 'BOTH station alerts remain unclassified');
  assert.equal(lastMeasurementArgs.where.validationstatus, 'ACCEPTED');
  assert.equal(lastIndexResultArgs.where.datastatus, 'SUFFICIENT');
  assert.equal(lastIndexResultArgs.include.indexresultmeasurements.include.measurements.select.parameters.select.domain, true);

  for (const validationstatus of ['FLAGGED', 'REJECTED']) {
    indexResults.push({
      ...indexResults[0],
      id: `index-linked-to-${validationstatus.toLowerCase()}`,
      value: 480,
      indexresultmeasurements: [{
        measurements: {
          id: AIR_MEASUREMENT,
          stationid: AIR_STATION,
          validationstatus,
          parameters: { domain: 'AIR' },
        },
      }],
    });
    const linkedInvalidMeasurement = await request(app).post('/api/reports')
      .set('Authorization', bearer(ADMIN_ID)).send({ stationId: AIR_STATION, hours: 168 });
    assert.equal(linkedInvalidMeasurement.status, 200);
    assert.deepEqual(linkedInvalidMeasurement.body.air.aqi, { min: 35, avg: 35, max: 35 });
    indexResults.pop();
  }

  const operatorAll = await request(app).post('/api/reports').set('Authorization', bearer(OPERATOR_ID)).send({ stationId: 'ALL', hours: 168 });
  assert.equal(operatorAll.status, 200);
  assert.deepEqual(lastMeasurementArgs.where.stationid.in.sort(), [AIR_STATION, WATER_STATION].sort());
  assert.equal(response.body.alerts.length, 1, 'admin can see a BOTH-station alert');

  const unassigned = await request(app).post('/api/reports').set('Authorization', bearer(OPERATOR_ID)).send({ stationId: OTHER_STATION, hours: 168 });
  assert.equal(unassigned.status, 404);

  const selectedStation = await request(app).post('/api/reports').set('Authorization', bearer(OPERATOR_ID)).send({
    stationId: AIR_STATION, from: day.toISOString(), to: new Date(day.getTime() + 10_000).toISOString(),
  });
  assert.equal(selectedStation.status, 200);
  assert.equal(selectedStation.body.air.aqi.avg, 35);

  indexResults.push({
    ...indexResults[0], id: 'air-index-v2', methodversionid: 'aqi-v2', value: 40,
  });
  const ambiguousVersions = await request(app).post('/api/reports').set('Authorization', bearer(ADMIN_ID)).send({ stationId: AIR_STATION, hours: 168 });
  assert.equal(ambiguousVersions.status, 200);
  assert.deepEqual(ambiguousVersions.body.air.aqi, { min: null, avg: null, max: null });
  indexResults.pop();

  const emptyMeasurements = measurements.splice(0, measurements.length);
  const empty = await request(app).post('/api/reports').set('Authorization', bearer(ADMIN_ID)).send({ stationId: AIR_STATION, hours: 168 });
  assert.equal(empty.status, 200);
  assert.equal(empty.body.air, null);
  assert.deepEqual(empty.body.readings, null);
  measurements.push(...emptyMeasurements);

  for (const dateValue of [123, {}, null]) {
    const invalidDate = await request(app).post('/api/reports').set('Authorization', bearer(ADMIN_ID)).send({ from: dateValue, to: new Date().toISOString() });
    assert.equal(invalidDate.status, 400);
  }
  const invalidHours = await request(app).post('/api/reports').set('Authorization', bearer(ADMIN_ID)).send({ hours: -1 });
  assert.equal(invalidHours.status, 400);
  const invalidDomain = await request(app).post('/api/reports').set('Authorization', bearer(ADMIN_ID)).send({ domain: 'SOIL' });
  assert.equal(invalidDomain.status, 400);
  const missingDate = await request(app).post('/api/reports').set('Authorization', bearer(ADMIN_ID)).send({ from: day.toISOString() });
  assert.equal(missingDate.status, 400);
  const noAuth = await request(app).post('/api/reports').send({});
  assert.equal(noAuth.status, 401);
  console.log('Report route tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
