// lib/supabase.js
'use strict';
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.warn('[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(url || 'https://invalid.local', key || 'anon', {
  auth: { persistSession: false }
});

module.exports = { supabase };
