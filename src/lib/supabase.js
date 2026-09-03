import { createClient } from '@supabase/supabase-js';

// Namespaced database objects. This Supabase project hosts more than one
// application, so every KogiQuest object carries the kogi_quest_ prefix.
// `public.question_suggestions` (no prefix) belongs to another application
// and must never be read or written from here.
export const TABLES = {
    leaderboard: 'kogi_quest_leaderboard',
    questionSuggestions: 'kogi_quest_question_suggestions'
};

/** The only write path to the leaderboard. Requires a signed-in player. */
export const RPC = {
    submitScore: 'kogi_quest_submit_score'
};

/**
 * The leaderboard columns the browser is allowed to read. `user_id` is granted
 * to no client role, so asking for it — or filtering/ordering on it — is
 * refused by Postgres. Keep this list in step with the migration's GRANT.
 */
export const LEADERBOARD_PUBLIC_COLUMNS = 'id, created_at, username, score, level';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const isValidUrl = !!supabaseUrl && /^https?:\/\//.test(supabaseUrl);

/**
 * A specific, actionable reason the app cannot talk to Supabase, or null when
 * configuration is fine. Rendered as a controlled error screen by App.jsx
 * rather than being allowed to surface as a blank page or a silent failure.
 */
export const configError = (() => {
    const missing = [];
    if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');

    if (missing.length > 0) {
        return {
            title: 'Configuration required',
            detail: `Missing build variable${missing.length > 1 ? 's' : ''}: ${missing.join(' and ')}.`
        };
    }
    if (!isValidUrl) {
        return {
            title: 'Configuration invalid',
            detail: 'VITE_SUPABASE_URL must be an absolute http(s) URL.'
        };
    }
    return null;
})();

export const isConfigured = configError === null;

/**
 * A stub that mirrors enough of the supabase-js surface to keep the app from
 * throwing when configuration is missing. App.jsx shows the configuration
 * screen in that case, so this only guards against stray calls.
 */
const stubClient = () => {
    const error = { message: configError?.detail ?? 'Supabase is not configured.', code: 'NOT_CONFIGURED' };

    // Query builders are chainable and thenable, so `.select().order().limit()`
    // resolves rather than throwing part-way along the chain.
    const builder = (result) => new Proxy(
        { then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) },
        { get: (target, prop) => (prop in target ? target[prop] : () => builder(result)) }
    );

    return {
        auth: {
            getSession: () => Promise.resolve({ data: { session: null }, error: null }),
            getUser: () => Promise.resolve({ data: { user: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
            signInWithPassword: () => Promise.resolve({ data: null, error }),
            signUp: () => Promise.resolve({ data: null, error }),
            signOut: () => Promise.resolve({ error: null })
        },
        rpc: () => builder({ data: null, error }),
        from: () => ({
            select: () => builder({ data: [], error: null }),
            insert: () => builder({ data: null, error }),
            update: () => builder({ data: null, error }),
            delete: () => builder({ data: null, error })
        })
    };
};

export const supabase = isConfigured
    ? createClient(supabaseUrl, supabaseAnonKey)
    : stubClient();
