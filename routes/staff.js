'use strict';

const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const { requireAuth, requireRole } = require('../middleware/auth');

const HUSKERS_RE = /^[A-Za-z0-9._%+-]+@huskers\.unl\.edu$/i;

// helpers
async function getRole(nuid) {
  if (!nuid) return null;
  const { data, error } = await supabase.from('staff').select('role').eq('nuid', nuid).single();
  if (error) return null;
  return data?.role || null;
}
async function getStaffByNUID(nuid) {
  const { data, error } = await supabase.from('v_staff_with_courses').select('*').eq('nuid', nuid).single();
  if (error) throw error;
  return data;
}
function forbid(res) { return res.status(403).json({ error: 'Forbidden' }); }

// public: directory
router.get('/', async (_req, res) => {
  const { data, error } = await supabase.from('v_staff_with_courses').select('*').order('name', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// auth: view schedule with role rules
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
        .from('cl_assigned_las').select('la_nuid').eq('cl_nuid', requester.nuid);
      if (!error && pairs?.some(r => r.la_nuid === target)) canView = true;
    }
  }
  if (!canView) return forbid(res);

  const { data, error } = await supabase
    .from('schedule').select('*').eq('staff_nuid', target)
    .order('day', { ascending: true }).order('start_time', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// ===== SL ADMIN OPS =====

// create staff (can include initial password & courses)
router.post('/', requireAuth, requireRole('SL'), async (req, res) => {
  const { nuid, name, role, email, password, courses = [] } = req.body || {};
  if (!nuid || !name || !role) return res.status(400).json({ error: 'nuid, name, role required' });
  if (email && !HUSKERS_RE.test(String(email).toLowerCase())) {
    return res.status(400).json({ error: 'email must be @huskers.unl.edu' });
  }

  let patch = { nuid, name, role, email: email ? String(email).toLowerCase() : null };
  if (password) {
    const bcrypt = require('bcryptjs');
    patch.password_hash = await bcrypt.hash(String(password), 12);
  }

  const { error } = await supabase.from('staff').insert([patch]);
  if (error) return res.status(500).json({ error: error.message });

  if (courses.length) {
    const rows = courses.map(course => ({ staff_nuid: nuid, course }));
    const { error: e2 } = await supabase.from('staff_courses').insert(rows);
    if (e2) return res.status(500).json({ error: e2.message });
  }

  const created = await getStaffByNUID(nuid).catch(() => null);
  res.status(201).json(created);
});

// update staff (name/role/email/courses/reset password)
router.put('/:nuid', requireAuth, requireRole('SL'), async (req, res) => {
  const nuid = req.params.nuid;
  const { name, role, email, courses, reset_password_to } = req.body || {};

  const patch = {};
  if (name) patch.name = name;
  if (role) patch.role = role;
  if (email !== undefined) {
    if (email && !HUSKERS_RE.test(String(email).toLowerCase())) {
      return res.status(400).json({ error: 'email must be @huskers.unl.edu' });
    }
    patch.email = email ? String(email).toLowerCase() : null;
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

// ===== SL: bulk upsert staff + set temp passwords (CSV -> JSON) =====
router.post('/bulk/upsert', requireAuth, requireRole('SL'), async (req, res) => {
  try {
    const list = Array.isArray(req.body) ? req.body : [];
    if (!list.length) return res.status(400).json({ error: 'No items provided' });

    const bcrypt = require('bcryptjs');
    const rows = [];
    const invalid = [];

    for (const it of list) {
      const nuid = String(it.nuid || '').trim();
      if (!nuid) continue;

      const row = { nuid };

      if (it.name)  row.name  = String(it.name).trim();
      if (it.role)  row.role  = String(it.role).trim();     // LA | CL | SL
      if (it.email) {
        const e = String(it.email).toLowerCase().trim();
        if (!HUSKERS_RE.test(e)) { invalid.push({ nuid, email: e }); continue; }
        row.email = e;
      }

      if (it.password) {
        row.password_hash = await bcrypt.hash(String(it.password), 12);
      }

      rows.push(row);
    }

    if (!rows.length && invalid.length) {
      return res.status(400).json({ error: 'All rows invalid (email must be @huskers.unl.edu)', invalid });
    }
    if (!rows.length) return res.status(400).json({ error: 'No valid rows' });

    const chunkSize = 100;
    let upserted = [];
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { data, error } = await supabase
        .from('staff')
        .upsert(chunk, { onConflict: 'nuid' })
        .select('nuid');
      if (error) return res.status(500).json({ error: error.message, invalid });
      upserted = upserted.concat(data.map(d => d.nuid));
    }

    res.json({ ok: true, count: upserted.length, nuids: upserted, invalid });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Bulk upsert failed' });
  }
});

module.exports = router;
