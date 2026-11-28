const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../config');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const TOKEN_LIFETIME = '7d';
const ROLE_PRIORITY = ['ADMIN', 'OPERATOR'];

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return process.env.JWT_SECRET;
}

function rolesForUser(user) {
  return [...new Set((user.userroles || []).map(({ role }) => role?.name).filter(Boolean))]
    .sort((left, right) => ROLE_PRIORITY.indexOf(left) - ROLE_PRIORITY.indexOf(right));
}

function publicUser(user, roles = rolesForUser(user)) {
  return {
    id: user.id,
    name: user.fullname,
    email: user.email,
    role: roles[0] || null,
  };
}

function issueToken(user, role, secret = getJwtSecret()) {
  return jwt.sign(
    { userId: user.id, role },
    secret,
    { algorithm: 'HS256', expiresIn: TOKEN_LIFETIME }
  );
}

function mapUniqueViolation(error) {
  return error?.code === 'P2002';
}

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  try {
    const jwtSecret = getJwtSecret();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Self-service registration is limited to the least-privileged canonical role.
    const operatorRole = await prisma.role.findFirst({ where: { name: 'OPERATOR' } });
    if (!operatorRole) {
      return res.status(503).json({ error: 'Registration is not configured' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: {
          fullname: typeof name === 'string' && name.trim() ? name.trim() : null,
          email: normalizedEmail,
          password: hashedPassword,
          updatedat: new Date(),
        },
      });
      await transaction.userRoles.create({
        data: { userid: createdUser.id, roleid: operatorRole.id },
      });
      return createdUser;
    });

    const token = issueToken(user, 'OPERATOR', jwtSecret);
    return res.status(201).json({ ...publicUser(user, ['OPERATOR']), token });
  } catch (error) {
    if (mapUniqueViolation(error)) {
      return res.status(409).json({ error: 'User already exists' });
    }
    if (error.message === 'JWT_SECRET is not configured') {
      return res.status(500).json({ error: 'Authentication is not configured' });
    }
    console.error('Registration failed:', error.message);
    return res.status(500).json({ error: 'Unable to register user' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const jwtSecret = getJwtSecret();
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { userroles: { include: { role: true } } },
    });
    if (!user || !user.password || !user.isactive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const roles = rolesForUser(user);
    if (!roles.length) {
      return res.status(403).json({ error: 'User has no assigned role' });
    }

    const role = roles[0];
    return res.json({ ...publicUser(user, roles), token: issueToken(user, role, jwtSecret) });
  } catch (error) {
    if (error.message === 'JWT_SECRET is not configured') {
      return res.status(500).json({ error: 'Authentication is not configured' });
    }
    console.error('Login failed:', error.message);
    return res.status(500).json({ error: 'Unable to log in' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  const { id, name, email, role } = req.user;
  return res.json({ id, name, email, role });
});

module.exports = router;
