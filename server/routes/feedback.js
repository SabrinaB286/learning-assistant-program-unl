// server/routes/feedback.js
const express = require('express');
const { supabase } = require('../supabase');
const router = express.Router();

// GET /api/feedback
router.get('/', async (req, res) => {
  try {
    const { course, year } = req.query || {};
    let q = supabase.from('feedback').select('*').order('created_at', { ascending: false });
    if (course) q = q.eq('course', course);
    if (year) q = q.eq('year', Number(year));
    const { data, error } = await q;
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (e) {
    console.error('[feedback:list]', e);
    res.status(500).json({ message: 'Failed to load feedback' });
  }
});

// POST /api/feedback
router.post('/', async (req, res) => {
  try {
    const entry = {
      course: req.body.course || null,
      type: req.body.type || 'general',
      rating: typeof req.body.rating === 'number' ? req.body.rating : null,
      text: String(req.body.text || '').trim(),
      submitter: req.body.submitter || null,
      year: req.body.year ? Number(req.body.year) : null,
      created_at: new Date().toISOString(),
    };
    if (!entry.text) return res.status(400).json({ message: 'Text is required' });

    const { data, error } = await supabase.from('feedback').insert(entry).select('*').single();
    if (error) throw error;
    res.status(201).json({ item: data });
  } catch (e) {
    console.error('[feedback:create]', e);
    res.status(400).json({ message: 'Failed to save feedback' });
  }
});

module.exports = router;
