// backend/lib/supabase.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.https://wmeijbsvlnjvnhptudfh.supabase.co;
const supabaseServiceKey = process.env.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtZWlqYnN2bG5qdm5ocHR1ZGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4MDQ5NzksImV4cCI6MjA3MTM4MDk3OX0.YT_435s_FFsqNJs6M_yW9iIGzxeCu1BHpPVH1cwJlX8; // service role key, never expose to browser

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

module.exports = { supabase };
