import { existsSync } from 'node:fs';
// app.js — ESM, zero extra dependencies besides express
import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3000;

// Parse bodies (for future API endpoints if you add them)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Static mounts matching your repo layout ---
const FEEDBACK_DIR = path.join(__dirname, 'feedback'); // holds index.html
const PUBLIC_DIR   = path.join(__dirname, 'public');   // e.g. config.js, assets
const LIB_DIR      = path.join(__dirname, 'lib');      // e.g. supabase.js
const ROUTES_DIR   = path.join(__dirname, 'routes');   // client-side helpers if any

if (existsSync(FEEDBACK_DIR)) app.use('/feedback', express.static(FEEDBACK_DIR, { extensions: ['html', 'htm'] }));
if (existsSync(PUBLIC_DIR))   app.use('/public',   express.static(PUBLIC_DIR));
if (existsSync(LIB_DIR))      app.use('/lib',      express.static(LIB_DIR));
if (existsSync(ROUTES_DIR))   app.use('/routes',   express.static(ROUTES_DIR));

// Root → serve feedback/index.html (your chosen landing page)
app.get('/', (_req, res) => {
  const indexPath = path.join(FEEDBACK_DIR, 'index.html');
  if (existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(500).send('Missing /feedback/index.html. Place your main page in the feedback folder.');
});

// Simple healthcheck for Render
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// Fallback: for non-file paths, return index (helps with client-side routing)
app.get('*', (req, res, next) => {
  if (req.path.includes('.')) return next();
  const indexPath = path.join(FEEDBACK_DIR, 'index.html');
  if (existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`✅ Server listening on http://localhost:${PORT}`);
});

export default app;
