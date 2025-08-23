'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const { supabase } = require('../lib/supabase');
const { requireAuth, requireRole, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

/* ---------- rate limits ---------- */
const loginLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 50 });
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30 });

/* ---------- helpers ---------- */
function signStaffToken({ nuid, role, name }) {
  return jwt.sign({ kind: 'staff', nuid, role, name }, JWT_SECRET, { expiresIn: '8h' });
}
function signStudentToken({ id, email, name }) {
  return jwt.sign({ kind: 'student', id, email, name }, JWT_SECRET, { expiresIn: '8h' });
}
function sanitizeStr(s, max = 200) {
  return String(s || '').trim().slice(0, max);
}

/* ---------- POST /api/auth/login ---------- */
router.post('/login', loginLimiter, async (req, res) => {
  const login = sanitizeStr(req.body.login, 120);   // NUID or email
  const password = String(req.body.password || '');

  if (!login || !password) return res.status(400).json({ error: 'login and password required' });

  // 1) Try staff (by NUID first, then email)
  {
    let q = supabase.from('staff').select('nuid, name, role, password_hash, is_active').eq('nuid', login).single();
    let { data: staffRow, error } = await q;
    if (error || !staffRow) {
      const res2 = await supabase.from('staff').select('nuid, name, role, password_hash, is_active').eq('email', login).single();
      staffRow = res2.data;
    }
    if (staffRow && staffRow.is_active !== false && staffRow.password_hash) {
      const ok = await bcrypt.compare(password, staffRow.password_hash);
      if (ok) {
        await supabase.from('staff').update({ last_login: new Date().toISOString() }).eq('nuid', staffRow.nuid);
        const token = signStaffToken(staffRow);
        // return a minimal profile (never include password_hash)
        return res.json({ token, user: { kind: 'staff', nuid: staffRow.nuid, name: staffRow.name, role: staffRow.role } });
      }
    }
  }

  // 2) Try students (by email, or NUID if you collect it)
  {
    let row = null;
    let { data, error } = await supabase.from('students')
      .select('id, email, name, status, password_hash')
      .eq('email', login).single();
    row = (!error && data) ? data : row;

    if (!row && login) {
      const byNuid = await supabase.from('students')
        .select('id, email, name, status, password_hash')
        .eq('nuid', login).single();
      row = byNuid.data || null;
    }

    if (row && row.status === 'approved') {
      const ok = await bcrypt.compare(password, row.password_hash);
      if (ok) {
        const token = signStudentToken(row);
        return res.json({ token, user: { kind: 'student', id: row.id, email: row.email, name: row.name } });
      }
    }
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

/* ---------- POST /api/auth/student/signup ---------- */
router.post('/student/signup', signupLimiter, async (req, res) => {
  const email = sanitizeStr(req.body.email, 200).toLowerCase();
  const name = sanitizeStr(req.body.name, 120);
  const nuid = sanitizeStr(req.body.nuid, 32);
  const class_year = sanitizeStr(req.body.class_year, 40);
  const password = String(req.body.password || '');
  const courses = Array.isArray(req.body.courses) ? req.body.courses.map(c => sanitizeStr(c, 120)).filter(Boolean) : [];

  if (!email || !name || !password) return res.status(400).json({ error: 'email, name, password required' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 chars' });

  const password_hash = await bcrypt.hash(password, 12);

  // create pending student
  const { data, error } = await supabase.from('students').insert([{
    email, name, nuid: nuid || null, class_year, password_hash, status: 'pending'
  }]).select('id').single();

  if (error) return res.status(409).json({ error: 'email or nuid already exists' });

  if (courses.length) {
    const rows = courses.map(c => ({ student_id: data.id, course: c }));
    await supabase.from('student_courses').insert(rows);
  }

  return res.status(201).json({ ok: true, message: 'Submitted for approval' });
});

/* ---------- SL-only: review queue ---------- */
router.get('/students/pending', requireAuth, requireRole('SL'), async (_req, res) => {
  const { data, error } = await supabase
    .from('students')
    .select('id, email, name, nuid, class_year, created_at')
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

module.exports = router;
