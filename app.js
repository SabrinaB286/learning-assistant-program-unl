'use strict';

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

/* ---------- Security & core middleware ---------- */
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false // keep simple for now; tighten later if you want
}));
app.use(express.json({ limit: '200kb' }));
app.use(cors());

/* ---------- Static frontend ---------- */
app.use(express.static(path.join(__dirname, 'feedback')));

/* ---------- API routes ---------- */
app.use('/api/auth', require('./routes/auth'));        // NEW
app.use('/api/staff', require('./routes/staff'));
app.use('/api/feedback', require('./routes/feedback'));

/* ---------- Health check ---------- */
app.get('/healthz', (_req, res) => res.send('ok'));

/* ---------- SPA fallback (Express 5 safe) ---------- */
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'feedback', 'index.html'));
});

/* ---------- Error handler ---------- */
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

/* ---------- Start ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
