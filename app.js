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
app.use(helmet({ contentSecurityPolicy: false })); // keep simple; can harden later
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
  const router = require(modulePath); // surface errors early
  if (limiter) app.use(mountPath, limiter);
  app.use(mountPath, router);
  console.log(`[router] mounted ${mountPath} -> ${modulePath}`);
}

mount('./routes/auth.js',         '/api/auth', authLimiter);
mount('./routes/password.js',     '/api/auth', authLimiter);
mount('./routes/staff.js',        '/api/staff');
mount('./routes/office-hours.js', '/api/schedule');
mount('./routes/feedback.js',     '/api/feedback'); // you have this file

// ---------- static: expose exactly what you have ----------
const PUBLIC_DIR   = path.join(__dirname, 'public');   // contains config.js
const FEEDBACK_DIR = path.join(__dirname, 'feedback'); // contains index.html + feedback.js
const LIB_DIR      = path.join(__dirname, 'lib');      // contains supabase.js

// serve /config.js (and any future assets under public/)
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  console.log(`[static] / -> ${PUBLIC_DIR}`);
} else {
  console.warn(`[static] public/ not found`);
}

// serve /feedback/* (your UI)
if (fs.existsSync(FEEDBACK_DIR)) {
  app.use('/feedback', express.static(FEEDBACK_DIR));
  console.log(`[static] /feedback -> ${FEEDBACK_DIR}`);
} else {
  console.warn(`[static] feedback/ not found`);
}

// serve /lib/* (for supabase.js)
if (fs.existsSync(LIB_DIR)) {
  app.use('/lib', express.static(LIB_DIR));
  console.log(`[static] /lib -> ${LIB_DIR}`);
} else {
  console.warn(`[static] lib/ not found`);
}

// ---------- homepage -> feedback/index.html ----------
app.get('/', (req, res, next) => {
  const file = path.join(FEEDBACK_DIR, 'index.html');
  if (fs.existsSync(file)) return res.sendFile(file);
  // fall back to any index in public/ if feedback/ missing
  const publicIndex = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(publicIndex)) return res.sendFile(publicIndex);
  return next();
});

// Optional: SPA catch-all for non-API HTML routes (e.g., /login)
/*
app.get(/^\/(login|hours|dashboard)$/, (req, res, next) => {
  const file = path.join(FEEDBACK_DIR, 'index.html');
  if (fs.existsSync(file)) return res.sendFile(file);
  return next();
});
*/

// ---------- 404 for unknown API routes ----------
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// ---------- start ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Backend listening on :${PORT}`));
