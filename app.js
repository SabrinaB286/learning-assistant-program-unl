'use strict';

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();

/* ---------- Core middleware ---------- */
app.set('trust proxy', 1);                 // good default on Render
app.use(express.json());
app.use(cors());                           // relax if FE/BE are same origin

/* ---------- Static frontend ---------- */
/* Adjust 'feedback' if your index.html lives elsewhere */
app.use(express.static(path.join(__dirname, 'feedback')));

/* ---------- API routes ---------- */
/* Make sure these files exist at ./routes/staff.js and ./routes/feedback.js */
app.use('/api/staff', require('./routes/staff'));
app.use('/api/feedback', require('./routes/feedback'));

/* ---------- Health check ---------- */
app.get('/healthz', (_req, res) => res.send('ok'));

/* ---------- SPA fallback (Express 5 safe) ---------- */
/* Serve index.html for any non-API path */
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'feedback', 'index.html'));
});

/* ---------- Error handler (last) ---------- */
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

/* ---------- Start server ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on :${PORT}`);
});
