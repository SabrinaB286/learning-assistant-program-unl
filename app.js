// app.js — Express server entry
// Works on Render. Serves /feedback/index.html as the home page
// and exposes front-end modules at absolute URLs.

const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// ---------- Middleware ----------
app.disable('x-powered-by');
app.use(compression());
app.use(morgan('tiny'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------- Static mounts (keep these in sync with your repo folders) ----------
const FEEDBACK_DIR = path.join(ROOT, 'feedback'); // contains index.html (moved back here)
const PUBLIC_DIR   = path.join(ROOT, 'public');   // e.g., config.js, styles, images
const LIB_DIR      = path.join(ROOT, 'lib');      // supabase.js or other shared libs
const ROUTES_DIR   = path.join(ROOT, 'routes');   // front-end helper modules (only if they’re meant for the browser)

// Mount them so browser can import with absolute URLs:
//   /feedback/*   /public/*   /lib/*   /routes/*
if (fs.existsSync(FEEDBACK_DIR)) app.use('/feedback', express.static(FEEDBACK_DIR, { extensions: ['html', 'htm'] }));
if (fs.existsSync(PUBLIC_DIR))   app.use('/public',   express.static(PUBLIC_DIR));
if (fs.existsSync(LIB_DIR))      app.use('/lib',      express.static(LIB_DIR));
if (fs.existsSync(ROUTES_DIR))   app.use('/routes',   express.static(ROUTES_DIR));

// ---------- Root route: serve feedback/index.html ----------
app.get('/', (_req, res) => {
  const indexAtFeedback = path.join(FEEDBACK_DIR, 'index.html');
  if (fs.existsSync(indexAtFeedback)) return res.sendFile(indexAtFeedback);
  return res.status(500).send('Missing index.html in /feedback. Place your main page at feedback/index.html.');
});

// Healthcheck (Render precheck-friendly)
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// Optional: for client-side routing (if you ever add it)
// If the path doesn’t contain a dot (like a file), return index.html
app.get('*', (req, res, next) => {
  if (req.path.includes('.')) return next();
  const indexAtFeedback = path.join(FEEDBACK_DIR, 'index.html');
  if (fs.existsSync(indexAtFeedback)) return res.sendFile(indexAtFeedback);
  return res.status(404).send('Not found');
});

// ---------- Start server ----------
app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});

module.exports = app;
