// app.js
// Express API + static site serving. Uses Supabase (service role) and JWT for auth.

import bcrypt from 'bcryptjs';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import express from 'express';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import path from 'path';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ---------- Security & body parsing ----------
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use(limiter);

// ---------- Supabase (server) ----------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------- JWT helpers ----------
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function issueToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Missing token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET); // {nuid?, email?, role}
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function staffRequired(req, res, next) {
  if (!req.user?.role || !['SL', 'CL', 'LA'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Staff only' });
  }
  next();
}

function slRequired(req, res, next) {
  if (req.user?.role !== 'SL') {
    return res.status(403).json({ message: 'SL only' });
  }
  next();
}

// ---------- STATIC ----------
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/feedback', express.static(path.join(__dirname, 'public/feedback')));
// serve browser modules in routes/ as public so the front-end can `import` them
app.use('/routes', express.static(path.join(__dirname, 'public/routes')));

// Root (single page)
app.get('/', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// ---------- AUTH ----------

// Login for staff (NUID/email) or approved students (email)
// Body: { login: string, password: string }
app.post('/api/auth/login', async (req, res) => {
  const { login, password } = req.body || {};
  if (!login || !password) {
    return res.status(400).json({ message: 'Missing login or password' });
  }

  // Try staff by NUID then email
  let user = null;
  let role = null;
  let nuid = null;
  let email = null;

  // STAFF (by NUID or email)
  {
    const isNUID = /^\d{7,10}$/.test(login);
    const staffQuery = isNUID
      ? sb.from('staff').select('*').eq('nuid', login).maybeSingle()
      : sb.from('staff').select('*').eq('email', login).maybeSingle();
    const { data: s, error: se } = await staffQuery;
    if (se) return res.status(500).json({ message: se.message });
    if (s) {
      const ok = await bcrypt.compare(password, s.password_hash || '');
      if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
      user = { name: s.name, nuid: s.nuid, email: s.email };
      role = s.role; // SL, CL, LA
      nuid = s.nuid;
      email = s.email;
    }
  }

  // STUDENT (by email) if not staff
  if (!user && /@/.test(login)) {
    const { data: st, error: ste } = await sb
      .from('students')
      .select('*')
      .eq('email', login)
      .maybeSingle();
    if (ste) return res.status(500).json({ message: ste.message });
    if (!st) return res.status(401).json({ message: 'Invalid credentials' });

    if (!st.approved) {
      return res.status(403).json({ message: 'Student not approved yet' });
    }
    const ok = await bcrypt.compare(password, st.password_hash || '');
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    user = { name: st.name, id: st.id, email: st.email, year: st.year };
    role = 'STUDENT';
    email = st.email;
  }

  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const token = issueToken({ nuid, email, role });
  return res.json({ token, user: { ...user, role } });
});

// Change password (any logged-in user)
app.put('/api/auth/password', authRequired, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Missing body' });
  }

  let table = null;
  let keyColumn = null;
  let keyValue = null;

  if (req.user.role === 'STUDENT') {
    table = 'students';
    keyColumn = 'email';
    keyValue = req.user.email;
  } else {
    table = 'staff';
    keyColumn = req.user.nuid ? 'nuid' : 'email';
    keyValue = req.user.nuid || req.user.email;
  }

  const { data: rec, error } = await sb
    .from(table)
    .select('*')
    .eq(keyColumn, keyValue)
    .maybeSingle();

  if (error || !rec) return res.status(400).json({ message: 'Account not found' });

  const ok = await bcrypt.compare(currentPassword, rec.password_hash || '');
  if (!ok) return res.status(401).json({ message: 'Invalid current password' });

  const newHash = await bcrypt.hash(newPassword, 10);
  const { error: ue } = await sb
    .from(table)
    .update({ password_hash: newHash })
    .eq(keyColumn, keyValue);

  if (ue) return res.status(500).json({ message: ue.message });
  return res.json({ ok: true });
});

// Student signup (pending)
app.post('/api/auth/register-student', async (req, res) => {
  const { email, name, year, class_code, password } = req.body || {};
  if (!email || !name || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const hash = await bcrypt.hash(password, 10);
  const { error } = await sb.from('students').insert({
    email,
    name,
    year: year || null,
    class_code: class_code || null,
    password_hash: hash,
    approved: false,
  });
  if (error) return res.status(400).json({ message: error.message });
  return res.json({ ok: true });
});

// ---------- SL: manage staff ----------
app.get('/api/staff', authRequired, slRequired, async (_req, res) => {
  const { data, error } = await sb.from('staff').select('nuid,name,email,role').order('name');
  if (error) return res.status(500).json({ message: error.message });
  return res.json(data || []);
});

app.post('/api/staff', authRequired, slRequired, async (req, res) => {
  const { nuid, name, email, role, tempPassword } = req.body || {};
  if (!nuid || !name || !role) {
    return res.status(400).json({ message: 'Missing fields' });
  }
  const hash = await bcrypt.hash(tempPassword || 'ChangeMe!2025', 10);
  const { error } = await sb.from('staff').insert({
    nuid, name, email: email || null, role, password_hash: hash,
  });
  if (error) return res.status(400).json({ message: error.message });
  return res.json({ ok: true });
});

app.delete('/api/staff/:nuid', authRequired, slRequired, async (req, res) => {
  const nuid = req.params.nuid;
  const { error } = await sb.from('staff').delete().eq('nuid', nuid);
  if (error) return res.status(400).json({ message: error.message });
  return res.json({ ok: true });
});

// ---------- SL: approve students ----------
app.get('/api/students/pending', authRequired, slRequired, async (_req, res) => {
  const { data, error } = await sb
    .from('students')
    .select('id,email,name,year,class_code,created_at')
    .eq('approved', false)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ message: error.message });
  return res.json(data || []);
});

