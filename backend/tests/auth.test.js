const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

process.env.JWT_SECRET = 'auth-tests-only-secret';

const users = new Map();
const assignments = [];
const operatorRole = { id: 'role-operator', name: 'OPERATOR' };
const adminRole = { id: 'role-admin', name: 'ADMIN' };
let nextUserId = 1;

function withRoles(user) {
  if (!user) return null;
  return {
    ...user,
    userroles: assignments
      .filter((assignment) => assignment.userid === user.id)
      .map((assignment) => ({ role: assignment.role })),
  };
}

const prismaMock = {
  user: {
    async findUnique({ where }) {
      const user = where.id
        ? [...users.values()].find((entry) => entry.id === where.id)
        : users.get(where.email);
      return withRoles(user);
    },
    async create({ data }) {
      if (users.has(data.email)) {
        const error = new Error('Unique constraint failed');
        error.code = 'P2002';
        throw error;
      }
      const user = { id: `user-${nextUserId++}`, isactive: true, ...data };
      users.set(user.email, user);
      return { ...user };
    },
  },
  role: {
    async findFirst({ where }) {
      return where.name === 'OPERATOR' ? operatorRole : null;
    },
  },
  userRoles: {
    async create({ data }) {
      const role = data.roleid === operatorRole.id ? operatorRole : adminRole;
      assignments.push({ userid: data.userid, role });
      return { ...data, role };
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

const authMiddleware = require('../middleware/auth');
const authRoutes = require('../routes/auth');
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.get('/api/protected', authMiddleware, (req, res) => res.json(req.user));
app.get('/api/admin', authMiddleware, authMiddleware.requireRole('ADMIN'), (req, res) => {
  res.json({ ok: true });
});

async function run() {
  const register = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email: ' Test@Test.com ', password: 'password123' });
  assert.equal(register.status, 201);
  assert.equal(register.body.name, 'Test User');
  assert.equal(register.body.email, 'test@test.com');
  assert.equal(register.body.role, 'OPERATOR');
  assert.equal('password' in register.body, false);
  const storedUser = users.get('test@test.com');
  assert.notEqual(storedUser.password, 'password123');
  assert.equal(await bcrypt.compare('password123', storedUser.password), true);
  assert.equal(assignments[0].role.name, 'OPERATOR');
  assert.deepEqual(jwt.verify(register.body.token, process.env.JWT_SECRET, { algorithms: ['HS256'] }).role, 'OPERATOR');

  const duplicate = await request(app)
    .post('/api/auth/register')
    .send({ email: 'test@test.com', password: 'password123' });
  assert.equal(duplicate.status, 409);

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'TEST@test.com', password: 'password123' });
  assert.equal(login.status, 200);
  assert.equal(login.body.name, 'Test User');
  assert.equal(login.body.role, 'OPERATOR');
  assert.equal('password' in login.body, false);

  const wrongPassword = await request(app)
    .post('/api/auth/login')
    .send({ email: 'test@test.com', password: 'wrong-password' });
  assert.equal(wrongPassword.status, 401);

  const missingToken = await request(app).get('/api/protected');
  assert.equal(missingToken.status, 401);

  const me = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${login.body.token}`);
  assert.equal(me.status, 200);
  assert.deepEqual(me.body, {
    id: storedUser.id,
    name: 'Test User',
    email: 'test@test.com',
    role: 'OPERATOR',
  });
  assert.equal('password' in me.body, false);

  const expiredToken = jwt.sign(
    { userId: storedUser.id, role: 'OPERATOR' },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: -1 }
  );
  const expired = await request(app)
    .get('/api/protected')
    .set('Authorization', `Bearer ${expiredToken}`);
  assert.equal(expired.status, 401);
  assert.equal(expired.body.error, 'Token expired');

  const invalid = await request(app)
    .get('/api/protected')
    .set('Authorization', 'Bearer not-a-valid-token');
  assert.equal(invalid.status, 401);

  const insufficientRole = await request(app)
    .get('/api/admin')
    .set('Authorization', `Bearer ${login.body.token}`);
  assert.equal(insufficientRole.status, 403);

  assignments.push({ userid: storedUser.id, role: adminRole });
  const adminToken = jwt.sign(
    { userId: storedUser.id, role: 'ADMIN' },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '7d' }
  );
  const permittedRole = await request(app)
    .get('/api/admin')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(permittedRole.status, 200);

  console.log('Authentication tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
