// server/routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { supabase } = require('../supabase');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function isEmail(v){ return typeof v === 'string' && v.includes('@'); }
function isNUID(v){ return /^\d{7,10}$/.test(String(v||'').trim()); }
function normalizeLogin(login){
  const v = String(login || '').trim();
  if (isNUID(v)) return { kind:'nuid', value:v };
  if (isEmail(v)) return { kind:'email', value:v.toLowerCase() };
  return { kind:'misc', value:v.toLowerCase() };
}
function asClientUser(row, role='student'){
  return {
    id: row.id || row.nuid || row.email,
    nuid: row.nuid || null,
    email: row.email || null,
    name: row.name || row.full_name || 'User',
    role,
  };
}

router.post('/login', async (req, res) => {
  try {
    const { login, id, nuid, email, password } = req.body || {};
    const credential = login ?? id ?? nuid ?? email;
    if (!credential || !password) return res.status(400).json({ message: 'Missing credentials' });

    const { kind, value } = normalizeLogin(credential);

    let staffQuery = supabase.from('staff').select('*').limit(1);
    if (kind === 'nuid') staffQuery = staffQuery.eq('nuid', value);
    else if (kind === 'email') staffQuery = staffQuery.eq('email', value);
    else staffQuery = staffQuery.or(`nuid.eq.${value},email.eq.${value}`);

    const { data: staffRows, error: staffErr } = await staffQuery;
    if (staffErr) throw staffErr;

    if (staffRows && staffRows.length) {
      const row = staffRows[0];
      const ok =
        (row.password_hash && (await bcrypt.compare(password, row.password_hash))) ||
        (row.password && row.password === password);

      if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

      const role = row.role || 'LA';
      const user = asClientUser(row, role);
      const token = jwt.sign({ sub:String(user.id), role:user.role, name:user.name }, JWT_SECRET, { expiresIn: '12h' });
      return res.json({ token, user });
    }

    return res.status(401).json({ message: 'Invalid credentials' });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'No token' });
    const payload = jwt.verify(token, JWT_SECRET);
    let user = { id: payload.sub, name: payload.name, role: payload.role };

    if (isNUID(payload.sub)) {
      const { data } = await supabase.from('staff').select('nuid,name,email,role').eq('nuid', payload.sub).limit(1);
      if (data && data.length) user = asClientUser(data[0], data[0].role || payload.role);
    }
    res.json({ user });
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
});

router.put('/password', async (req, res) => {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'No token' });
    const payload = jwt.verify(token, JWT_SECRET);
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Missing fields' });

    const { data: rows } = await supabase.from('staff').select('*').eq('nuid', payload.sub).limit(1);
    if (!rows || !rows.length) return res.status(404).json({ message: 'User not found' });

    const row = rows[0];
    const ok = row.password_hash && await bcrypt.compare(currentPassword, row.password_hash);
    if (!ok) return res.status(401).json({ message: 'Invalid current password' });

    const hash = await bcrypt.hash(newPassword, 10);
    const { error } = await supabase.from('staff').update({ password_hash: hash }).eq('nuid', row.nuid);
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('[auth/password]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/logout', (_req, res) => res.status(204).end());

module.exports = router;
