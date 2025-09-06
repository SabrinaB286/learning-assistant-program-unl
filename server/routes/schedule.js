// server/routes/schedule.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { supabase } = require('../supabase');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// --- auth helpers
function requireStaff(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const u = jwt.verify(token, JWT_SECRET);
    if (!u.role || !['SL','CL','LA'].includes(u.role)) {
      return res.status(403).json({ error: 'Staff only' });
    }
    req.user = u;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// --- CRUD: my schedules
router.get('/my', requireStaff, async (req, res) => {
  const nuid = req.user.sub;
  const { data, error } = await supabase
    .from('staff_schedules')
    .select('*')
    .eq('staff_nuid', nuid)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ items: data || [] });
});

router.post('/', requireStaff, async (req, res) => {
  const nuid = req.user.sub;
  const payload = { ...req.body, staff_nuid: nuid };
  const { data, error } = await supabase
    .from('staff_schedules')
    .insert(payload)
    .select('*')
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ item: data });
});

router.put('/:id', requireStaff, async (req, res) => {
  const nuid = req.user.sub;
  const { id } = req.params;
  // restrict updates to your own rows (SL can change anyone if you want – add role check)
  const { data: rows, error: getErr } = await supabase
    .from('staff_schedules')
    .select('id, staff_nuid').eq('id', id).limit(1);
  if (getErr) return res.status(500).json({ error: getErr.message });
  if (!rows?.length) return res.status(404).json({ error: 'Not found' });
  if (rows[0].staff_nuid !== nuid && req.user.role !== 'SL') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { data, error } = await supabase
    .from('staff_schedules')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ item: data });
});

router.delete('/:id', requireStaff, async (req, res) => {
  const nuid = req.user.sub;
  const { id } = req.params;
  const { data: rows, error: getErr } = await supabase
    .from('staff_schedules')
    .select('id, staff_nuid').eq('id', id).limit(1);
  if (getErr) return res.status(500).json({ error: getErr.message });
  if (!rows?.length) return res.status(404).json({ error: 'Not found' });
  if (rows[0].staff_nuid !== nuid && req.user.role !== 'SL') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { error } = await supabase.from('staff_schedules').delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});


// --- Generate sessions for a schedule in a date range
// body: { schedule_id, from: '2025-09-07', to: '2025-12-15', tz: 'America/Chicago' }
router.post('/generate-sessions', requireStaff, async (req, res) => {
  const { schedule_id, from, to, tz } = req.body || {};
  if (!schedule_id || !from || !to) {
    return res.status(400).json({ error: 'Missing schedule_id/from/to' });
  }

  const { data: schRows, error: schErr } = await supabase
    .from('staff_schedules')
    .select('*').eq('id', schedule_id).limit(1);
  if (schErr) return res.status(500).json({ error: schErr.message });
  if (!schRows?.length) return res.status(404).json({ error: 'Schedule not found' });

  const s = schRows[0];

  // Create concrete datetimes for each matching weekday between from..to
  const startDate = new Date(from + 'T00:00:00');
  const endDate   = new Date(to   + 'T23:59:59');

  const created = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate()+1)) {
    if (d.getDay() !== Number(s.day_of_week)) continue;

    // Compose times in server timezone; you can adjust using tz if desired
    const start = new Date(d);
    const [sh, sm] = String(s.start_time).split(':').map(Number);
    start.setHours(sh, sm, 0, 0);

    const end = new Date(d);
    const [eh, em] = String(s.end_time).split(':').map(Number);
    end.setHours(eh, em, 0, 0);

    created.push({
      schedule_id,
      session_start: start.toISOString(),
      session_end: end.toISOString(),
    });
  }

  if (!created.length) return res.json({ count: 0, items: [] });

  const { data, error } = await supabase
    .from('office_hour_sessions')
    .insert(created)
    .select('*');
  if (error) return res.status(400).json({ error: error.message });

  res.json({ count: data.length, items: data });
});

module.exports = router;
