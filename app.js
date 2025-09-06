// app.js
const path = require('path');
const fs = require('fs');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');

// If you created the server router as recommended:
const authRouter = require('./server/routes/auth'); // <- adjust only if you placed it elsewhere

const app = express();

// --- middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));

// --- static assets (front-end files)
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/feedback', express.static(path.join(__dirname, 'feedback')));
app.use('/lib', express.static(path.join(__dirname, 'lib')));
app.use('/routes', express.static(path.join(__dirname, 'routes')));

// --- API routes (server-side)
app.use('/api/auth', authRouter);

// --- pick a homepage file robustly
const candidates = [
  process.env.HOME_PAGE && path.join(__dirname, process.env.HOME_PAGE),
  path.join(__dirname, 'index.html'),
  path.join(__dirname, 'public', 'index.html'),
  path.join(__dirname, 'feedback', 'index.html'), // <- where yours currently lives
].filter(Boolean);

const HOME = candidates.find(p => {
  try { return fs.statSync(p).isFile(); } catch { return false; }
});

if (!HOME) {
  console.error('[server] No index.html found. Looked for:\n' + candidates.join('\n'));
}

// Health check
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Root -> homepage
app.get('/', (_req, res) => {
  if (!HOME) return res.status(500).send('Homepage not found on server.');
  res.sendFile(HOME);
});

// SPA fallback so hard-refresh on subpaths still works
app.get('*', (_req, res) => {
  if (!HOME) return res.status(404).send('Not configured.');
  res.sendFile(HOME);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`HTTP server listening on :${port}`);
  console.log(`Serving homepage -> ${HOME || '(missing)'}`);
});
