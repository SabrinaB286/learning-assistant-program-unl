'use strict';

const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const { requireAuth, requireRole } = require('../middleware/auth');

const HUSKERS_RE = /^[A-Za-z0-9._%+-]+@huskers\.unl\.edu$/i;
const ALLOWED_TYPES = new Set(['office_hour','lab_time']);
const ALLOWED_DAYS  = new Set(['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);

function forbid(res){ return res.status(403).json({ error: 'Forbidden' }); }
async function getRole(nuid) {
  if (!nuid) return null;
  const { data } = await supabase.from('staff').select('role').eq('nuid', nuid).single();
  return data?.role || null;
}
async function getStaffWithCourses(nuid) {
  const { data, error } = await supabase.from('v_staff_with_courses').select('*').eq('nuid', nuid).single();
  if (error) throw error;
  return data;
}

/* ---------------- Public directory ---------------- */
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('v_staff_with_courses')
    .select('*')
    .order('name', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

/* ---------------- View schedules with role rules ---------------- */
router.get('/:nuid/schedule', requireAuth, async (req, res) => {
  const target = req.params.nuid;
  const requester = req.user;

  let canView = false;
  if (requester.kind === 'staff') {
    if (requester.nuid === target) canView = true;
    const role = await getRole(requester.nuid);
    if (role === 'SL') canView = true;
    if (!canView && role === 'CL') {
      const { data: pairs } = await supabase
        .from('cl_assigned_las').select('la_nuid').eq('cl_nuid', requester.nuid);
      if (pairs?.some(r => r.la_nuid === target)) canView = true;
    }
  }
  if (!canView) return forbid(res);

  const { data, error } = await supabase
    .from('schedule')
    .select('id,type,day,start_time,end_time,location,course')
    .eq('staff_nuid', target)
    .order('day', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

/* ---------------- SL admin: create/update/delete staff ---------------- */
router.post('/', requireAuth, requireRole('SL'), async (req, res) => {
  const { nuid, name, role, email, password, courses = [] } = req.body || {};
  if (!nuid || !name || !role) return res.status(400).json({ error: 'nuid, name, role required' });
  if (email && !HUSKERS_RE.test(String(email).toLowerCase())) {
    return res.status(400).json({ error: 'email must be @huskers.unl.edu' });
  }

  const patch = {
    nuid: String(nuid).trim(),
    name: String(name).trim(),
    role: String(role).trim(),
    email: email ? String(email).toLowerCase().trim() : null
  };

  if (password) {
    const bcrypt = require('bcryptjs');
    patch.password_hash = await bcrypt.hash(String(password), 12);
  }

  const { error } = await supabase.from('staff').insert([patch]);
  if (error) return res.status(500).json({ error: error.message });

  if (Array.isArray(courses) && courses.length) {
    const rows = courses.map(course => ({ staff_nuid: patch.nuid, course: String(course).trim() }));
    const { error: e2 } = await supabase.from('staff_courses').insert(rows);
    if (e2) return res.status(500).json({ error: e2.message });
  }

  const created = await getStaffWithCourses(patch.nuid).catch(() => null);
  res.status(201).json(created);
});

router.put('/:nuid', requireAuth, requireRole('SL'), async (req, res) => {
  const nuid = req.params.nuid;
  const { name, role, email, courses, reset_password_to } = req.body || {};
  const patch = {};
  if (name) patch.name = String(name).trim();
  if (role) patch.role = String(role).trim();
  if (email !== undefined) {
    if (email && !HUSKERS_RE.test(String(email).toLowerCase())) {
      return res.status(400).json({ error: 'email must be @huskers.unl.edu' });
    }
    patch.email = email ? String(email).toLowerCase().trim() : null;
  }
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
      const rows = courses.map(course => ({ staff_nuid: nuid, course: String(course).trim() }));
      const { error: insErr } = await supabase.from('staff_courses').insert(rows);
      if (insErr) return res.status(500).json({ error: insErr.message });
    }
  }

  const updated = await getStaffWithCourses(nuid).catch(() => null);
  res.json(updated);
});

router.delete('/:nuid', requireAuth, requireRole('SL'), async (req, res) => {
  const { error } = await supabase.from('staff').delete().eq('nuid', req.params.nuid);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

/* ---------------- Staff self-service schedule: add / delete ---------------- */
// Add one entry for the logged-in staff member
router.post('/me/schedule', requireAuth, async (req, res) => {
  if (req.user.kind !== 'staff') return forbid(res);

  const body = req.body || {};
  const type = String(body.type || '').trim();
  const day  = String(body.day  || '').trim();
  const start = String(body.start || '').trim();  // HH:MM
  const end   = String(body.end   || '').trim();
  const location = body.location ? String(body.location).trim() : null;
  const course   = body.course ? String(body.course).trim() : null;

  // Basic validation
  if (!ALLOWED_TYPES.has(type)) return res.status(400).json({ error: 'type must be office_hour or lab_time' });
  if (!ALLOWED_DAYS.has(day))   return res.status(400).json({ error: 'day must be Mon/Tue/Wed/Thu/Fri/Sat/Sun' });
  const timeRe = /^\d{2}:\d{2}$/;
  if (!timeRe.test(start) || !timeRe.test(end)) return res.status(400).json({ error: 'start/end must be HH:MM' });
  if (start >= end) return res.status(400).json({ error: 'start must be before end' });

  const { data, error } = await supabase.from('schedule').insert([{
    staff_nuid: req.user.nuid,
    type, day, start_time: start, end_time: end, location, course
  }]).select('id,type,day,start_time,end_time,location,course').single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Delete one entry that belongs to the logged-in staff member
router.delete('/me/schedule/:id', requireAuth, async (req, res) => {
  if (req.user.kind !== 'staff') return forbid(res);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });

  // ensure it belongs to them
  const { data: row } = await supabase
    .from('schedule')
    .select('id')
    .eq('id', id)
    .eq('staff_nuid', req.user.nuid)
    .single();

  if (!row) return res.status(404).json({ error: 'not found' });

  const { error } = await supabase.from('schedule').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

/* ---------------- SL: assign LAs to a CL ---------------- */
router.put('/cl/:clNuid/assign', requireAuth, requireRole('SL'), async (req, res) => {
  const clNuid = req.params.clNuid;
  const laNuids = Array.isArray(req.body?.la_nuids) ? req.body.la_nuids : [];

  const { error: delErr } = await supabase.from('cl_assigned_las').delete().eq('cl_nuid', clNuid);
  if (delErr) return res.status(500).json({ error: delErr.message });

  if (laNuids.length) {
    const rows = laNuids.map(n => ({ cl_nuid: clNuid, la_nuid: String(n).trim() }));
    const { error: insErr } = await supabase.from('cl_assigned_las').insert(rows);
    if (insErr) return res.status(500).json({ error: insErr.message });
  }

  const { data, error } = await supabase.from('cl_assigned_las').select('*').eq('cl_nuid', clNuid);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

module.exports = router;
