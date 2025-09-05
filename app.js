// app.js — serve /feedback as the site and keep all APIs
'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();

// ---------- core middleware ----------
app.set('trust proxy', true);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(compression());

// ---------- health/info ----------
app.get('/healthz', (_req, res) =>
  res.json({ ok: true, at: new Date().toISOString() })
);
app.get('/api', (_req, res) =>
  res.json({ ok: true, service: 'lap-backend', time: new Date().toISOString() })
);

// ---------- rate-limit for auth endpoints ----------
const authLimiter = rateLimit({ windowMs: 60_000, max: 60 });

// ---------- mount API routers ----------
function mount(modulePath, mountPath, limiter = null) {
  const router = require(modulePath);
  if (limiter) app.use(mountPath, limiter);
  app.use(mountPath, router);
  console.log(`[router] mounted ${mountPath} -> ${modulePath}`);
}

mount('./routes/auth.js',         '/api/auth', authLimiter);
mount('./routes/password.js',     '/api/auth', authLimiter);
mount('./routes/staff.js',        '/api/staff');
mount('./routes/office-hours.js', '/api/schedule');
mount('./routes/feedback.js',     '/api/feedback');

// ---------- static: expose your folders ----------
const PUBLIC_DIR   = path.join(__dirname, 'public');   // config.js
const FEEDBACK_DIR = path.join(__dirname, 'feedback'); // index.html + feedback.js
const LIB_DIR      = path.join(__dirname, 'lib');      // supabase.js (optional)

if (fs.existsSync(PUBLIC_DIR))  app.use(express.static(PUBLIC_DIR));
if (fs.existsSync(FEEDBACK_DIR)) app.use('/feedback', express.static(FEEDBACK_DIR));
if (fs.existsSync(LIB_DIR))     app.use('/lib', express.static(LIB_DIR));

// homepage -> feedback/index.html
app.get('/', (req, res, next) => {
  const file = path.join(FEEDBACK_DIR, 'index.html');
  if (fs.existsSync(file)) return res.sendFile(file);
  const publicIndex = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(publicIndex)) return res.sendFile(publicIndex);
  return next();
});

// 404 for unknown API routes (JSON)
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// JSON error boundary (prevents 502 + HTML leaks)
app.use((err, req, res, _next) => {
  console.error('[ERROR]', req.method, req.originalUrl, err);
  res
    .status(err.status || 500)
    .type('application/json')
    .send(JSON.stringify({ error: err.message || 'Internal Server Error' }));
});

// ---------- start ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Backend listening on :${PORT}`));
