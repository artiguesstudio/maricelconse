// supabaseClient.js
(() => {
  const cfg = window.A360 || {};
  const url = cfg.SUPABASE_URL;
  const key = cfg.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("[A360] Falta SUPABASE_URL o SUPABASE_ANON_KEY en config.js");
    return;
  }

  // `supabase` viene del CDN @supabase/supabase-js
  window.sb = supabase.createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  console.log("[A360] Supabase client OK:", url);
})();