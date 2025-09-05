// app.js — repo root (Option B)
'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();

// ------------------------------------------------------------------
// basic app setup
// ------------------------------------------------------------------
app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ------------------------------------------------------------------
// API health & info
// ------------------------------------------------------------------
app.get('/healthz', (_req, res) =>
  res.json({ ok: true, at: new Date().toISOString() })
);
app.get('/api', (_req, res) =>
  res.json({ ok: true, service: 'lap-backend', time: new Date().toISOString() })
);

// ------------------------------------------------------------------
// Mount routers from ./routes/*  (CommonJS modules: module.exports = router)
// If a file is missing we just log a warning so the app still runs.
// ------------------------------------------------------------------
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

// These correspond to files you said you have inside ./routes
tryMount('./routes/auth.js',        '/api/auth');      // login, signup, approvals, etc.
tryMount('./routes/password.js',    '/api/auth');      // change/reset password endpoints
tryMount('./routes/staff.js',       '/api/staff');     // staff & schedules
tryMount('./routes/office-hours.js','/api/schedule');  // GET /api/schedule/office-hours
// If you also have a feedback API router, uncomment the next line:
// tryMount('./routes/feedback.js',   '/api/feedback');

// ------------------------------------------------------------------
// Static frontend from ./public  (only if it exists)
// ------------------------------------------------------------------
const WEB_ROOT = path.join(__dirname, 'public');

if (fs.existsSync(path.join(WEB_ROOT, 'index.html'))) {
  app.use(express.static(WEB_ROOT));
  // SPA-friendly catch-all: serve index.html for non-API HTML requests
  app.get('*', (req, res, next) => {
    const accept = req.headers.accept || '';
    if (accept.includes('text/html')) {
      return res.sendFile(path.join(WEB_ROOT, 'index.html'));
    }
    return next(); // let API/non-HTML fall through to 404
  });
  console.log(`[static] serving ${WEB_ROOT}`);
} else {
  console.warn(`[static] ${WEB_ROOT}/index.html not found. Serving API only.`);
}

// ------------------------------------------------------------------
// Start server
// ------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend listening on :${PORT}`);
});
