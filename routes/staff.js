// routes/staff.js
'use strict';

const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase'); // adjust path if needed

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

function forbid(res) {
  return res.status(403).json({ error: 'Forbidden' });
}

// ----- endpoints -----

// List staff directory (public read)
router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('v_staff_with_courses')
    .select('*')
    .order('name', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Login by NUID (simple lookup)
router.post('/login', async (req, res) => {
  const { nuid } = req.body || {};
  if (!nuid) return res.status(400).json({ error: 'nuid required' });
  const { data, error } = await supabase
    .from('v_staff_with_courses')
    .select('*')
    .eq('nuid', nuid)
    .single();
  if (error || !data) return res.status(401).json({ success: false, message: 'Invalid NUID' });
  res.json({ success: true, user: data });
});

// Get schedule (self, SL can view anyone, CL can view assigned LAs)
router.get('/:nuid/schedule', async (req, res) => {
  const target = req.params.nuid;
  const requestor = req.headers['x-user-nuid'] || '';
  const role = await getRole(requestor);

  let canView = requestor === target || role === 'SL';
  if (!canView && role === 'CL') {
    const { data, error } = await supabase
      .from('cl_assigned_las')
      .select('la_nuid')
      .eq('cl_nuid', requestor);
    if (!error && data?.some(r => r.la_nuid === target)) canView = true;
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

// CL: list their LAs; SL can fetch any CL’s LAs
router.get('/cl/:clNuid/las', async (req, res) => {
  const requestor = req.headers['x-user-nuid'] || '';
  const role = await getRole(requestor);
  if (role !== 'CL' && role !== 'SL') return forbid(res);

  const clNuid = req.params.clNuid;
  if (role === 'CL' && requestor !== clNuid) return forbid(res);

  const { data: pairs, error } = await supabase
    .from('cl_assigned_las')
    .select('la_nuid')
    .eq('cl_nuid', clNuid);
  if (error) return res.status(500).json({ error: error.message });

  const laIds = (pairs || []).map(p => p.la_nuid);
  if (!laIds.length) return res.json([]);

  const { data: laRows, error: e2 } = await supabase
    .from('v_staff_with_courses')
    .select('*')
    .in('nuid', laIds);
  if (e2) return res.status(500).json({ error: e2.message });

  res.json(laRows);
});

// SL: create staff
router.post('/', async (req, res) => {
  const requestor = req.headers['x-user-nuid'] || '';
  const role = await getRole(requestor);
  if (role !== 'SL') return forbid(res);

  const { nuid, name, role: newRole, courses = [] } = req.body || {};
  if (!nuid || !name || !newRole) return res.status(400).json({ error: 'nuid, name, role required' });

  const { error } = await supabase.from('staff').insert([{ nuid, name, role: newRole }]);
  if (error) return res.status(500).json({ error: error.message });

  if (Array.isArray(courses) && courses.length) {
    const rows = courses.map(course => ({ staff_nuid: nuid, course }));
    const { error: e2 } = await supabase.from('staff_courses').insert(rows);
    if (e2) return res.status(500).json({ error: e2.message });
  }

  const created = await getStaffByNUID(nuid).catch(() => null);
  res.status(201).json(created);
});

// SL: update staff (role/name/courses)
router.put('/:nuid', async (req, res) => {
  const requestor = req.headers['x-user-nuid'] || '';
  const role = await getRole(requestor);
  if (role !== 'SL') return forbid(res);

  const nuid = req.params.nuid;
  const { name, role: newRole, courses } = req.body || {};

  if (name || newRole) {
    const { error } = await supabase
      .from('staff')
      .update({ ...(name && { name }), ...(newRole && { role: newRole }) })
      .eq('nuid', nuid);
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

// SL: delete staff
router.delete('/:nuid', async (req, res) => {
  const requestor = req.headers['x-user-nuid'] || '';
  const role = await getRole(requestor);
  if (role !== 'SL') return forbid(res);

  const { error } = await supabase.from('staff').delete().eq('nuid', req.params.nuid);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

// SL: replace schedule (bulk)
router.put('/:nuid/schedule', async (req, res) => {
  const requestor = req.headers['x-user-nuid'] || '';
  const role = await getRole(requestor);
  if (role !== 'SL') return forbid(res);

  const staffNuid = req.params.nuid;
  const entries = Array.isArray(req.body) ? req.body : [];

  const { error: delErr } = await supabase.from('schedule').delete().eq('staff_nuid', staffNuid);
  if (delErr) return res.status(500).json({ error: delErr.message });

  if (entries.length) {
    const rows = entries.map(e => ({
      staff_nuid: staffNuid,
      type: e.type,           // 'office_hour' | 'lab_time'
      day: e.day,             // 'Mon', 'Tue', ...
      start_time: e.start,    // '13:00'
      end_time: e.end,        // '15:00'
      location: e.location || null,
      course: e.course || null
    }));
    const { error: insErr } = await supabase.from('schedule').insert(rows);
    if (insErr) return res.status(500).json({ error: insErr.message });
  }

  const { data, error: selErr } = await supabase.from('schedule').select('*').eq('staff_nuid', staffNuid);
  if (selErr) return res.status(500).json({ error: selErr.message });
  res.json(data || []);
});

// SL: assign LAs to a CL (replace full list)
router.put('/cl/:clNuid/assign', async (req, res) => {
  const requestor = req.headers['x-user-nuid'] || '';
  const role = await getRole(requestor);
  if (role !== 'SL') return forbid(res);

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
