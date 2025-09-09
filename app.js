// app.js
// Main server for LA Portal (Auth, Feedback, Schedule, Office Hours + SPA)

// ----- Optional dotenv (for local dev). On Render, env vars are injected automatically.
try {
  require.resolve('dotenv');
  require('dotenv').config();
} catch (_) {
  // dotenv not installed — that’s fine in production
}

const path = require('path');
const fs = require('fs');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');

const app = express();

// ----- Basic hardening & middleware
app.set('trust proxy', 1); // trust Render/Heroku proxies

app.use(helmet({
  contentSecurityPolicy: false, // disable strict CSP for SPA; tighten later
}));
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ----- Health/diagnostic
app.get('/healthz', (_req, res) =>
  res.json({ ok: true, env: process.env.NODE_ENV || 'development', ts: new Date().toISOString() })
);

// ----- API routes
app.use('/api/auth', require('./server/routes/auth'));
app.use('/api/feedback', require('./server/routes/feedback'));
app.use('/api/schedule', require('./server/routes/schedule'));
app.use('/api/office-hours', require('./server/routes/officehours')); // make sure this file exists

// ----- Static front-end (SPA)
// Auto-detect front-end directory
const FE_DIR =
  process.env.FEEDBACK_DIR ||
  (fs.existsSync(path.join(__dirname, 'public', 'index.html')) ? path.join(__dirname, 'public') :
   fs.existsSync(path.join(__dirname, 'feedback', 'index.html')) ? path.join(__dirname, 'feedback') :
   __dirname // fallback; expects index.html at project root
  );

app.use(express.static(FE_DIR, {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  index: 'index.html',
}));

// For SPA routes: always return index.html (except API/asset paths)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();   // let API handle it
  if (path.extname(req.path)) return next();         // let static handle assets
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
