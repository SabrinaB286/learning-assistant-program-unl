import { existsSync } from 'node:fs';
// app.js — minimal Express, ESM, no extra deps
import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3000;

// helpful logs so Render logs show what's wrong
process.on('unhandledRejection', (e) => {
  console.error('🛑 UnhandledRejection:', e);
});
process.on('uncaughtException', (e) => {
  console.error('🛑 UncaughtException:', e);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Folders based on your layout
const FEEDBACK_DIR = path.join(__dirname, 'feedback'); // contains index.html
const PUBLIC_DIR   = path.join(__dirname, 'public');   // config.js, assets
const LIB_DIR      = path.join(__dirname, 'lib');      // supabase.js, etc.
const ROUTES_DIR   = path.join(__dirname, 'routes');   // client-side helpers (if any)

// Static mounts (keep absolute URLs used by your pages working)
if (existsSync(FEEDBACK_DIR)) app.use('/feedback', express.static(FEEDBACK_DIR, { extensions: ['html', 'htm'] }));
if (existsSync(PUBLIC_DIR))   app.use('/public',   express.static(PUBLIC_DIR));
if (existsSync(LIB_DIR))      app.use('/lib',      express.static(LIB_DIR));
if (existsSync(ROUTES_DIR))   app.use('/routes',   express.static(ROUTES_DIR));

// Root → serve feedback/index.html (your chosen landing page)
app.get('/', (_req, res) => {
  const feedbackIndex = path.join(FEEDBACK_DIR, 'index.html');
  const publicIndex   = path.join(PUBLIC_DIR, 'index.html');
  if (existsSync(feedbackIndex)) return res.sendFile(feedbackIndex);
  if (existsSync(publicIndex))   return res.sendFile(publicIndex);
  res.status(500).send('Missing index.html. Put it in /feedback or /public.');
});

// Healthcheck (configure Render → Health check path: /healthz)
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// SPA-style fallback: serve index for non-file paths so front-end routing works
app.get('*', (req, res, next) => {
  if (req.path.includes('.')) return next();
  const feedbackIndex = path.join(FEEDBACK_DIR, 'index.html');
  const publicIndex   = path.join(PUBLIC_DIR, 'index.html');
  if (existsSync(feedbackIndex)) return res.sendFile(feedbackIndex);
  if (existsSync(publicIndex))   return res.sendFile(publicIndex);
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`✅ Server listening on :${PORT}`);
  console.log(`   feedback dir exists? ${existsSync(FEEDBACK_DIR)}`);
  console.log(`   public   dir exists? ${existsSync(PUBLIC_DIR)}`);
});
