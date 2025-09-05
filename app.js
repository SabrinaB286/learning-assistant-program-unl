// app.js  (CommonJS)
'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();

// Routers (all CommonJS)
const authRouter = require('./auth');            // expects middleware/auth.js (added below)
const staffRouter = require('./staff');
const passwordRouter = require('./password');
const feedbackRouter = require('./feedback');
// IMPORTANT: office-hours.js was ESM — replace it with the CJS file below
const officeHoursRouter = require('./office-hours');

app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health + root
app.get('/healthz', (_req, res) => res.json({ ok: true, at: new Date().toISOString() }));
app.get('/', (_req, res) => res.json({ ok: true, service: 'lap-backend', time: new Date().toISOString() }));

// Mount API
app.use('/api/auth', authRouter);
app.use('/api/staff', staffRouter);
app.use('/api/auth', passwordRouter);          // change-password + admin reset live under /api/auth/...
app.use('/api/feedback', feedbackRouter);
app.use('/api/schedule', officeHoursRouter);   // GET /api/schedule/office-hours

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Backend listening on :${PORT}`));
