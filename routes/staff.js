// routes/staff.js
'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../lib/supabase');

const router = express.Router();
const APP_JWT_SECRET = process.env.APP_JWT_SECRET || 'dev-secret';

// --- auth helpers ---
function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, APP_JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
function requireSL(req, res, next) {
  if (req.user?.role !== 'SL') return res.status(403).json({ error: 'SL only' });
  next();
}

// --- POST /api/staff : create staff + map courses (SL only) ---
router.post('/', requireAuth, requireSL, async (req, res) => {
  const { nuid, name, role, email, temp_password, courses } = req.body || {};
  if (!nuid || !name || !role || !Array.isArray(courses) || !courses.length) {
    return res.status(400).json({ error: 'nuid, name, role, courses required' });
  }
  if (email && !/@huskers\.unl\.edu$/i.test(email)) {
    return res.status(400).json({ error: 'Email must be @huskers.unl.edu' });
  }

  const pwd = temp_password && String(temp_password).length >= 6 ? String(temp_password) : 'ChangeMe!2025';
  const password_hash = await bcrypt.hash(pwd, 10);

  // 1) upsert staff
  {
    const { error } = await supabase
      .from('staff')
      .upsert([{ nuid, name, role, email: email || null, password_hash }], { onConflict: 'nuid' });
    if (error) return res.status(500).json({ error: 'staff upsert failed: ' + error.message });
  }

  // 2) upsert courses table (creates if new)
  const courseRows = courses.map(code => ({ code }));
  {
    const { error } = await supabase.from('courses').upsert(courseRows, { onConflict: 'code' });
    if (error) return res.status(500).json({ error: 'courses upsert failed: ' + error.message });
  }

  // 3) map staff_courses
  const mapRows = courses.map(code => ({ nuid, course_code: code }));
  {
    const { error } = await supabase.from('staff_courses').upsert(mapRows, { onConflict: 'nuid,course_code' });
    if (error) return res.status(500).json({ error: 'staff_courses upsert failed: ' + error.message });
  }

  return res.json({ ok: true });
});

// --- GET /api/staff/:nuid/schedule : read schedule entries for a staff member ---
router.get('/:nuid/schedule', requireAuth, async (req, res) => {
  const { nuid } = req.params;
  if (!nuid) return res.status(400).json({ error: 'nuid required' });
  const { data, error } = await supabase
    .from('staff_schedules')
    .select('*')
    .eq('nuid', nuid)
    .order('day', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// --- POST /api/staff/me/schedule : create schedule for the logged-in staff ---
router.post('/me/schedule', requireAuth, async (req, res) => {
  const u = req.user;
  if (u.kind !== 'staff') return res.status(403).json({ error: 'staff only' });

  const { type, day, start, end, location, course } = req.body || {};
  if (!type || !day || !start || !end) return res.status(400).json({ error: 'type, day, start, end required' });

  // ensure course exists if provided
  if (course) {
    const { error: cErr } = await supabase.from('courses').upsert([{ code: course }], { onConflict: 'code' });
    if (cErr) return res.status(500).json({ error: 'course upsert failed: ' + cErr.message });
  }

  const payload = {
    nuid: u.nuid,
    type,
    day,
    start_time: start,
    end_time: end,
    location: location || null,
    course_code: course || null
  };

  const { data, error } = await supabase.from('staff_schedules').insert([payload]).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// --- DELETE /api/staff/me/schedule/:id : delete one entry owned by the user ---
router.delete('/me/schedule/:id', requireAuth, async (req, res) => {
  const u = req.user;
  if (u.kind !== 'staff') return res.status(403).json({ error: 'staff only' });

  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'id required' });

  // ensure the row belongs to the user
  const { data: row, error: gErr } = await supabase
    .from('staff_schedules')
    .select('id,nuid')
    .eq('id', id)
    .single();
  if (gErr) return res.status(404).json({ error: 'schedule not found' });
  if (row.nuid !== u.nuid) return res.status(403).json({ error: 'forbidden' });

  const { error } = await supabase.from('staff_schedules').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
