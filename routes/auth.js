// server/routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { supabase } = require('../supabase');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Helpers
function isEmail(v) {
  return typeof v === 'string' && v.includes('@');
}
function isNUID(v) {
  return /^\d{7,10}$/.test(String(v || '').trim());
}
function normalizeLogin(login) {
  const v = String(login || '').trim();
  if (isNUID(v)) return { kind: 'nuid', value: v };
  if (isEmail(v)) return { kind: 'email', value: v.toLowerCase() };
  // allow non-digit usernames as "email-ish" if they provided it
  return { kind: 'misc', value: v.toLowerCase() };
}

// Build a minimal user object for the client
function asClientUser(row, role = 'student') {
  return {
    id: row.id || row.nuid || row.email,
    nuid: row.nuid || null,
    email: row.email || null,
    name: row.name || row.full_name || 'User',
    role,
  };
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { login, id, nuid, email, password } = req.body || {};
    const credential = login ?? id ?? nuid ?? email;
    if (!credential || !password) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    const { kind, value } = normalizeLogin(credential);

    // 1) Try STAFF
    let staffQuery = supabase.from('staff').select('*').limit(1);
    if (kind === 'nuid') staffQuery = staffQuery.eq('nuid', value);
    else if (kind === 'email') staffQuery = staffQuery.eq('email', value);
    else {
      // best effort: match either
      staffQuery = staffQuery.or(`nuid.eq.${value},email.eq.${value}`);
    }

    const { data: staffRows, error: staffErr } = await staffQuery;
    if (staffErr) throw staffErr;

    if (staffRows && staffRows.length) {
      const row = staffRows[0];
      // Accept bcrypt hash in password_hash; fallback to plaintext 'password'
      const ok =
        (row.password_hash && (await bcrypt.compare(password, row.password_hash))) ||
        (row.password && row.password === password);

      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

      const role = row.role || 'LA';
      const user = asClientUser(row, role);
      const token = jwt.sign(
        { sub: String(user.id), role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: '12h' }
      );
      return res.json({ token, user });
    }

    // 2) (Optional) Try STUDENTS if you have a table for them.
    // Uncomment and adapt if/when you enable student accounts in DB.
    /*
    let studentQuery = supabase.from('students').select('*').limit(1);
    if (kind === 'email') studentQuery = studentQuery.eq('email', value);
    else studentQuery = studentQuery.eq('nuid', value);

    const { data: studentRows, error: studentErr } = await studentQuery;
    if (studentErr) throw studentErr;

    if (studentRows && studentRows.length) {
      const row = studentRows[0];
      const ok =
        (row.password_hash && (await bcrypt.compare(password, row.password_hash))) ||
        (row.password && row.password === password);

      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

      const user = asClientUser(row, 'student');
      const token = jwt.sign(
        { sub: String(user.id), role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: '12h' }
      );
      return res.json({ token, user });
    }
    */

    // Nothing matched
    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No token' });

    const payload = jwt.verify(token, JWT_SECRET);
    // Optionally, re-load user basics for fresh name/role
    let user = { id: payload.sub, name: payload.name, role: payload.role };

    if (isNUID(payload.sub)) {
      const { data, error } = await supabase
        .from('staff')
        .select('nuid,name,email,role')
        .eq('nuid', payload.sub)
        .limit(1);
      if (!error && data && data.length) {
        user = asClientUser(data[0], data[0].role || payload.role);
      }
    }
    return res.json({ user });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// POST /api/auth/logout  (no-op, kept for symmetry)
router.post('/logout', (_req, res) => {
  res.status(204).end();
});

module.exports = router;
