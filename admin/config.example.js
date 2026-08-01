// Copy to `admin/config.js` (gitignored) and fill in your project's values from
// Supabase -> Project Settings -> API.
//
// Use the anon key, never the service role key: this file is loaded by a browser, so
// anything here is readable by whoever opens the page. The anon key grants nothing on
// its own — every query still goes through RLS, and the moderation views are gated on
// profiles.is_admin.
globalThis.DUOQUEUE_ADMIN_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT-REF.supabase.co",
  supabaseAnonKey: "YOUR-ANON-KEY",
};
