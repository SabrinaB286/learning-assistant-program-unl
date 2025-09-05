// routes/office-hours.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// GET /api/schedule/office-hours
router.get('/office-hours', async (req, res) => {
  try {
    // schedules
    const { data: schedules, error: e1 } = await supabase
      .from('staff_schedules')
      .select('nuid, day_of_week, start_time, end_time, location, schedule_type');
    if (e1) throw e1;

    const nuids = [...new Set((schedules || []).map(s => s.nuid))];

    let staffByNUID = {};
    let courseByNUID = {};

    if (nuids.length) {
      const { data: staff, error: e2 } = await supabase
        .from('staff')
        .select('nuid, name, role')
        .in('nuid', nuids);
      if (e2) throw e2;
      staffByNUID = Object.fromEntries((staff || []).map(s => [s.nuid, s]));

      // one course per staff (you can expand later)
      const { data: sc, error: e3 } = await supabase
        .from('staff_courses')
        .select('nuid, course_code')
        .in('nuid', nuids);
      if (e3) throw e3;
      sc?.forEach(r => { if (!courseByNUID[r.nuid]) courseByNUID[r.nuid] = r.course_code; });
    }

    const result = (schedules || []).map(s => ({
      staff_nuid: s.nuid,
      staff_name: staffByNUID[s.nuid]?.name || 'Unknown',
      staff_role: staffByNUID[s.nuid]?.role || null,
      course_code: courseByNUID[s.nuid] || null,
      day: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      location: s.location,
      type: s.schedule_type
    }));

    res.json(result);
  } catch (err) {
    console.error('[office-hours] error:', err);
    res.status(500).json({ error: 'Failed to load office hours' });
  }
});

module.exports = router;
