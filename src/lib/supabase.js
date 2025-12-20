import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client;

if (supabaseUrl && supabaseAnonKey) {
    client = createClient(supabaseUrl, supabaseAnonKey);
} else {
    console.warn('Supabase keys missing. Authentication and reporting features will be disabled.');

    // Mock client to prevent white-screen crashes
    client = {
        auth: {
            getSession: () => Promise.resolve({ data: { session: null }, error: null }),
            getUser: () => Promise.resolve({ data: { user: null }, error: null }),
            onAuthStateChange: () => ({
                data: { subscription: { unsubscribe: () => { } } }
            }),
            signInWithPassword: () => Promise.resolve({ error: { message: 'Supabase not configured' } }),
            signUp: () => Promise.resolve({ error: { message: 'Supabase not configured' } }),
            signOut: () => Promise.resolve({ error: null })
        },
        from: () => ({
            insert: () => Promise.resolve({ error: { message: 'Supabase not configured (Missing Keys)' } }),
            select: () => Promise.resolve({ data: [], error: null }),
            update: () => Promise.resolve({ error: { message: 'Supabase not configured' } }),
            delete: () => Promise.resolve({ error: { message: 'Supabase not configured' } })
        })
    };
}

export const supabase = client;
