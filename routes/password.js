// routes/password.js
'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../lib/supabase');

const router = express.Router();
const APP_JWT_SECRET = process.env.APP_JWT_SECRET || 'dev-secret';

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });

function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try { req.user = jwt.verify(token, APP_JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }
}
function requireSL(req, res, next) {
  if (req.user?.role !== 'SL') return res.status(403).json({ error: 'SL only' });
  next();
}

function badPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Use letters and numbers';
  return null;
}

/**
 * POST /api/auth/change-password
 * body: { current_password, new_password }
 * Applies to the logged-in user (staff or student).
 */
router.post('/change-password', limiter, requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  const err = badPassword(new_password);
  if (err) return res.status(400).json({ error: err });

  try {
    if (req.user.kind === 'staff') {
      // staff: lookup by nuid
      const { data: row, error } = await supabase.from('staff')
        .select('nuid,password_hash').eq('nuid', req.user.nuid).single();
      if (error || !row) return res.status(404).json({ error: 'Account not found' });
      const ok = await bcrypt.compare(String(current_password || ''), String(row.password_hash || ''));
      if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });
      const hash = await bcrypt.hash(new_password, 10);
      const { error: uerr } = await supabase.from('staff').update({ password_hash: hash }).eq('nuid', req.user.nuid);
      if (uerr) return res.status(500).json({ error: uerr.message });
      return res.json({ ok: true });
    } else {
      // students: adjust table/keys here if yours differ
      const studentId = req.user.id; // token should carry student id
      const { data: row, error } = await supabase.from('students')
        .select('id,password_hash').eq('id', studentId).single();
      if (error || !row) return res.status(404).json({ error: 'Account not found' });
      const ok = await bcrypt.compare(String(current_password || ''), String(row.password_hash || ''));
      if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });
      const hash = await bcrypt.hash(new_password, 10);
      const { error: uerr } = await supabase.from('students').update({ password_hash: hash }).eq('id', studentId);
      if (uerr) return res.status(500).json({ error: uerr.message });
      return res.json({ ok: true });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Unable to change password' });
  }
});

/**
 * POST /api/auth/admin/reset-password  (SL only)
 * body: { target: "staff"|"student", nuid?, email?, new_password }
 * - For staff, pass nuid
 * - For students, pass email (must be @huskers.unl.edu)
 */
router.post('/admin/reset-password', limiter, requireAuth, requireSL, async (req, res) => {
  const { target, nuid, email, new_password } = req.body || {};
  const err = badPassword(new_password);
  if (err) return res.status(400).json({ error: err });

  try {
    const hash = await bcrypt.hash(new_password, 10);

    if (target === 'staff') {
      if (!nuid) return res.status(400).json({ error: 'nuid required' });
      const { error } = await supabase.from('staff').update({ password_hash: hash }).eq('nuid', nuid);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    }

    if (target === 'student') {
      if (!email || !/@huskers\.unl\.edu$/i.test(email)) {
        return res.status(400).json({ error: 'Valid @huskers.unl.edu email required' });
      }
      const { error } = await supabase.from('students').update({ password_hash: hash }).eq('email', email);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'target must be "staff" or "student"' });
  } catch {
    return res.status(500).json({ error: 'Unable to reset password' });
  }
});

module.exports = router;
