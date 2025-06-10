// backend/routes/feedback.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const feedbackPath = path.join(__dirname, '../data/feedback.json');

// Get feedback list
router.get('/', (req, res) => {
  fs.readFile(feedbackPath, (err, data) => {
    if (err) return res.status(500).send('Failed to read feedback');
    res.json(JSON.parse(data));
  });
});

// Submit feedback
router.post('/', (req, res) => {
  const newEntry = { ...req.body, id: Date.now(), timestamp: new Date().toISOString() };
  const list = JSON.parse(fs.readFileSync(feedbackPath));
  list.push(newEntry);
  fs.writeFileSync(feedbackPath, JSON.stringify(list, null, 2));
  res.status(201).json(newEntry);
});

module.exports = router;
