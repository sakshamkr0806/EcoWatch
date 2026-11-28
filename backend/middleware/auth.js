const jwt = require('jsonwebtoken');
const prisma = require('../config');

const VALID_ROLES = new Set(['ADMIN', 'OPERATOR']);

async function authMiddleware(req, res, next) {
  const authorization = req.get('authorization');
  const match = typeof authorization === 'string' && authorization.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    return res.status(401).json({ error: 'No token provided' });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Authentication is not configured' });
  }

  let claims;
  try {
    claims = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (!claims || typeof claims !== 'object' || typeof claims.userId !== 'string') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: claims.userId },
      include: { userroles: { include: { role: true } } },
    });
    if (!user || !user.isactive) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const roles = [...new Set((user.userroles || [])
      .map(({ role }) => role?.name)
      .filter((role) => VALID_ROLES.has(role)))];
    const role = roles.includes('ADMIN') ? 'ADMIN' : roles[0] || null;
    req.user = { id: user.id, name: user.fullname, email: user.email, role, roles };

    // Keep the previous middleware properties available while standardizing on req.user.
    req.userId = req.user.id;
    req.userRole = req.user.role;
    return next();
  } catch (error) {
    console.error('Authentication lookup failed:', error.message);
    return res.status(500).json({ error: 'Unable to authenticate user' });
  }
}

function requireRole(...allowedRoles) {
  const allowed = new Set(allowedRoles);
  if ([...allowed].some((role) => !VALID_ROLES.has(role))) {
    throw new TypeError('requireRole accepts only ADMIN or OPERATOR');
  }

  return (req, res, next) => {
    if (!req.user || !req.user.roles.some((role) => allowed.has(role))) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    return next();
  };
}

module.exports = authMiddleware;
module.exports.requireRole = requireRole;
