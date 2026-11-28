const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

process.env.JWT_SECRET = 'station-tests-only-secret';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const OPERATOR_ID = '22222222-2222-4222-8222-222222222222';
const DISTRICT_ID = '33333333-3333-4333-8333-333333333333';
const STATION_ID = '44444444-4444-4444-8444-444444444444';
const SECOND_STATION_ID = '55555555-5555-4555-8555-555555555555';
const users = new Map([
  [ADMIN_ID, { id: ADMIN_ID, fullname: 'Admin', email: 'admin@example.test', isactive: true, userroles: [{ role: { name: 'ADMIN' } }] }],
  [OPERATOR_ID, { id: OPERATOR_ID, fullname: 'Operator', email: 'operator@example.test', isactive: true, userroles: [{ role: { name: 'OPERATOR' } }] }],
]);
const assignments = [{ userid: OPERATOR_ID, stationid: STATION_ID, endedat: null }];
const stations = new Map([
  [STATION_ID, {
    id: STATION_ID,
    name: 'North Station',
    stationcode: 'NORTH',
    stationtype: 'AIR',
    status: 'ACTIVE',
    latitude: 28.6,
    longitude: 77.2,
    locality: 'North zone',
    address: null,
    installedat: null,
    districtid: DISTRICT_ID,
    createdat: new Date('2025-01-01T00:00:00Z'),
    updatedat: new Date('2025-01-01T00:00:00Z'),
  }],
  [SECOND_STATION_ID, {
    id: SECOND_STATION_ID,
    name: 'South Station',
    stationcode: 'SOUTH',
    stationtype: 'WATER',
    status: 'ACTIVE',
    latitude: 27.2,
    longitude: 78.1,
    locality: null,
    address: null,
    installedat: null,
    districtid: DISTRICT_ID,
    createdat: new Date('2025-01-02T00:00:00Z'),
    updatedat: new Date('2025-01-02T00:00:00Z'),
  }],
]);
let lastFindManyArgs;
let nextStationNumber = 1;

function hydrate(station, include = {}) {
  if (!station) return null;
  return {
    ...station,
    districts: { id: DISTRICT_ID, name: 'Central District' },
    ...(include.stationassignments
      ? { stationassignments: assignments.filter((assignment) => assignment.stationid === station.id) }
      : {}),
    ...(include._count ? { _count: { measurements: 4 } } : {}),
  };
}

const prismaMock = {
  user: {
    async findUnique({ where }) {
      return users.get(where.id) || null;
    },
  },
  district: {
    async findUnique({ where }) {
      return where.id === DISTRICT_ID ? { id: DISTRICT_ID, name: 'Central District' } : null;
    },
  },
  monitoringstation: {
    async findMany(args) {
      lastFindManyArgs = args;
      let entries = [...stations.values()];
      if (args.where.stationtype) entries = entries.filter((station) => station.stationtype === args.where.stationtype);
      if (args.where.status) entries = entries.filter((station) => station.status === args.where.status);
      if (args.where.stationassignments) {
        const { userid } = args.where.stationassignments.some;
        entries = entries.filter((station) => assignments.some(
          (assignment) => assignment.stationid === station.id && assignment.userid === userid && assignment.endedat === null
        ));
      }
      entries.sort((a, b) => a.name.localeCompare(b.name));
      return entries.slice(args.skip, args.skip + args.take).map((station) => hydrate(station, args.include));
    },
    async findUnique({ where, include = {} }) {
      const station = where.id
        ? stations.get(where.id)
        : [...stations.values()].find((entry) => entry.stationcode === where.stationcode);
      const hydrated = hydrate(station, include);
      if (hydrated?.stationassignments && include.stationassignments?.where) {
        hydrated.stationassignments = hydrated.stationassignments.filter(
          (assignment) => assignment.userid === include.stationassignments.where.userid && assignment.endedat === null
        );
      }
      return hydrated;
    },
    async create({ data }) {
      const station = {
        id: `66666666-6666-4666-8666-${String(nextStationNumber++).padStart(12, '0')}`,
        createdat: new Date(),
        ...data,
      };
      stations.set(station.id, station);
      return hydrate(station, { districts: true, _count: true });
    },
    async update({ where, data }) {
      const station = stations.get(where.id);
      if (!station) {
        const error = new Error('Record not found');
        error.code = 'P2025';
        throw error;
      }
      Object.assign(station, data);
      return hydrate(station, { districts: true, _count: true });
    },
    async delete({ where }) {
      const station = stations.get(where.id);
      if (!station) {
        const error = new Error('Record not found');
        error.code = 'P2025';
        throw error;
      }
      stations.delete(where.id);
      return station;
    },
  },
  stationAssignment: {
    async create({ data }) {
      assignments.push({ ...data, endedat: null });
      return data;
    },
  },
  async $transaction(callback) {
    return callback(prismaMock);
  },
};

const configPath = require.resolve('../config');
require.cache[configPath] = {
  id: configPath,
  filename: configPath,
  loaded: true,
  exports: prismaMock,
};

const stationRoutes = require('../routes/stations');
const app = express();
app.use(express.json());
app.use('/api/stations', stationRoutes);

