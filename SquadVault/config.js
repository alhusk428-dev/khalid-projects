// Supabase Configuration
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

let supabase = null;

// Only create client if URL starts with http to avoid breaking the script
if (typeof window.supabase !== 'undefined' && SUPABASE_URL.startsWith('http')) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.warn("Supabase credentials not configured yet.");
}