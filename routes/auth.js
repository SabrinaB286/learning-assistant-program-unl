// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

router.get('/ping', (req, res) => res.json({ ok: true }));

// POST /api/auth/login  { login: nuidOrEmail, password }
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body || {};
    if (!login || !password) return res.status(400).json({ error: 'Missing login or password' });

    const isEmail = /@/.test(login);
    let q = supabase.from('staff').select('nuid, name, role, email, password_hash').limit(1);
    q = isEmail ? q.eq('email', login) : q.eq('nuid', login);

    const { data: rows, error } = await q;
    if (error) throw error;
    const userRow = rows && rows[0];
    if (!userRow || !userRow.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, userRow.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const user = {
      nuid: userRow.nuid,
      name: userRow.name,
      role: userRow.role,
      email: userRow.email || null
    };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, user });
  } catch (err) {
    console.error('[auth/login] error', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me  (requires Authorization: Bearer)
const requireAuth = require('../middleware/auth');
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
