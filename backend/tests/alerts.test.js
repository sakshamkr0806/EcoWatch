const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

process.env.JWT_SECRET = 'alerts-tests-only-secret';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const OPERATOR_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_OPERATOR_ID = '77777777-7777-4777-8777-777777777777';
const STATION_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_STATION_ID = '44444444-4444-4444-8444-444444444444';
const ALERT_ID = '55555555-5555-4555-8555-555555555555';
const OTHER_ALERT_ID = '66666666-6666-4666-8666-666666666666';
const CONCURRENT_ALERT_ID = '88888888-8888-4888-8888-888888888888';
const SAME_USER_RACE_ALERT_ID = '99999999-9999-4999-8999-999999999999';
const UNRELATED_CONFLICT_ALERT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const users = new Map([
  [ADMIN_ID, { id: ADMIN_ID, fullname: 'Admin', email: 'admin@example.test', isactive: true, userroles: [{ role: { name: 'ADMIN' } }] }],
  [OPERATOR_ID, { id: OPERATOR_ID, fullname: 'Operator', email: 'operator@example.test', isactive: true, userroles: [{ role: { name: 'OPERATOR' } }] }],
  [SECOND_OPERATOR_ID, { id: SECOND_OPERATOR_ID, fullname: 'Second Operator', email: 'second@example.test', isactive: true, userroles: [{ role: { name: 'OPERATOR' } }] }],
]);
const assignments = [
  { id: 'assignment-1', userid: OPERATOR_ID, stationid: STATION_ID, endedat: null },
  { id: 'assignment-2', userid: SECOND_OPERATOR_ID, stationid: STATION_ID, endedat: null },
];
const stations = new Map([
  [STATION_ID, { id: STATION_ID, name: 'North Station', stationcode: 'NORTH', stationtype: 'BOTH' }],
  [OTHER_STATION_ID, { id: OTHER_STATION_ID, name: 'South Station', stationcode: 'SOUTH', stationtype: 'WATER' }],
]);
const alerts = new Map([
  [ALERT_ID, {
    id: ALERT_ID, stationid: STATION_ID, title: 'High particulate reading', message: 'PM2.5 threshold exceeded',
    severity: 'HIGH', status: 'OPEN', dedupekey: 'pm25:north:1', createdat: new Date('2026-01-01T00:00:00Z'),
    acknowledgedat: null, resolvedat: null, resolvedbyuserid: null, ruleid: 'rule-1',
    rules: { thresholdvalue: 35 }, measurements: { parameters: { domain: 'AIR' } },
    indexresults: null, acknowledgedByUser: [],
  }],
  [OTHER_ALERT_ID, {
    id: OTHER_ALERT_ID, stationid: OTHER_STATION_ID, title: 'Water alert', message: 'Water threshold exceeded',
    severity: 'MEDIUM', status: 'OPEN', dedupekey: 'wqi:south:1', createdat: new Date('2026-01-02T00:00:00Z'),
    acknowledgedat: null, resolvedat: null, resolvedbyuserid: null, ruleid: null,
    rules: null, measurements: null, indexresults: { methodversions: { indextype: 'WQI' } }, acknowledgedByUser: [],
  }],
]);
let lastFindManyArgs;
let lastUpdateArgs;
let acknowledgementConnects = 0;
let sameUserRaceAlertId = null;
let sameUserRaceReadCount = 0;
let releaseSameUserReadBarrier;
let sameUserReadBarrier = null;
let sameUserRaceConflicts = 0;
let unrelatedConflictAlertId = null;

function ensureCanonicalArgs(args) {
  const serialized = JSON.stringify(args);
  for (const legacy of ['relatedStation', 'relatedStationId', 'createdAt', 'station:', 'stationId']) {
    assert.equal(serialized.includes(legacy), false, `unexpected legacy Prisma key: ${legacy}`);
  }
  assert.ok(!('include' in args) || ['stations', 'measurements', 'indexresults', 'rules', 'acknowledgedByUser']
    .every((relation) => args.include[relation] === undefined || typeof args.include[relation] === 'object'));
}

function matches(alert, where) {
  if (where.stationid && alert.stationid !== where.stationid) return false;
  if (where.severity && alert.severity !== where.severity) return false;
  if (where.status && alert.status !== where.status) return false;
  if (where.createdat?.gte && alert.createdat < where.createdat.gte) return false;
  if (where.createdat?.lte && alert.createdat > where.createdat.lte) return false;
  if (where.stations?.is?.stationassignments?.some) {
    const predicate = where.stations.is.stationassignments.some;
    assert.equal(predicate.endedat, null, 'operator query must filter active assignments');
    if (!assignments.some((item) => item.userid === predicate.userid && item.stationid === alert.stationid && item.endedat === predicate.endedat)) return false;
  }
  if (where.OR) {
    const typeMatches = where.OR.some((clause) => {
      const domain = clause.measurements?.is?.parameters?.is?.domain;
      const indexType = clause.indexresults?.is?.methodversions?.is?.indextype;
      const stationType = clause.stations?.is?.stationtype;
      return (domain && alert.measurements?.parameters?.domain === domain) ||
        (indexType && alert.indexresults?.methodversions?.indextype === indexType) ||
        (stationType && stations.get(alert.stationid)?.stationtype === stationType);
    });
    if (!typeMatches) return false;
  }
  return true;
}

