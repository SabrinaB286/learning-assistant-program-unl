// office-hours.js  (CommonJS)
'use strict';

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// GET /api/schedule/office-hours
router.get('/office-hours', async (_req, res) => {
  try {
    // Prefer SQL function if present
    let { data, error } = await supabase.rpc('get_office_hours');

    if (error && /does not exist/i.test(error.message)) {
      // Fallback: join staff_schedules + staff
      const { data: sched, error: e1 } = await supabase
        .from('staff_schedules')
        .select('id,nuid,type,day,start_time,end_time,location,course_code')
        .eq('type', 'office_hour');
      if (e1) throw e1;

      const nuids = [...new Set((sched || []).map(s => s.nuid))];
      const { data: staff, error: e2 } = await supabase
        .from('staff')
        .select('nuid,name,role')
        .in('nuid', nuids.length ? nuids : ['__none__']);
      if (e2) throw e2;

      const map = new Map((staff || []).map(s => [s.nuid, s]));
      data = (sched || []).map(s => ({
        id: s.id,
        course_code: s.course_code || null,
        day: s.day,
        start_time: typeof s.start_time === 'string' ? s.start_time : String(s.start_time).slice(0, 5),
        end_time:   typeof s.end_time   === 'string' ? s.end_time   : String(s.end_time).slice(0, 5),
        location: s.location || '',
        staff_name: map.get(s.nuid)?.name || 'Unknown',
        staff_role: map.get(s.nuid)?.role || ''
      }));
    } else if (error) {
      throw error;
    }

    res.status(200).json(data || []);
  } catch (err) {
    console.error('office-hours error:', err);
    res.status(500).json({ error: 'Failed to load office hours' });
  }
});

module.exports = router;
