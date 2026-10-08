// Supabase Configuration
const SUPABASE_URL = "YOUR_SUPABASE_URL"; 
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

let supabase = null;

// Prevent app crash if placeholder values are still in place
if (SUPABASE_URL.startsWith("http")) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.warn("Supabase URL is not configured yet. Replace placeholders in config.js with your project credentials.");
}