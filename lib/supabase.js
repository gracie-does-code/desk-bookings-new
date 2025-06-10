import { createClient } from '@supabase/supabase-js';

// Frontend-only Supabase client using Vite environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables in frontend');
  console.error('VITE_SUPABASE_URL:', !!supabaseUrl);
  console.error('VITE_SUPABASE_ANON_KEY:', !!supabaseAnonKey);
}

// Create and export the supabase client for frontend use
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Also export as default for different import styles
export default supabase;