const prismaMock = {
  user: { async findUnique({ where }) { return users.get(where.id) || null; } },
  stationAssignment: {
    async findFirst({ where }) {
      return assignments.find((item) => item.userid === where.userid && item.stationid === where.stationid && item.endedat === null) || null;
    },
  },
  alert: {
    async findMany(args) {
      ensureCanonicalArgs(args);
      lastFindManyArgs = args;
      let rows = [...alerts.values()].filter((alert) => matches(alert, args.where));
      rows.sort((a, b) => b.createdat - a.createdat);
      rows = rows.slice(args.skip, args.skip + args.take);
      return rows.map((alert) => ({
        ...alert,
        stations: stations.get(alert.stationid),
        acknowledgedByUser: alert.acknowledgedByUser.filter((user) => user.id === args.include.acknowledgedByUser.where.id),
      }));
    },
    async findUnique(args) {
      ensureCanonicalArgs(args);
      const alert = alerts.get(args.where.id);
      if (!alert) return null;
      if (args.where.id === sameUserRaceAlertId && args.include?.acknowledgedByUser &&
          !args.include.acknowledgedByUser.where && sameUserRaceReadCount < 2) {
        const initialSnapshot = {
          ...alert,
          stations: stations.get(alert.stationid),
          acknowledgedByUser: [...alert.acknowledgedByUser],
        };
        sameUserRaceReadCount += 1;
        if (sameUserRaceReadCount === 2) releaseSameUserReadBarrier();
        await sameUserReadBarrier;
        return initialSnapshot;
      }
      const acknowledgedByUser = args.include?.acknowledgedByUser
        ? alert.acknowledgedByUser.filter((user) => !args.include.acknowledgedByUser.where || user.id === args.include.acknowledgedByUser.where.id)
        : alert.acknowledgedByUser;
      return { ...alert, stations: stations.get(alert.stationid), acknowledgedByUser };
    },
    async update(args) {
      ensureCanonicalArgs(args);
      lastUpdateArgs = args;
      const alert = alerts.get(args.where.id);
      if (!alert) {
        const error = new Error('Not found');
        error.code = 'P2025';
        throw error;
      }
      if (alert.id === unrelatedConflictAlertId) {
        const error = new Error('Unique constraint failed on dedupekey');
        error.code = 'P2002';
        error.meta = { target: ['dedupekey'] };
        throw error;
      }
      if (args.data.acknowledgedByUser) {
        acknowledgementConnects += 1;
        const connectedUser = users.get(args.data.acknowledgedByUser.connect.id);
        if (alert.id === sameUserRaceAlertId && alert.acknowledgedByUser.some((user) => user.id === connectedUser.id)) {
          sameUserRaceConflicts += 1;
          const error = new Error('Unique constraint failed on implicit acknowledgement relation');
          error.code = 'P2002';
          error.meta = { target: ['_alert_acknowledgedByUser_AB_unique'] };
          throw error;
        }
        if (!alert.acknowledgedByUser.some((user) => user.id === connectedUser.id)) {
          alert.acknowledgedByUser.push(connectedUser);
        }
      }
      Object.assign(alert, Object.fromEntries(Object.entries(args.data).filter(([key]) => key !== 'acknowledgedByUser')));
      return {
        ...alert,
        stations: stations.get(alert.stationid),
        acknowledgedByUser: alert.acknowledgedByUser.filter((user) => user.id === args.include.acknowledgedByUser.where.id),
      };
    },
  },
};

const configPath = require.resolve('../config');
require.cache[configPath] = { id: configPath, filename: configPath, loaded: true, exports: prismaMock };
const alertRoutes = require('../routes/alerts');
const app = express();
app.use(express.json());
app.use('/api/alerts', alertRoutes);

function authToken(userId) {
  return `Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' })}`;
}
const adminAuth = authToken(ADMIN_ID);
const operatorAuth = authToken(OPERATOR_ID);

