// routes/staff.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const requireAuth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// GET /api/staff/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('staff')
      .select('nuid, name, role, email')
      .eq('nuid', req.user.nuid)
      .limit(1);
    if (error) throw error;
    res.json(data?.[0] || null);
  } catch (e) {
    console.error('[staff/me]', e);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// GET /api/staff/me/schedule
router.get('/me/schedule', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('staff_schedules')
      .select('day_of_week, start_time, end_time, location, schedule_type, nuid')
      .eq('nuid', req.user.nuid);
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    console.error('[staff/me/schedule]', e);
    res.status(500).json({ error: 'Failed to load schedule' });
  }
});

// POST /api/staff/schedule  (SL can add for anyone; others only for themselves)
router.post('/schedule', requireAuth, async (req, res) => {
  try {
    const { nuid, day_of_week, start_time, end_time, location, schedule_type } = req.body || {};
    const target = nuid || req.user.nuid;

    if (target !== req.user.nuid && req.user.role !== 'SL') {
      return res.status(403).json({ error: 'Only SL can edit other schedules' });
    }
    if (!day_of_week || !start_time || !end_time || !location || !schedule_type) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const { data, error } = await supabase
      .from('staff_schedules')
      .insert([{ nuid: target, day_of_week, start_time, end_time, location, schedule_type }])
      .select('*')
      .limit(1);
    if (error) throw error;
    res.json({ ok: true, schedule: data?.[0] || null });
  } catch (e) {
    console.error('[staff/schedule]', e);
    res.status(500).json({ error: 'Failed to save schedule' });
  }
});

module.exports = router;
