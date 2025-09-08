// app.js — Express server entry (ESM version)
// Works on Render. Serves /feedback/index.html for '/' and exposes
// front-end assets at absolute paths so your buttons/scripts keep working.

import compression from 'compression';
import { existsSync } from 'node:fs';
import express from 'express';
import { fileURLToPath } from 'node:url';
import morgan from 'morgan';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3000;

// ---------- Middleware ----------
app.disable('x-powered-by');
app.use(compression());
app.use(morgan('tiny'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------- Static mounts (keep in sync with your repo layout) ----------
const FEEDBACK_DIR = path.join(__dirname, 'feedback'); // contains index.html
const PUBLIC_DIR   = path.join(__dirname, 'public');   // e.g., config.js, images, styles
const LIB_DIR      = path.join(__dirname, 'lib');      // e.g., supabase.js
const ROUTES_DIR   = path.join(__dirname, 'routes');   // client-facing helper modules (if any)

if (existsSync(FEEDBACK_DIR)) app.use('/feedback', express.static(FEEDBACK_DIR, { extensions: ['html', 'htm'] }));
if (existsSync(PUBLIC_DIR))   app.use('/public',   express.static(PUBLIC_DIR));
if (existsSync(LIB_DIR))      app.use('/lib',      express.static(LIB_DIR));
if (existsSync(ROUTES_DIR))   app.use('/routes',   express.static(ROUTES_DIR));

// ---------- Root route → serve feedback/index.html ----------
app.get('/', (_req, res) => {
  const indexAtFeedback = path.join(FEEDBACK_DIR, 'index.html');
  if (existsSync(indexAtFeedback)) return res.sendFile(indexAtFeedback);
  return res.status(500).send('Missing index.html in /feedback. Place your main page at feedback/index.html.');
});

// Healthcheck (useful on Render)
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// Optional SPA-ish fallback: serve index.html for non-file paths
app.get('*', (req, res, next) => {
  if (req.path.includes('.')) return next();
  const indexAtFeedback = path.join(FEEDBACK_DIR, 'index.html');
  if (existsSync(indexAtFeedback)) return res.sendFile(indexAtFeedback);
  return res.status(404).send('Not found');
});

// ---------- Start server ----------
app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});

export default app;
