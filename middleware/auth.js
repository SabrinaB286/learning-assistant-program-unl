// middleware/auth.js — verify JWT
const jwt = require('jsonwebtoken');

module.exports = function requireAuth(req, res, next) {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { nuid, role, name, email }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports.requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  next();
};
