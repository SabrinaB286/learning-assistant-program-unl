// app.js — auto-detects your frontend; serves API + static
'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();

// -------------------------- basic app setup --------------------------
app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ---------------------------- health/info ----------------------------
app.get('/healthz', (_req, res) => res.json({ ok: true, at: new Date().toISOString() }));
app.get('/api',     (_req, res) => res.json({ ok: true, service: 'lap-backend', time: new Date().toISOString() }));

// -------------------------- mount API routers ------------------------
function tryMount(pathToModule, mountPath) {
  try {
    const router = require(pathToModule);
    app.use(mountPath, router);
    console.log(`[router] mounted ${mountPath} -> ${pathToModule}`);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.warn(`[router] skipped ${mountPath}: ${pathToModule} not found`);
    } else {
      console.error(`[router] failed ${mountPath}:`, err);
    }
  }
}

tryMount('./routes/auth.js',         '/api/auth');
tryMount('./routes/password.js',     '/api/auth');
tryMount('./routes/staff.js',        '/api/staff');
tryMount('./routes/office-hours.js', '/api/schedule');
// If you have a feedback API router, uncomment:
// tryMount('./routes/feedback.js',    '/api/feedback');

// ------------------------ detect & serve frontend --------------------
/**
 * We’ll try the following, in order:
 *  1) ./public/index.html
 *  2) ./feedback/index.html
 *  3) ./index.html (repo root)
 *  4) ./feedback-app.html (single file)
 */
const CANDIDATE_DIRS = [
  path.join(__dirname, 'public'),
  path.join(__dirname, 'feedback')
];
const CANDIDATE_FILES = [
  path.join(__dirname, 'index.html'),
  path.join(__dirname, 'feedback-app.html')
];

function findWebRoot() {
  for (const dir of CANDIDATE_DIRS) {
    const idx = path.join(dir, 'index.html');
    if (fs.existsSync(idx)) return { type: 'dir', root: dir, index: idx };
  }
  for (const file of CANDIDATE_FILES) {
    if (fs.existsSync(file)) return { type: 'file', root: path.dirname(file), index: file };
  }
  return null;
}

const web = findWebRoot();

if (web) {
  if (web.type === 'dir') {
    app.use(express.static(web.root));
    app.get('*', (req, res, next) => {
      const accept = req.headers.accept || '';
      if (accept.includes('text/html')) return res.sendFile(web.index);
      return next();
    });
    console.log(`[static] serving directory ${web.root}`);
  } else {
    // single-file mode: serve index at '/' and still allow static from its folder
    app.use(express.static(web.root));
    app.get('/', (_req, res) => res.sendFile(web.index));
    console.log(`[static] serving single file ${web.index}`);
  }
} else {
  console.warn('[static] No frontend found (looked for public/, feedback/, index.html, feedback-app.html). API-only mode.');
}

// ------------------------------- start -------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Backend listening on :${PORT}`));
