// app.js
// Minimal server: SPA + API (no optional deps like morgan/body-parser/dotenv)

// --- built-ins first
const path = require('path');
const fs = require('fs');

// --- core deps
const express = require('express');

const app = express();

// --- middleware (no extra packages)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// --- API routes (ensure these files exist and export `module.exports = router`)
app.use('/api/auth', require('./server/routes/auth'));
app.use('/api/feedback', require('./server/routes/feedback'));
app.use('/api/schedule', require('./server/routes/schedule'));
app.use('/api/office-hours', require('./server/routes/officehours'));

// --- health check
app.get('/healthz', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// --- static front-end
const PUBLIC_DIR   = path.join(__dirname, 'public');
const FEEDBACK_DIR = path.join(__dirname, 'feedback');
const ROOT_DIR     = __dirname;

// pick primary SPA dir (where index.html lives)
let FE_DIR = null;
for (const candidate of [
  path.join(__dirname, 'public', 'index.html'),
  path.join(__dirname, 'feedback', 'index.html'),
  path.join(__dirname, 'index.html'),
]) {
  if (fs.existsSync(candidate)) { FE_DIR = path.dirname(candidate); break; }
}
if (!FE_DIR) FE_DIR = ROOT_DIR;

// serve static assets from primary + known dirs
const staticDirs = [FE_DIR];
if (fs.existsSync(PUBLIC_DIR)) staticDirs.push(PUBLIC_DIR);
if (fs.existsSync(FEEDBACK_DIR)) staticDirs.push(FEEDBACK_DIR);
for (const dir of staticDirs) {
  app.use(express.static(dir, { index: 'index.html' }));
}

// SPA fallback to primary index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (path.extname(req.path)) return next();
  res.sendFile(path.join(FE_DIR, 'index.html'));
});

// --- boot (same style you had originally for the port)
const PORT = process.env.PORT || 1000;   // your original pattern
const HOST = '0.0.0.0';                  // required on Render
app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
  console.log(`Primary SPA dir: ${FE_DIR}`);
});
