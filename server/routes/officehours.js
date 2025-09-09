// server/routes/officehours.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { supabase } = require('../supabase');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function getAuthUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

router.get('/', async (req, res) => {
  try {
    const { course } = req.query || {};
    const nowISO = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

    let sessQ = supabase
      .from('office_hour_sessions')
      .select('id,schedule_id,session_start,session_end')
      .gte('session_end', nowISO)
      .order('session_start', { ascending: true });

    const { data: sessions, error: sessErr } = await sessQ;
    if (sessErr) throw sessErr;

    const scheduleIds = Array.from(new Set((sessions || []).map(s => s.schedule_id)));
    let schedules = [];
    if (scheduleIds.length) {
      let schQ = supabase
        .from('staff_schedules')
        .select('id, staff_nuid, course, location, day_of_week, start_time, end_time')
        .in('id', scheduleIds);
      if (course) schQ = schQ.eq('course', course);
      const { data: schRows, error: schErr } = await schQ;
      if (schErr) throw schErr;
      schedules = schRows || [];
    }

    const staffNUIDs = Array.from(new Set(schedules.map(s => s.staff_nuid)));
    let staff = [];
    if (staffNUIDs.length) {
      const { data: stRows, error: stErr } = await supabase
        .from('staff')
        .select('nuid,name,email,role')
        .in('nuid', staffNUIDs);
      if (stErr) throw stErr;
      staff = stRows || [];
    }

    const scheduleById = new Map(schedules.map(s => [s.id, s]));
    const staffByNUID = new Map(staff.map(s => [s.nuid, s]));

    const items = (sessions || [])
      .filter(s => scheduleById.has(s.schedule_id))
      .map(s => {
        const sch = scheduleById.get(s.schedule_id);
        const st = staffByNUID.get(sch.staff_nuid) || {};
        return {
          id: s.id,
          schedule_id: s.schedule_id,
          session_start: s.session_start,
          session_end: s.session_end,
          course: sch.course || null,
          location: sch.location || null,
          staff: { nuid: sch.staff_nuid, name: st.name || null, role: st.role || null }
        };
      });

    res.json({ items });
  } catch (e) {
    console.error('[office-hours:list]', e);
    res.status(500).json({ message: 'Failed to load office hours' });
  }
});

router.post('/:id/queue', async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ message: 'Login required' });

    const sessionId = req.params.id;
    if (!sessionId) return res.status(400).json({ message: 'Missing session id' });

    const row = {
      session_id: Number(sessionId),
      user_id: String(user.sub),
      joined_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('office_hour_queue').insert(row).select('*').single();
    if (error) throw error;

    res.status(201).json({ item: data });
  } catch (e) {
    console.error('[office-hours:join]', e);
    res.status(400).json({ message: 'Failed to join the queue' });
  }
});

module.exports = router;
