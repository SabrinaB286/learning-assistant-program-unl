// routes/office-hours.js
const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Server-side Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Health for this router (optional)
router.get('/health', (req, res) => res.json({ ok: true }));

// GET /api/schedule/office-hours  -> JSON array
router.get('/office-hours', async (req, res) => {
  try {
    // 1) Preferred: use SQL function if present
    let { data, error } = await supabase.rpc('get_office_hours');
    if (error && /function .* does not exist/i.test(error.message)) {
      // 2) Fallback: query tables directly
      const { data: sched, error: e1 } = await supabase
        .from('staff_schedules')
        .select('id,nuid,type,day,start_time,end_time,location,course_code')
        .eq('type', 'office_hour');
      if (e1) throw e1;

      const nuids = [...new Set((sched||[]).map(s=>s.nuid))];
      const { data: staff, error: e2 } = await supabase
        .from('staff')
        .select('nuid,name,role')
        .in('nuid', nuids.length? nuids : ['__none__']);
      if (e2) throw e2;

      const map = new Map((staff||[]).map(s=>[s.nuid, s]));
      data = (sched||[]).map(s => ({
        id: s.id,
        course_code: s.course_code || null,
        day: s.day,
        start_time: typeof s.start_time === 'string' ? s.start_time : String(s.start_time).slice(0,5),
        end_time:   typeof s.end_time   === 'string' ? s.end_time   : String(s.end_time).slice(0,5),
        location: s.location,
        staff_name: map.get(s.nuid)?.name || 'Unknown',
        staff_role: map.get(s.nuid)?.role || ''
      }));
    } else if (error) {
      throw error;
    }

    res.set('Content-Type','application/json').status(200).send(JSON.stringify(data||[]));
  } catch (err) {
    console.error('office-hours route error:', err);
    res.status(500).json({ error: 'Failed to load office hours' });
  }
});

module.exports = router;
