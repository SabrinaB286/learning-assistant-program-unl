// backend/routes/staff.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const staffPath = path.join(__dirname, '../data/staff.json');
const { supabase } = require('../lib/supabase');


// Get staff list
router.get('/', (req, res) => {
  fs.readFile(staffPath, (err, data) => {
    if (err) return res.status(500).send('Failed to read staff data');
    res.json(JSON.parse(data));
  });
});

// Login by NUID
router.post('/login', (req, res) => {
  const { nuid } = req.body;
  const staffList = JSON.parse(fs.readFileSync(staffPath));
  const user = staffList.find(s => s.nuid === nuid);
  if (user) res.json({ success: true, user });
  else res.status(401).json({ success: false, message: 'Invalid NUID' });
});

module.exports = router;
