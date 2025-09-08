import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
// app.mjs — Express server (ESM) for Learning Assistant site
import dotenv from 'dotenv';
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
dotenv.config();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// ---------- Supabase ----------
const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabase = hasSupabase
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

// ---------- Middleware ----------
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'dev-secret'));

// attach req.user from signed cookie
app.use((req, _res, next) => {
  try {
    const raw = req.signedCookies?.lap_user;
    req.user = raw ? JSON.parse(raw) : null;
  } catch { req.user = null; }
  next();
});

// serve UI
app.use(express.static(path.join(__dirname, 'public')));

// helpers
const send = (res, status, payload) => res.status(status).json(payload);
const ensure = (cond, res, msg = 'Forbidden', code = 403) => { if (!cond) { res.status(code).json({ message: msg }); return false; } return true; };
const isEmail = v => /@/.test(String(v || '').toLowerCase());

// ---------- AUTH ----------
const authRouter = express.Router();

authRouter.post('/login', async (req, res) => {
  const { login, password } = req.body || {};
  if (!login || !password) return send(res, 400, { message: 'Missing login or password' });

  if (supabase) {
    // STAFF first
    const staffQuery = isEmail(login)
      ? supabase.from('staff').select('nuid,name,email,role,course,password_hash').eq('email', login).limit(1).maybeSingle()
      : supabase.from('staff').select('nuid,name,email,role,course,password_hash').eq('nuid', login).limit(1).maybeSingle();

    const { data: staff, error: staffErr } = await staffQuery;
    if (staffErr) return send(res, 500, { message: staffErr.message });

    if (staff?.password_hash && await bcrypt.compare(password, staff.password_hash)) {
      const user = { kind: 'staff', nuid: staff.nuid, name: staff.name, email: staff.email, role: staff.role, course: staff.course };
      res.cookie('lap_user', JSON.stringify(user), { httpOnly: true, sameSite: 'lax', signed: true });
      return send(res, 200, user);
    }

    // STUDENT
    const stuQuery = isEmail(login)
      ? supabase.from('students').select('id,nuid,name,email,course,approved,password_hash').eq('email', login).limit(1).maybeSingle()
      : supabase.from('students').select('id,nuid,name,email,course,approved,password_hash').eq('nuid', login).limit(1).maybeSingle();

    const { data: student, error: stuErr } = await stuQuery;
    if (stuErr) return send(res, 500, { message: stuErr.message });

    if (student?.approved && student.password_hash && await bcrypt.compare(password, student.password_hash)) {
      const user = { kind: 'student', id: student.id, nuid: student.nuid, name: student.name, email: student.email, course: student.course, role: 'student' };
      res.cookie('lap_user', JSON.stringify(user), { httpOnly: true, sameSite: 'lax', signed: true });
      return send(res, 200, user);
    }

    return send(res, 401, { message: 'Invalid credentials' });
  }

  // No DB — demo success so the UI doesn’t 404:
  const demoUser = { kind: 'staff', nuid: '00000000', name: 'Demo User', email: 'demo@huskers.unl.edu', role: 'SL', course: 'CSCE 101' };
  res.cookie('lap_user', JSON.stringify(demoUser), { httpOnly: true, sameSite: 'lax', signed: true });
  return send(res, 200, demoUser);
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie('lap_user');
  return send(res, 200, { ok: true });
});

app.use(['/api/auth', '/auth'], authRouter);

// ---------- FEEDBACK ----------
const feedbackRouter = express.Router();

feedbackRouter.post('/', async (req, res) => {
  const { course, type, rating, text, submitter, year } = req.body || {};
  if (!course || !type) return send(res, 400, { message: 'course and type are required' });

  if (supabase) {
    const { error } = await supabase.from('feedback').insert([{
      course, type, rating: rating ?? null, text: text || '', submitter: submitter || '', year: year || null
    }]);
    if (error) return send(res, 500, { message: error.message });
    return send(res, 200, { ok: true });
  }

  return send(res, 200, { ok: true });
});