function token(userId, role) {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

const adminAuth = `Bearer ${token(ADMIN_ID, 'ADMIN')}`;
const operatorAuth = `Bearer ${token(OPERATOR_ID, 'OPERATOR')}`;

async function run() {
  const adminList = await request(app).get('/api/stations?page=1&limit=1&type=AIR').set('Authorization', adminAuth);
  assert.equal(adminList.status, 200);
  assert.equal(adminList.body.length, 1);
  assert.equal(adminList.body[0].code, 'NORTH');
  assert.equal(adminList.body[0].type, 'AIR');
  assert.equal(adminList.body[0].lat, 28.6);
  assert.equal(lastFindManyArgs.skip, 0);
  assert.equal(lastFindManyArgs.take, 1);

  const operatorList = await request(app).get('/api/stations').set('Authorization', operatorAuth);
  assert.equal(operatorList.status, 200);
  assert.deepEqual(operatorList.body.map((station) => station.id), [STATION_ID]);
  assert.equal(lastFindManyArgs.where.stationassignments.some.userid, OPERATOR_ID);
  assert.equal(lastFindManyArgs.where.stationassignments.some.endedat, null);
  const assignedDetail = await request(app)
    .get(`/api/stations/${STATION_ID}`)
    .set('Authorization', operatorAuth);
  assert.equal(assignedDetail.status, 200);

  const badPagination = await request(app).get('/api/stations?page=0').set('Authorization', adminAuth);
  assert.equal(badPagination.status, 400);
  const badFilter = await request(app).get('/api/stations?type=GAS').set('Authorization', adminAuth);
  assert.equal(badFilter.status, 400);

  const created = await request(app)
    .post('/api/stations')
    .set('Authorization', adminAuth)
    .send({
      name: 'East Monitor',
      code: 'EAST1',
      type: 'BOTH',
      lat: 25.5,
      lng: 80.4,
      area: 'East zone',
      districtId: DISTRICT_ID,
      userId: OPERATOR_ID,
    });
  assert.equal(created.status, 201);
  assert.equal(created.body.code, 'EAST1');
  assert.equal(created.body.type, 'BOTH');
  assert.equal(created.body.area, 'East zone');
  const persisted = stations.get(created.body.id);
  assert.equal(persisted.latitude, 25.5);
  assert.equal(persisted.longitude, 80.4);
  assert.equal(persisted.stationtype, 'BOTH');
  assert.ok(assignments.some((assignment) => assignment.userid === OPERATOR_ID && assignment.stationid === created.body.id));

  const invalidDistrict = await request(app)
    .post('/api/stations')
    .set('Authorization', adminAuth)
    .send({ name: 'Bad District', type: 'AIR', lat: 1, lng: 2, districtId: 'not-a-district' });
  assert.equal(invalidDistrict.status, 400);

  const duplicateCode = await request(app)
    .post('/api/stations')
    .set('Authorization', adminAuth)
    .send({ name: 'Duplicate', code: 'NORTH', type: 'AIR', lat: 1, lng: 2, districtId: DISTRICT_ID });
  assert.equal(duplicateCode.status, 409);

  const invalidId = await request(app).get('/api/stations/not-a-uuid').set('Authorization', adminAuth);
  assert.equal(invalidId.status, 400);
  const invalidUpdateId = await request(app)
    .patch('/api/stations/not-a-uuid')
    .set('Authorization', adminAuth)
    .send({ name: 'Invalid' });
  assert.equal(invalidUpdateId.status, 400);
  const invalidDeleteId = await request(app)
    .delete('/api/stations/not-a-uuid')
    .set('Authorization', adminAuth);
  assert.equal(invalidDeleteId.status, 400);
  const missingStation = await request(app)
    .get('/api/stations/77777777-7777-4777-8777-777777777777')
    .set('Authorization', adminAuth);
  assert.equal(missingStation.status, 404);

  const unassignedStation = await request(app)
    .get(`/api/stations/${SECOND_STATION_ID}`)
    .set('Authorization', operatorAuth);
  assert.equal(unassignedStation.status, 403);

  const operatorCreate = await request(app)
    .post('/api/stations')
    .set('Authorization', operatorAuth)
    .send({ name: 'Forbidden', type: 'AIR', lat: 1, lng: 2, districtId: DISTRICT_ID });
  assert.equal(operatorCreate.status, 403);

  const updated = await request(app)
    .patch(`/api/stations/${STATION_ID}`)
    .set('Authorization', adminAuth)
    .send({ isActive: false });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.status, 'INACTIVE');
  const duplicateCodeUpdate = await request(app)
    .patch(`/api/stations/${SECOND_STATION_ID}`)
    .set('Authorization', adminAuth)
    .send({ code: 'NORTH' });
  assert.equal(duplicateCodeUpdate.status, 409);

  const operatorDelete = await request(app)
    .delete(`/api/stations/${STATION_ID}`)
    .set('Authorization', operatorAuth);
  assert.equal(operatorDelete.status, 403);
  const deleted = await request(app)
    .delete(`/api/stations/${STATION_ID}`)
    .set('Authorization', adminAuth);
  assert.equal(deleted.status, 200);
  assert.equal(stations.has(STATION_ID), false);

  console.log('Station integration tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
