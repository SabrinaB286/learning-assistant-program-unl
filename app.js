// app.js
// Main server for LA Portal (Auth, Feedback, Schedule, Office Hours + SPA)

// ----- Optional dotenv (local dev). Render already injects env vars.
try { require.resolve('dotenv'); require('dotenv').config(); } catch (_) {}

const path = require('path');
const fs = require('fs');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
// Optional morgan: if not installed, fallback to noop
function loadMorgan() {
  try { return require('morgan'); }
  catch { return () => (_fmt) => (req, res, next) => next(); }
}
const morgan = loadMorgan();

const compression = require('compression');
const cookieParser = require('cookie-parser');

const app = express();

// ----- Basic hardening & middleware
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ----- Health check
app.get('/healthz', (_req, res) =>
  res.json({ ok: true, env: process.env.NODE_ENV || 'development', ts: new Date().toISOString() })
);

// ----- API routes
app.use('/api/auth', require('./server/routes/auth'));
app.use('/api/feedback', require('./server/routes/feedback'));
app.use('/api/schedule', require('./server/routes/schedule'));
app.use('/api/office-hours', require('./server/routes/officehours'));

// ----- Static frontend (SPA)
const FE_DIR =
  process.env.FEEDBACK_DIR ||
  (fs.existsSync(path.join(__dirname, 'public', 'index.html')) ? path.join(__dirname, 'public') :
   fs.existsSync(path.join(__dirname, 'feedback', 'index.html')) ? path.join(__dirname, 'feedback') :
   __dirname);

app.use(express.static(FE_DIR, {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  index: 'index.html',
}));

// SPA fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (path.extname(req.path)) return next();
  res.sendFile(path.join(FE_DIR, 'index.html'));
});

// ----- Error handler
app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

// ----- Boot
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LA Portal server listening on :${PORT}`);
  console.log(`Serving frontend from: ${FE_DIR}`);
});
