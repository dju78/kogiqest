import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// Validate that URL is a proper HTTP(S) URL
const isValidUrl = supabaseUrl && (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'));

let client;

if (isValidUrl && supabaseAnonKey) {
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
        from: () => {
            const notConfigured = { message: 'Supabase not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };

            // Query builders are chainable (.select().order().limit()) and also
            // thenable, so callers can await them at any point in the chain.
            const builder = (result) => new Proxy(
                { then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) },
                {
                    get: (target, prop) =>
                        prop in target ? target[prop] : () => builder(result)
                }
            );

            return {
                insert: () => builder({ data: null, error: notConfigured }),
                select: () => builder({ data: [], error: null }),
                update: () => builder({ data: null, error: notConfigured }),
                delete: () => builder({ data: null, error: notConfigured })
            };
        }
    };
}

export const isConfigured = !!(isValidUrl && supabaseAnonKey);
export const supabase = client;
