// middleware/auth.js  (CommonJS)
'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || process.env.APP_JWT_SECRET || 'dev-secret-change-me';

function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// pass role string, e.g. requireRole('SL')
function requireRole(role) {
  return function (req, res, next) {
    if (!req.user || req.user.role !== role) return res.status(403).json({ error: `${role} role required` });
    next();
  };
}

module.exports = { requireAuth, requireRole, JWT_SECRET };
