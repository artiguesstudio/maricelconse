// supabaseClient.js
// CDN: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
window.sb = window.supabase.createClient(
  window.A360.SUPABASE_URL,
  window.A360.SUPABASE_ANON_KEY
);
