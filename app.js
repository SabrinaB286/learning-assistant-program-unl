// app.js (ESM)
import 'dotenv/config';

import bcrypt from 'bcryptjs';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import express from 'express';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ---------- Middleware ---------- */
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('tiny'));

/* ---------- Supabase (server-side) ---------- */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env variables.');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* ---------- Static file hosting ---------- */
/* You said your main HTML is in /feedback; public assets are in /public */
const FEEDBACK_DIR = path.resolve(__dirname, 'feedback');
const PUBLIC_DIR = path.resolve(__dirname, 'public');

/* Serve /public first (JS/CSS/config), then /feedback */
app.use('/public', express.static(PUBLIC_DIR, { extensions: ['js', 'css', 'map'] }));
app.use('/feedback', express.static(FEEDBACK_DIR));

/* Root should show the feedback app (your original homepage) */
app.get('/', (_req, res) => {
  res.sendFile(path.join(FEEDBACK_DIR, 'index.html'));
});

/* Healthcheck */
app.get('/api/health', (_req, res) => res.json({ ok: true }));

/* ---------- Auth helpers ---------- */
function normalizeLoginField(body) {
  // Accept multiple front-end field names
  const raw =
    body.login ||
    body.nuidOrEmail ||
    body.nuid ||
    body.email ||
    body.username ||
    '';
  return String(raw).trim();
}

function isEmail(str) {
  return /@/.test(str);
}

function isNUID(str) {
  return /^\d{7,9}$/.test(str); // allow 7-9 digits, you can tighten to 8 if needed
}

/**
 * Attempt to find the user in the given table by NUID or email.
 * We select common columns and tolerate missing ones.
 */
async function findUser(table, login) {
  const columns = 'nuid, email, name, role, password_hash, password, is_approved';
  let query;
  if (isEmail(login)) {
    query = sb.from(table).select(columns).eq('email', login).limit(1).maybeSingle();
  } else {
    query = sb.from(table).select(columns).eq('nuid', login).limit(1).maybeSingle();
  }
  const { data, error } = await query;
  if (error) {
    // If the table doesn't exist or column missing, surface null and let caller try another table
    return { user: null, err: error };
  }
  return { user: data || null, err: null };
}

function getHashField(u) {
  // Prefer password_hash, fallback to password (hashed)
  if (u && typeof u.password_hash === 'string' && u.password_hash.length > 0) return u.password_hash;
  if (u && typeof u.password === 'string' && u.password.length > 0) return u.password;
  return null;
}

/* ---------- POST /api/auth/login ---------- */
app.post('/api/auth/login', async (req, res) => {
  try {
    const login = normalizeLoginField(req.body);
    const password = String(req.body.password || '').trim();

    if (!login || !password) {
      return res.status(400).json({ ok: false, error: 'Missing login or password' });
    }

    // Try staff first, then students
    let user = null;
    let tried = [];

    for (const table of ['staff', 'students']) {
      const { user: u, err } = await findUser(table, login);
      tried.push({ table, err: err ? err.message : null, found: !!u });
      if (u) {
        user = { ...u, _table: table };
        break;
      }
    }

    if (!user) {
      return res.status(401).json({
        ok: false,
        error: 'Invalid credentials',
        debug: process.env.NODE_ENV === 'production' ? undefined : tried,
      });
    }

    // If there's an approval gate for students
    if (user._table !== 'staff' && user.is_approved === false) {
      return res.status(403).json({ ok: false, error: 'Account pending approval' });
    }

    // Verify password
    const hash = getHashField(user);
    if (!hash) {
      return res.status(401).json({ ok: false, error: 'Password not set for this account' });
    }
    const match = await bcrypt.compare(password, hash);
    if (!match) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    // Build a small user payload for the front-end
    const payload = {
      nuid: user.nuid || null,
      email: user.email || null,
      name: user.name || null,
      role: user.role || (user._table === 'staff' ? 'LA' : 'student'),
      table: user._table,
    };

    // Optionally set a basic session cookie (not required by your UI, but handy)
    const cookieData = Buffer.from(JSON.stringify({ nuid: payload.nuid, role: payload.role })).toString('base64url');
    res.cookie('lap_session', cookieData, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: 1000 * 60 * 60 * 8, // 8h
    });

    return res.json({ ok: true, user: payload });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

/* ---------- POST /api/auth/change-password ---------- */
/* This route lets a user change their own password by providing the old one. */
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const login = normalizeLoginField(req.body);
    const oldPassword = String(req.body.oldPassword || '').trim();
    const newPassword = String(req.body.newPassword || '').trim();
    if (!login || !oldPassword || !newPassword) {
      return res.status(400).json({ ok: false, error: 'Missing fields' });
    }

    // Find user (staff first, then students)
    let user = null;
    let table = 'staff';
    let recordId = null;

    for (const t of ['staff', 'students']) {
      const { user: u } = await findUser(t, login);
      if (u) {
        user = u;
        table = t;
        recordId = isEmail(login) ? { email: user.email } : { nuid: user.nuid };
        break;
      }
    }

    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

    const hash = getHashField(user);
    if (!hash) return res.status(400).json({ ok: false, error: 'No existing password to change' });

    const match = await bcrypt.compare(oldPassword, hash);
    if (!match) return res.status(401).json({ ok: false, error: 'Old password incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    const updateData = user.password_hash !== undefined ? { password_hash: newHash } : { password: newHash };

    const { error: upErr } = await sb.from(table).update(updateData).match(recordId);
    if (upErr) {
      console.error('Change password update error:', upErr);
      return res.status(500).json({ ok: false, error: 'Failed to update password' });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('Change password error:', e);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

/* ---------- Catch-all for unknown /api ---------- */
app.all('/api/*', (_req, res) => res.status(404).json({ ok: false, error: 'Not found' }));

/* ---------- Fallback: serve index for any other route ---------- */
app.get('*', (_req, res) => {
  res.sendFile(path.join(FEEDBACK_DIR, 'index.html'));
});

/* ---------- Start ---------- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
