// app.js
// Main server for LA Portal (Auth, Feedback, Schedule, Office Hours + SPA)

// ---- Core built-ins FIRST (so we can use them below)
const path = require('path');
const fs = require('fs');

// ---- Optional dotenv (local dev). Render already injects env vars.
try { require.resolve('dotenv'); require('dotenv').config(); } catch (_) {}

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

// Optional morgan: if not installed, use a no-op
function loadMorgan() {
  try { return require('morgan'); }
  catch { return () => (_fmt) => (_req, _res, next) => next(); }
}
const morgan = loadMorgan();

const compression = require('compression');
const cookieParser = require('cookie-parser');

const app = express();

// ---- Basic hardening & middleware
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ---- Health check
app.get('/healthz', (_req, res) =>
  res.json({ ok: true, env: process.env.NODE_ENV || 'development', ts: new Date().toISOString() })
);

// ---- API routes
app.use('/api/auth', require('./server/routes/auth'));
app.use('/api/feedback', require('./server/routes/feedback'));
app.use('/api/schedule', require('./server/routes/schedule'));
app.use('/api/office-hours', require('./server/routes/officehours'));

// ---- Static front-end (serve multiple dirs so /routes/*.js resolves)

const PUBLIC_DIR   = path.join(__dirname, 'public');
const FEEDBACK_DIR = path.join(__dirname, 'feedback');
const ROOT_DIR     = __dirname;

// Choose the primary SPA directory (where index.html lives)
let FE_DIR = null;
const candidates = [
  process.env.FEEDBACK_DIR && path.join(process.env.FEEDBACK_DIR, 'index.html'),
  path.join(__dirname, 'public', 'index.html'),
  path.join(__dirname, 'feedback', 'index.html'),
  path.join(__dirname, 'index.html'),
].filter(Boolean);

for (const p of candidates) {
  if (fs.existsSync(p)) { FE_DIR = path.dirname(p); break; }
}
if (!FE_DIR) FE_DIR = ROOT_DIR;

// Serve static assets from multiple places: primary first, then public/, feedback/
const staticDirs = [FE_DIR];
if (fs.existsSync(PUBLIC_DIR) && !staticDirs.includes(PUBLIC_DIR)) staticDirs.push(PUBLIC_DIR);
if (fs.existsSync(FEEDBACK_DIR) && !staticDirs.includes(FEEDBACK_DIR)) staticDirs.push(FEEDBACK_DIR);

for (const dir of staticDirs) {
  app.use(express.static(dir, {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    index: 'index.html',
  }));
}

// SPA fallback to the primary index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (path.extname(req.path)) return next();
  res.sendFile(path.join(FE_DIR, 'index.html'));
});

// ---- Error handler
app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

// ---- Boot
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LA Portal server listening on :${PORT}`);
  console.log(`Primary SPA dir: ${FE_DIR}`);
  console.log(`Also serving (if they exist): ${[PUBLIC_DIR, FEEDBACK_DIR].join(', ')}`);
});
