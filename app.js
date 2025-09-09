// app.js (CommonJS)

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const app = express();

/* ---------- Paths ---------- */
const ROOT_DIR     = __dirname;
const FEEDBACK_DIR = path.join(ROOT_DIR, 'feedback'); // your index.html, feedback.js, supabase.js, etc.
const PUBLIC_DIR   = path.join(ROOT_DIR, 'public');   // shared assets (images, css, favicon, config.js)

/* ---------- Middleware ---------- */
app.use(helmet({ contentSecurityPolicy: false })); // keep CSP off unless you’ve authored a policy
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cors()); // useful if your API is called from other origins

/* ---------- API routes (keep your existing route files) ---------- */
/* If a route file is missing, the try/catch prevents boot failure. */
try { app.use('/api/auth',         require('./routes/auth')); }         catch {}
try { app.use('/api/feedback',     require('./routes/feedback')); }     catch {}
try { app.use('/api/office-hours', require('./routes/office-hours')); } catch {}
try { app.use('/api/staff',        require('./routes/staff')); }        catch {}
try { app.use('/api/password',     require('./routes/password')); }     catch {}

/* ---------- Static files ---------- */
/** Mount the feedback app at the site root (Option A). */
app.use(express.static(FEEDBACK_DIR, { extensions: ['html'] }));

/** Keep /public available for shared assets (don’t put index.html here). */
app.use('/public', express.static(PUBLIC_DIR));

/* ---------- SPA-style fallback for any non-API route ---------- */
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(FEEDBACK_DIR, 'index.html'));
});

/* ---------- Health check (handy for Render) ---------- */
app.get('/health', (_req, res) => res.status(200).send('ok'));

/* ---------- Error handling ---------- */
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

/* ---------- Start server ---------- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