async function run() {
  const unauthenticated = await request(app).get('/api/alerts');
  assert.equal(unauthenticated.status, 401);
  const unauthenticatedPatch = await request(app).patch(`/api/alerts/${ALERT_ID}/status`).send({ status: 'ACKNOWLEDGED' });
  assert.equal(unauthenticatedPatch.status, 401);

  const adminList = await request(app).get('/api/alerts').set('Authorization', adminAuth);
  assert.equal(adminList.status, 200);
  assert.equal(adminList.body.length, 2);
  assert.equal(adminList.body[0].stationCode, 'SOUTH');
  assert.equal(adminList.body[1].type, 'AIR');
  assert.equal(adminList.body[1].threshold, 35);
  assert.equal(lastFindManyArgs.where.stations, undefined);
  assert.equal(lastFindManyArgs.orderBy.createdat, 'desc');

  const operatorList = await request(app).get('/api/alerts').set('Authorization', operatorAuth);
  assert.equal(operatorList.status, 200);
  assert.deepEqual(operatorList.body.map((alert) => alert.id), [ALERT_ID]);
  assert.equal(lastFindManyArgs.where.stations.is.stationassignments.some.userid, OPERATOR_ID);
  assert.equal(lastFindManyArgs.where.stations.is.stationassignments.some.endedat, null);

  const unauthorizedRead = await request(app).get(`/api/alerts/${OTHER_ALERT_ID}`).set('Authorization', operatorAuth);
  assert.equal(unauthorizedRead.status, 403);
  const unauthorizedUpdate = await request(app).patch(`/api/alerts/${OTHER_ALERT_ID}/status`)
    .set('Authorization', operatorAuth).send({ status: 'ACKNOWLEDGED' });
  assert.equal(unauthorizedUpdate.status, 403);

  const invalidStatus = await request(app).patch(`/api/alerts/${ALERT_ID}/status`)
    .set('Authorization', operatorAuth).send({ status: 'SUPPRESSED' });
  assert.equal(invalidStatus.status, 400);
  const missingAlert = await request(app).patch('/api/alerts/77777777-7777-4777-8777-777777777777/status')
    .set('Authorization', adminAuth).send({ status: 'ACKNOWLEDGED' });
  assert.equal(missingAlert.status, 404);

  const acknowledged = await request(app).patch(`/api/alerts/${ALERT_ID}/status`)
    .set('Authorization', operatorAuth).send({ status: 'ACKNOWLEDGED' });
  assert.equal(acknowledged.status, 200);
  assert.equal(acknowledged.body.status, 'ACKNOWLEDGED');
  assert.equal(acknowledged.body.acknowledgedByMe, true);
  assert.equal(lastUpdateArgs.data.acknowledgedByUser.connect.id, OPERATOR_ID);
  assert.ok(lastUpdateArgs.data.acknowledgedat instanceof Date);
  const originalAcknowledgedAt = alerts.get(ALERT_ID).acknowledgedat;
  assert.deepEqual(alerts.get(ALERT_ID).acknowledgedByUser.map((user) => user.id), [OPERATOR_ID]);

  const secondOperatorAuth = authToken(SECOND_OPERATOR_ID);
  const secondAcknowledgement = await request(app).patch(`/api/alerts/${ALERT_ID}/status`)
    .set('Authorization', secondOperatorAuth).send({ status: 'ACKNOWLEDGED' });
  assert.equal(secondAcknowledgement.status, 200);
  assert.equal(secondAcknowledgement.body.status, 'ACKNOWLEDGED');
  assert.deepEqual(alerts.get(ALERT_ID).acknowledgedByUser.map((user) => user.id), [OPERATOR_ID, SECOND_OPERATOR_ID]);
  assert.equal(alerts.get(ALERT_ID).acknowledgedat, originalAcknowledgedAt);
  assert.deepEqual(lastUpdateArgs.data, {
    acknowledgedByUser: { connect: { id: SECOND_OPERATOR_ID } },
  });

  const detailAcknowledged = await request(app).get(`/api/alerts/${ALERT_ID}`).set('Authorization', secondOperatorAuth);
  assert.equal(detailAcknowledged.status, 200);
  assert.equal(detailAcknowledged.body.acknowledgedByMe, true);
  const detailNotAcknowledged = await request(app).get(`/api/alerts/${ALERT_ID}`).set('Authorization', adminAuth);
  assert.equal(detailNotAcknowledged.status, 200);
  assert.equal(detailNotAcknowledged.body.acknowledgedByMe, false);

  const connectCountBeforeDuplicate = acknowledgementConnects;
  const repeatedAcknowledgement = await request(app).patch(`/api/alerts/${ALERT_ID}/status`)
    .set('Authorization', secondOperatorAuth).send({ status: 'ACKNOWLEDGED' });
  assert.equal(repeatedAcknowledgement.status, 200);
  assert.equal(acknowledgementConnects, connectCountBeforeDuplicate);
  assert.deepEqual(alerts.get(ALERT_ID).acknowledgedByUser.map((user) => user.id), [OPERATOR_ID, SECOND_OPERATOR_ID]);

  alerts.set(CONCURRENT_ALERT_ID, {
    id: CONCURRENT_ALERT_ID, stationid: STATION_ID, title: 'Concurrent acknowledgement test', message: 'Test alert',
    severity: 'LOW', status: 'OPEN', dedupekey: 'concurrent:north:1', createdat: new Date('2025-01-01T00:00:00Z'),
    acknowledgedat: null, resolvedat: null, resolvedbyuserid: null, ruleid: null,
    rules: null, measurements: null, indexresults: null, acknowledgedByUser: [],
  });
  const concurrentAcknowledgements = await Promise.all([
    request(app).patch(`/api/alerts/${CONCURRENT_ALERT_ID}/status`).set('Authorization', operatorAuth).send({ status: 'ACKNOWLEDGED' }),
    request(app).patch(`/api/alerts/${CONCURRENT_ALERT_ID}/status`).set('Authorization', secondOperatorAuth).send({ status: 'ACKNOWLEDGED' }),
  ]);
  assert.deepEqual(concurrentAcknowledgements.map((response) => response.status), [200, 200]);
  assert.deepEqual(
    alerts.get(CONCURRENT_ALERT_ID).acknowledgedByUser.map((user) => user.id).sort(),
    [OPERATOR_ID, SECOND_OPERATOR_ID].sort(),
  );

  alerts.set(SAME_USER_RACE_ALERT_ID, {
    id: SAME_USER_RACE_ALERT_ID, stationid: STATION_ID, title: 'Same-user race test', message: 'Test alert',
    severity: 'LOW', status: 'OPEN', dedupekey: 'same-user-race:north:1', createdat: new Date('2025-01-02T00:00:00Z'),
    acknowledgedat: null, resolvedat: null, resolvedbyuserid: null, ruleid: null,
    rules: null, measurements: null, indexresults: null, acknowledgedByUser: [],
  });
  sameUserRaceAlertId = SAME_USER_RACE_ALERT_ID;
  sameUserRaceReadCount = 0;
  sameUserReadBarrier = new Promise((resolve) => { releaseSameUserReadBarrier = resolve; });
  const sameUserRaceResponses = await Promise.all([
    request(app).patch(`/api/alerts/${SAME_USER_RACE_ALERT_ID}/status`).set('Authorization', operatorAuth).send({ status: 'ACKNOWLEDGED' }),
    request(app).patch(`/api/alerts/${SAME_USER_RACE_ALERT_ID}/status`).set('Authorization', operatorAuth).send({ status: 'ACKNOWLEDGED' }),
  ]);
  assert.deepEqual(sameUserRaceResponses.map((response) => response.status), [200, 200]);
  assert.equal(sameUserRaceConflicts, 1);
  assert.deepEqual(alerts.get(SAME_USER_RACE_ALERT_ID).acknowledgedByUser.map((user) => user.id), [OPERATOR_ID]);
  sameUserRaceAlertId = null;

  alerts.set(UNRELATED_CONFLICT_ALERT_ID, {
    id: UNRELATED_CONFLICT_ALERT_ID, stationid: STATION_ID, title: 'Unrelated conflict test', message: 'Test alert',
    severity: 'LOW', status: 'OPEN', dedupekey: 'unrelated-conflict:north:1', createdat: new Date('2025-01-03T00:00:00Z'),
    acknowledgedat: null, resolvedat: null, resolvedbyuserid: null, ruleid: null,
    rules: null, measurements: null, indexresults: null, acknowledgedByUser: [],
  });
  unrelatedConflictAlertId = UNRELATED_CONFLICT_ALERT_ID;
  const unrelatedConflict = await request(app).patch(`/api/alerts/${UNRELATED_CONFLICT_ALERT_ID}/status`)
    .set('Authorization', operatorAuth).send({ status: 'ACKNOWLEDGED' });
  assert.equal(unrelatedConflict.status, 500);
  assert.deepEqual(alerts.get(UNRELATED_CONFLICT_ALERT_ID).acknowledgedByUser, []);
  unrelatedConflictAlertId = null;

  const resolved = await request(app).patch(`/api/alerts/${ALERT_ID}/status`)
    .set('Authorization', operatorAuth).send({ status: 'RESOLVED' });
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.status, 'RESOLVED');
  assert.equal(lastUpdateArgs.data.resolvedbyuserid, OPERATOR_ID);
  assert.ok(lastUpdateArgs.data.resolvedat instanceof Date);

  const invalidFilter = await request(app).get('/api/alerts?severity=EXTREME').set('Authorization', adminAuth);
  assert.equal(invalidFilter.status, 400);
  const filtered = await request(app).get('/api/alerts?type=WATER&limit=1').set('Authorization', adminAuth);
  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.length, 1);
  assert.equal(filtered.body[0].type, 'WATER');
  assert.ok(lastFindManyArgs.where.OR);

  console.log('Alert integration tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