app.post('/api/students/:id/approve', authRequired, slRequired, async (req, res) => {
  const id = Number(req.params.id);
  const { error } = await sb.from('students').update({ approved: true }).eq('id', id);
  if (error) return res.status(400).json({ message: error.message });
  return res.json({ ok: true });
});

app.delete('/api/students/:id', authRequired, slRequired, async (req, res) => {
  const id = Number(req.params.id);
  const { error } = await sb.from('students').delete().eq('id', id);
  if (error) return res.status(400).json({ message: error.message });
  return res.json({ ok: true });
});

// ---------- Staff profile ----------
app.get('/api/staff/me', authRequired, staffRequired, async (req, res) => {
  const key = req.user.nuid ? { nuid: req.user.nuid } : { email: req.user.email };
  const { data, error } = await sb.from('staff').select('nuid,name,email,role').match(key).maybeSingle();
  if (error || !data) return res.status(404).json({ message: 'Staff not found' });
  return res.json(data);
});

// ---------- Courses (for dropdowns) ----------
app.get('/api/courses', async (_req, res) => {
  const { data, error } = await sb.from('courses').select('code,title').order('code');
  if (error) return res.status(500).json({ message: error.message });
  return res.json(data || []);
});

// ---------- Office hours (public list) ----------
app.get('/api/office-hours', async (req, res) => {
  const course = (req.query.course || '').trim();
  let q = sb
    .from('staff_schedules')
    .select('id,nuid,day,start_time,end_time,type,location,course_code');

  if (course) q = q.eq('course_code', course);

  const { data, error } = await q.order('day', { ascending: true }).order('start_time', { ascending: true });
  if (error) return res.status(500).json({ message: error.message });

  // Attach staff name
  const nuids = [...new Set((data || []).map(d => d.nuid))];
  let names = {};
  if (nuids.length) {
    const { data: staff, error: se } = await sb
      .from('staff')
      .select('nuid,name')
      .in('nuid', nuids);
    if (se) return res.status(500).json({ message: se.message });
    staff?.forEach(s => (names[s.nuid] = s.name));
  }
  const result = (data || []).map(d => ({ ...d, staff_name: names[d.nuid] || d.nuid }));
  return res.json(result);
});

// ---------- Schedule CRUD (staff) ----------
app.get('/api/schedule/mine', authRequired, staffRequired, async (req, res) => {
  const { data, error } = await sb
    .from('staff_schedules')
    .select('*')
    .eq('nuid', req.user.nuid)
    .order('day', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) return res.status(500).json({ message: error.message });
  return res.json(data || []);
});

// Create or update
app.post('/api/schedule', authRequired, staffRequired, async (req, res) => {
  const { id, day, start_time, end_time, type, location, course_code } = req.body || {};
  if (!day || !start_time || !end_time || !type || !course_code) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // only owner (or SL) can modify
  if (id) {
    const { data: existing, error: ex } = await sb
      .from('staff_schedules')
      .select('nuid')
      .eq('id', id).maybeSingle();
    if (ex) return res.status(500).json({ message: ex.message });
    if (!existing) return res.status(404).json({ message: 'Schedule not found' });
    if (existing.nuid !== req.user.nuid && req.user.role !== 'SL') {
      return res.status(403).json({ message: 'Not owner' });
    }
  }

  const payload = { nuid: req.user.nuid, day, start_time, end_time, type, location: location || null, course_code };
  let result, error;
  if (id) {
    ({ data: result, error } = await sb.from('staff_schedules').update(payload).eq('id', id).select().maybeSingle());
  } else {
    ({ data: result, error } = await sb.from('staff_schedules').insert(payload).select().maybeSingle());
  }
  if (error) return res.status(400).json({ message: error.message });
  return res.json(result);
});

app.delete('/api/schedule/:id', authRequired, staffRequired, async (req, res) => {
  const id = Number(req.params.id);
  // ensure ownership or SL
  const { data: existing, error: ex } = await sb
    .from('staff_schedules')
    .select('nuid')
    .eq('id', id)
    .maybeSingle();
  if (ex) return res.status(500).json({ message: ex.message });
  if (!existing) return res.status(404).json({ message: 'Not found' });
  if (existing.nuid !== req.user.nuid && req.user.role !== 'SL') {
    return res.status(403).json({ message: 'Not owner' });
  }
  const { error } = await sb.from('staff_schedules').delete().eq('id', id);
  if (error) return res.status(400).json({ message: error.message });
  return res.json({ ok: true });
});

// ---------- Feedback (public insert) ----------
app.post('/api/feedback', async (req, res) => {
  const { course, type, rating, text, submitter, year, id_entered } = req.body || {};
  if (!type || !text) return res.status(400).json({ message: 'Missing required fields' });
  if (rating && (rating < 1 || rating > 5)) {
    return res.status(400).json({ message: 'Invalid rating' });
  }
  const { error } = await sb.from('feedback').insert({
    course: course || null,
    type,
    rating: rating || null,
    text,
    submitter: submitter || null,
    year: year || null,
    id_entered: id_entered || null,
  });
  if (error) return res.status(400).json({ message: error.message });
  return res.json({ ok: true });
});

// ---------- 404 fallback for API ----------
app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found' }));

// ---------- start ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
