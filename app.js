// app.js
'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();

// ⬇️ Use explicit filenames so Node doesn't guess extensions
const authRouter        = require('./auth.js');          // <-- make sure auth.js is alongside app.js
const staffRouter       = require('./staff.js');
const passwordRouter    = require('./password.js');
const feedbackRouter    = require('./feedback.js');
const officeHoursRouter = require('./office-hours.js');

app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/healthz', (_req, res) => res.json({ ok: true, at: new Date().toISOString() }));
app.get('/', (_req, res) => res.json({ ok: true, service: 'lap-backend', time: new Date().toISOString() }));

app.use('/api/auth', authRouter);
app.use('/api/staff', staffRouter);
app.use('/api/auth', passwordRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/schedule', officeHoursRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Backend listening on :${PORT}`));
