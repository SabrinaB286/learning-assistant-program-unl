'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const { supabase } = require('../lib/supabase');
const { requireAuth, requireRole, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

/* ---------- rate limits ---------- */
const loginLimiter   = rateLimit({ windowMs: 10 * 60 * 1000, max: 50 });
const signupLimiter  = rateLimit({ windowMs: 60 * 60 * 1000, max: 30 });
const changePwLimiter= rateLimit({ windowMs: 10 * 60 * 1000, max: 30 });

/* ---------- helpers ---------- */
function signStaffToken({ nuid, role, name }) {
  return jwt.sign({ kind: 'staff', nuid, role, name }, JWT_SECRET, { expiresIn: '8h' });
}
function signStudentToken({ id, email, name }) {
  return jwt.sign({ kind: 'student', id, email, name }, JWT_SECRET, { expiresIn: '8h' });
}
function s(v, max = 200) { return String(v || '').trim().slice(0, max); }

/* ---------- POST /api/auth/login ---------- */
router.post('/login', loginLimiter, async (req, res) => {
  const login = s(req.body.login, 120);  // NUID or email
  const password = String(req.body.password || '');
  if (!login || !password) return res.status(400).json({ error: 'login and password required' });

  // STAFF: try NUID then email
  {
    let { data: staffRow } = await supabase
      .from('staff').select('nuid,name,role,password_hash,is_active').eq('nuid', login).single();
    if (!staffRow) {
      const r = await supabase
        .from('staff').select('nuid,name,role,password_hash,is_active').eq('email', login).single();
      staffRow = r.data;
    }
    if (staffRow && staffRow.is_active !== false && staffRow.password_hash) {
      const ok = await bcrypt.compare(password, staffRow.password_hash);
      if (ok) {
        await supabase.from('staff').update({ last_login: new Date().toISOString() }).eq('nuid', staffRow.nuid);
        return res.json({
          token: signStaffToken(staffRow),
          user: { kind: 'staff', nuid: staffRow.nuid, name: staffRow.name, role: staffRow.role }
        });
      }
    }
  }

  // STUDENT: email then nuid
  {
    let { data: row } = await supabase
      .from('students').select('id,email,name,status,password_hash').eq('email', login).single();
    if (!row) {
      const r = await supabase
        .from('students').select('id,email,name,status,password_hash').eq('nuid', login).single();
      row = r.data;
    }
    if (row && row.status === 'approved') {
      const ok = await bcrypt.compare(password, row.password_hash);
      if (ok) {
        return res.json({
          token: signStudentToken(row),
          user: { kind: 'student', id: row.id, email: row.email, name: row.name }
        });
      }
    }
  }

  res.status(401).json({ error: 'Invalid credentials' });
});

/* ---------- POST /api/auth/student/signup ---------- */
router.post('/student/signup', signupLimiter, async (req, res) => {
  const email = s(req.body.email, 200).toLowerCase();
  const name  = s(req.body.name, 120);
  const nuid  = s(req.body.nuid, 32);
  const class_year = s(req.body.class_year, 40);  // now dropdown on the front-end
  const password   = String(req.body.password || '');
  const courses    = Array.isArray(req.body.courses) ? req.body.courses.map(c => s(c, 120)).filter(Boolean) : [];

  if (!email || !name || !password) return res.status(400).json({ error: 'email, name, password required' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 chars' });

  const password_hash = await bcrypt.hash(password, 12);

  const { data, error } = await supabase.from('students').insert([{
    email, name, nuid: nuid || null, class_year, password_hash, status: 'pending'
  }]).select('id').single();

  if (error) return res.status(409).json({ error: 'email or nuid already exists' });

  if (courses.length) {
    const rows = courses.map(c => ({ student_id: data.id, course: c }));
    await supabase.from('student_courses').insert(rows);
  }
  res.status(201).json({ ok: true, message: 'Submitted for approval' });
});

/* ---------- GET /api/auth/students/pending  (SL only) ---------- */
router.get('/students/pending', requireAuth, requireRole('SL'), async (_req, res) => {
  const { data, error } = await supabase
    .from('students')
    .select('id,email,name,nuid,class_year,created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.post('/students/:id/approve', requireAuth, requireRole('SL'), async (req, res) => {
  const sid = Number(req.params.id);
  const approver = req.user.nuid;
  const { error } = await supabase.from('students')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: approver })
    .eq('id', sid);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.post('/students/:id/reject', requireAuth, requireRole('SL'), async (req, res) => {
  const sid = Number(req.params.id);
  const approver = req.user.nuid;
  const { error } = await supabase.from('students')
    .update({ status: 'rejected', approved_at: new Date().toISOString(), approved_by: approver })
    .eq('id', sid);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

/* ---------- POST /api/auth/change-password  (auth required) ---------- */
router.post('/change-password', requireAuth, changePwLimiter, async (req, res) => {
  const current = String(req.body.current_password || '');
  const next = String(req.body.new_password || '');

  if (!next || next.length < 8) {
    return res.status(400).json({ error: 'new_password must be at least 8 characters' });
  }

  if (req.user.kind === 'staff') {
    const { data: row, error } = await supabase
      .from('staff').select('password_hash').eq('nuid', req.user.nuid).single();
    if (error || !row || !row.password_hash) return res.status(400).json({ error: 'No existing password to change' });

    const ok = await bcrypt.compare(current, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password incorrect' });

    const hash = await bcrypt.hash(next, 12);
    const { error: e2 } = await supabase.from('staff').update({ password_hash: hash }).eq('nuid', req.user.nuid);
    if (e2) return res.status(500).json({ error: e2.message });
    return res.json({ ok: true, message: 'Password updated. Please log in again.' });
  }

  if (req.user.kind === 'student') {
    const { data: row, error } = await supabase
      .from('students').select('password_hash').eq('id', req.user.id).single();
    if (error || !row || !row.password_hash) return res.status(400).json({ error: 'No existing password to change' });

    const ok = await bcrypt.compare(current, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password incorrect' });

    const hash = await bcrypt.hash(next, 12);
    const { error: e2 } = await supabase.from('students').update({ password_hash: hash }).eq('id', req.user.id);
    if (e2) return res.status(500).json({ error: e2.message });
    return res.json({ ok: true, message: 'Password updated. Please log in again.' });
  }

  res.status(400).json({ error: 'Unsupported account type' });
});

module.exports = router;