feedbackRouter.get('/', async (_req, res) => {
  if (!supabase) return send(res, 200, []);
  const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) return send(res, 500, { message: error.message });
  return send(res, 200, data || []);
});

app.use(['/api/feedback', '/feedback'], feedbackRouter);

// ---------- OFFICE HOURS ----------
const officeRouter = express.Router();

officeRouter.get('/', async (_req, res) => {
  if (!supabase) {
    return send(res, 200, [
      { id: 1, course: 'CSCE 101', day: 'Mon', start: '14:00', end: '16:00', location: 'Avery 12', staff_name: 'Demo User' },
      { id: 2, course: 'CSCE 155A', day: 'Tue', start: '10:00', end: '12:00', location: 'Zoom', staff_name: 'Demo User' },
    ]);
  }

  const { data: schedules, error: sErr } = await supabase
    .from('staff_schedules')
    .select('id,staff_nuid,course,day,start,end,location')
    .order('course', { ascending: true });

  if (sErr) return send(res, 500, { message: sErr.message });

  let names = {};
  if (schedules?.length) {
    const nuids = [...new Set(schedules.map(s => s.staff_nuid).filter(Boolean))];
    if (nuids.length) {
      const { data: staffRows, error: nErr } = await supabase.from('staff').select('nuid,name').in('nuid', nuids);
      if (nErr) return send(res, 500, { message: nErr.message });
      staffRows.forEach(r => { names[r.nuid] = r.name; });
    }
  }

  const out = (schedules || []).map(s => ({
    id: s.id, course: s.course, day: s.day, start: s.start, end: s.end, location: s.location, staff_name: names[s.staff_nuid] || ''
  }));

  return send(res, 200, out);
});

// Students join a queue
officeRouter.post('/:id/queue', async (req, res) => {
  if (!ensure(req.user && req.user.kind === 'student', res, 'Only students can join the queue', 401)) return;

  if (!supabase) return send(res, 200, { ok: true });

  const scheduleId = Number(req.params.id);
  if (!scheduleId) return send(res, 400, { message: 'Invalid schedule id' });

  const { error } = await supabase
    .from('office_hour_queue')
    .insert([{ schedule_id: scheduleId, student_id: req.user.id }]);

  if (error) return send(res, 500, { message: error.message });
  return send(res, 200, { ok: true });
});

app.use(['/api/office-hours', '/office-hours'], officeRouter);

// ---------- STAFF SCHEDULE CRUD ----------
const schedRouter = express.Router();

schedRouter.get('/', async (req, res) => {
  if (!ensure(req.user && req.user.kind === 'staff', res, 'Not signed in as staff', 401)) return;

  if (!supabase) {
    return send(res, 200, [
      { id: 1, course: 'CSCE 101', day: 'Mon', start: '14:00', end: '16:00', location: 'Avery 12' }
    ]);
  }

  const { data, error } = await supabase
    .from('staff_schedules')
    .select('id,course,day,start,end,location')
    .eq('staff_nuid', req.user.nuid)
    .order('day', { ascending: true });

  if (error) return send(res, 500, { message: error.message });
  return send(res, 200, data || []);
});

schedRouter.post('/', async (req, res) => {
  if (!ensure(req.user && req.user.kind === 'staff', res, 'Not signed in as staff', 401)) return;

  const { course, day, start, end, location } = req.body || {};
  if (!course || !day || !start || !end) return send(res, 400, { message: 'Missing fields' });

  if (!supabase) return send(res, 200, { ok: true });

  const { error } = await supabase.from('staff_schedules').insert([{
    staff_nuid: req.user.nuid, course, day, start, end, location: location || null
  }]);
  if (error) return send(res, 500, { message: error.message });
  return send(res, 200, { ok: true });
});

