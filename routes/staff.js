'use strict';

const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const { requireAuth, requireRole } = require('../middleware/auth');

// ----- helpers -----
async function getRole(nuid) {
  if (!nuid) return null;
  const { data, error } = await supabase
    .from('staff')
    .select('role')
    .eq('nuid', nuid)
    .single();
  if (error) return null;
  return data?.role || null;
}
async function getStaffByNUID(nuid) {
  const { data, error } = await supabase
    .from('v_staff_with_courses')
    .select('*')
    .eq('nuid', nuid)
    .single();
  if (error) throw error;
  return data;
}
function forbid(res) { return res.status(403).json({ error: 'Forbidden' }); }

// ----- directory (public read) -----
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('v_staff_with_courses')
    .select('*')
    .order('name', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ----- schedule viewing (auth required for private viewing rules) -----
router.get('/:nuid/schedule', requireAuth, async (req, res) => {
  const target = req.params.nuid;
  const requester = req.user;

  let canView = false;
  if (requester.kind === 'staff') {
    if (requester.nuid === target) canView = true;
    const role = await getRole(requester.nuid);
    if (role === 'SL') canView = true;
    if (!canView && role === 'CL') {
      const { data: pairs, error } = await supabase
        .from('cl_assigned_las')
        .select('la_nuid')
        .eq('cl_nuid', requester.nuid);
      if (!error && pairs?.some(r => r.la_nuid === target)) canView = true;
    }
  }
  if (requester.kind === 'student') {
    // students can only view their own data; they don't have a staff NUID
    canView = false;
  }
  if (!canView) return forbid(res);

  const { data, error } = await supabase
    .from('schedule')
    .select('*')
    .eq('staff_nuid', target)
    .order('day', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// ===== SL ADMIN OPS =====

// create staff
router.post('/', requireAuth, requireRole('SL'), async (req, res) => {
  const { nuid, name, role, email, password, courses = [] } = req.body || {};
  if (!nuid || !name || !role) return res.status(400).json({ error: 'nuid, name, role required' });

  let password_hash = null;
  if (password) {
    const bcrypt = require('bcryptjs');
    password_hash = await bcrypt.hash(String(password), 12);
  }

  const { error } = await supabase.from('staff').insert([{ nuid, name, role, email: email || null, password_hash }]);
  if (error) return res.status(500).json({ error: error.message });

  if (courses.length) {
    const rows = courses.map(course => ({ staff_nuid: nuid, course }));
    const { error: e2 } = await supabase.from('staff_courses').insert(rows);
    if (e2) return res.status(500).json({ error: e2.message });
  }

  const created = await getStaffByNUID(nuid).catch(() => null);
  res.status(201).json(created);
});

// update staff (role/name/email/courses; optionally reset password)
router.put('/:nuid', requireAuth, requireRole('SL'), async (req, res) => {
  const nuid = req.params.nuid;
  const { name, role, email, courses, reset_password_to } = req.body || {};

  const patch = {};
  if (name) patch.name = name;
  if (role) patch.role = role;
  if (email !== undefined) patch.email = email || null;

  if (reset_password_to) {
    const bcrypt = require('bcryptjs');
    patch.password_hash = await bcrypt.hash(String(reset_password_to), 12);
  }

  if (Object.keys(patch).length) {
    const { error } = await supabase.from('staff').update(patch).eq('nuid', nuid);
    if (error) return res.status(500).json({ error: error.message });
  }

  if (Array.isArray(courses)) {
    const { error: delErr } = await supabase.from('staff_courses').delete().eq('staff_nuid', nuid);
    if (delErr) return res.status(500).json({ error: delErr.message });
    if (courses.length) {
      const rows = courses.map(course => ({ staff_nuid: nuid, course }));
      const { error: insErr } = await supabase.from('staff_courses').insert(rows);
      if (insErr) return res.status(500).json({ error: insErr.message });
    }
  }

  const updated = await getStaffByNUID(nuid).catch(() => null);
  res.json(updated);
});

// delete staff
router.delete('/:nuid', requireAuth, requireRole('SL'), async (req, res) => {
  const { error } = await supabase.from('staff').delete().eq('nuid', req.params.nuid);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

// replace schedule (bulk)
router.put('/:nuid/schedule', requireAuth, requireRole('SL'), async (req, res) => {
  const staffNuid = req.params.nuid;
  const entries = Array.isArray(req.body) ? req.body : [];

  const { error: delErr } = await supabase.from('schedule').delete().eq('staff_nuid', staffNuid);
  if (delErr) return res.status(500).json({ error: delErr.message });

  if (entries.length) {
    const rows = entries.map(e => ({
      staff_nuid: staffNuid,
      type: e.type, day: e.day, start_time: e.start, end_time: e.end,
      location: e.location || null, course: e.course || null
    }));
    const { error: insErr } = await supabase.from('schedule').insert(rows);
    if (insErr) return res.status(500).json({ error: insErr.message });
  }

  const { data, error: selErr } = await supabase.from('schedule').select('*').eq('staff_nuid', staffNuid);
  if (selErr) return res.status(500).json({ error: selErr.message });
  res.json(data || []);
});

// assign LAs to a CL
router.put('/cl/:clNuid/assign', requireAuth, requireRole('SL'), async (req, res) => {
  const clNuid = req.params.clNuid;
  const laNuids = Array.isArray(req.body?.la_nuids) ? req.body.la_nuids : [];

  const { error: delErr } = await supabase.from('cl_assigned_las').delete().eq('cl_nuid', clNuid);
  if (delErr) return res.status(500).json({ error: delErr.message });

  if (laNuids.length) {
    const rows = laNuids.map(n => ({ cl_nuid: clNuid, la_nuid: n }));
    const { error: insErr } = await supabase.from('cl_assigned_las').insert(rows);
    if (insErr) return res.status(500).json({ error: insErr.message });
  }

  const { data, error } = await supabase.from('cl_assigned_las').select('*').eq('cl_nuid', clNuid);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

module.exports = router;
