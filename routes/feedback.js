// server/routes/feedback.js
const express = require('express');
const { supabase } = require('../supabase');
const router = express.Router();

// GET all feedback (optional: filter by course/year)
router.get('/', async (_req, res) => {
  const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ message: error.message });
  res.json({ items: data });
});

// POST feedback
router.post('/', async (req, res) => {
  const entry = { ...req.body, created_at: new Date().toISOString() };
  const { data, error } = await supabase.from('feedback').insert(entry).select('*').single();
  if (error) return res.status(400).json({ message: error.message });
  res.status(201).json({ item: data });
});

module.exports = router;