schedRouter.put('/:id', async (req, res) => {
  if (!ensure(req.user && req.user.kind === 'staff', res, 'Not signed in as staff', 401)) return;
  const id = Number(req.params.id);
  const patch = (({ course, day, start, end, location }) => ({ course, day, start, end, location }))(req.body || {});
  Object.keys(patch).forEach(k => (patch[k] == null || patch[k] === '') && delete patch[k]);

  if (!supabase) return send(res, 200, { ok: true });

  const { error } = await supabase.from('staff_schedules').update(patch).eq('id', id).eq('staff_nuid', req.user.nuid);
  if (error) return send(res, 500, { message: error.message });
  return send(res, 200, { ok: true });
});

schedRouter.delete('/:id', async (req, res) => {
  if (!ensure(req.user && req.user.kind === 'staff', res, 'Not signed in as staff', 401)) return;
  const id = Number(req.params.id);

  if (!supabase) return send(res, 200, { ok: true });

  const { error } = await supabase.from('staff_schedules').delete().eq('id', id).eq('staff_nuid', req.user.nuid);
  if (error) return send(res, 500, { message: error.message });
  return send(res, 200, { ok: true });
});

app.use(['/api/staff/schedule', '/staff/schedule'], schedRouter);

// ---------- SL ADMIN ----------
const adminRouter = express.Router();

adminRouter.use((req, res, next) => {
  if (!ensure(req.user && req.user.kind === 'staff' && String(req.user.role).toUpperCase() === 'SL', res, 'SL role required', 401)) return;
  next();
});

adminRouter.get('/staff', async (_req, res) => {
  if (!supabase) return send(res, 200, []);
  const { data, error } = await supabase.from('staff').select('nuid,name,email,role,course').order('nuid', { ascending: true });
  if (error) return send(res, 500, { message: error.message });
  return send(res, 200, data || []);
});

adminRouter.post('/staff', async (req, res) => {
  if (!supabase) return send(res, 200, { ok: true });
  const { nuid, name, email, role, course, password } = req.body || {};
  if (!nuid || !name || !role) return send(res, 400, { message: 'nuid, name, role required' });
  let password_hash = null;
  if (password) password_hash = await bcrypt.hash(password, 10);
  const { error } = await supabase.from('staff').insert([{ nuid, name, email: email || null, role, course: course || null, password_hash }]);
  if (error) return send(res, 500, { message: error.message });
  return send(res, 200, { ok: true });
});

adminRouter.delete('/staff/:nuid', async (req, res) => {
  if (!supabase) return send(res, 200, { ok: true });
  const { error } = await supabase.from('staff').delete().eq('nuid', req.params.nuid);
  if (error) return send(res, 500, { message: error.message });
  return send(res, 200, { ok: true });
});

adminRouter.get('/students/pending', async (_req, res) => {
  if (!supabase) return send(res, 200, []);
  const { data, error } = await supabase.from('students').select('id,name,nuid,email,course,approved').eq('approved', false);
  if (error) return send(res, 500, { message: error.message });
  return send(res, 200, data || []);
});

adminRouter.post('/students/:id/approve', async (req, res) => {
  if (!supabase) return send(res, 200, { ok: true });
  const { error } = await supabase.from('students').update({ approved: true }).eq('id', req.params.id);
  if (error) return send(res, 500, { message: error.message });
  return send(res, 200, { ok: true });
});

adminRouter.post('/students/:id/reject', async (req, res) => {
  if (!supabase) return send(res, 200, { ok: true });
  const { error } = await supabase.from('students').delete().eq('id', req.params.id);
  if (error) return send(res, 500, { message: error.message });
  return send(res, 200, { ok: true });
});

app.use(['/api/admin', '/admin'], adminRouter);

// ---------- Health & Catch-all ----------
app.get('/healthz', (_req, res) => res.type('text').send('ok'));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth') || req.path.startsWith('/feedback') || req.path.startsWith('/office-hours') || req.path.startsWith('/staff') || req.path.startsWith('/admin')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on :${PORT} (hasSupabase=${hasSupabase})`);
});

