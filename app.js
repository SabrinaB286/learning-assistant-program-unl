// app.js (repo root)
'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();

// ---- routers (they live in ./routes) ----
const authRouter        = require('./routes/auth.js');
const staffRouter       = require('./routes/staff.js');
const passwordRouter    = require('./routes/password.js');
const officeHoursRouter = require('./routes/office-hours.js');

// If you have a feedback API router file under routes/, require it here.
// If your feedback is a static page only, you can skip this.
// Example (uncomment if you actually have routes/feedback.js):
// const feedbackRouter    = require('./routes/feedback.js');

app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ---- health & root ----
app.get('/healthz', (_req, res) => res.json({ ok: true, at: new Date().toISOString() }));
app.get('/api', (_req, res) => res.json({ ok: true, service: 'lap-backend', time: new Date().toISOString() }));

// ---- mount API ----
app.use('/api/auth', authRouter);
app.use('/api/staff', staffRouter);
app.use('/api/auth', passwordRouter);         // change-password/reset endpoints live under /api/auth
app.use('/api/schedule', officeHoursRouter);
// app.use('/api/feedback', feedbackRouter);  // uncomment if you have it

// ---- serve frontend (public/) ----
app.use(express.static(path.join(__dirname, 'public')));

// If you have a single-page app in public/, keep this catch-all so reloads work.
app.get('*', (req, res, next) => {
  const accept = req.headers.accept || '';
  if (accept.includes('text/html')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  return next();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Backend listening on :${PORT}`));
