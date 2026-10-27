const SUPABASE_URL = "https://qsxkfkkckmkxjzwhbrrj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzeGtma2tja21reGp6d2hicnJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NzExNjksImV4cCI6MjEwNzQ0NzE2OX0.aafRPGSaeJ44e7tz29KoIVP4aeU705ao1u4Ncm7VYFA";

let supabase = null;

if (typeof window.supabase !== 'undefined' && SUPABASE_URL.startsWith('http')) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.warn("Supabase credentials not configured yet.");
}
