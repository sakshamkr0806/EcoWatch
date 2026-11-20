const jwt = require('jsonwebtoken');

const { User } = require('../models/User');

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = User.findByEmail(decoded.email);
    
    if (!req.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    next();
  } catch (error) {
    res.status(401).json({ error: 'Token expired or invalid' });
  }
};
