// routes/password.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const requireAuth = require('../middleware/auth');

const router = express.Router();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// POST /api/auth/change-password  { currentPassword, newPassword }
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Missing currentPassword or newPassword' });
    }

    const { data: rows, error: e1 } = await supabase
      .from('staff')
      .select('nuid, password_hash')
      .eq('nuid', req.user.nuid)
      .limit(1);
    if (e1) throw e1;
    const row = rows?.[0];
    if (!row) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(currentPassword, row.password_hash || '');
    if (!ok) return res.status(401).json({ error: 'Current password incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    const { error: e2 } = await supabase
      .from('staff')
      .update({ password_hash: newHash })
      .eq('nuid', req.user.nuid);
    if (e2) throw e2;

    res.json({ ok: true });
  } catch (err) {
    console.error('[auth/change-password] error', err);
    res.status(500).json({ error: 'Could not change password' });
  }
});

module.exports = router;
