import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client;

if (supabaseUrl && supabaseAnonKey) {
    client = createClient(supabaseUrl, supabaseAnonKey);
} else {
    console.warn('Supabase keys missing. Report feature will be disabled.');
    // Mock client to prevent crashes
    client = {
        from: () => ({
            insert: () => Promise.resolve({ error: { message: 'Supabase not configured (Missing Keys)' } }),
            select: () => Promise.resolve({ data: [], error: null })
        })
    };
}

export const supabase = client;
