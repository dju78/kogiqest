import { vi } from 'vitest';

/**
 * A stand-in for the Supabase client that enforces the same rules the real
 * database does, so the front end is tested against the actual security
 * boundary rather than an always-succeeds stub.
 *
 * The authoritative check lives in supabase/tests/01_rls_tests.sql, which runs
 * the real policies, grants and function against a real Postgres. This mirror
 * exists so the React components can be exercised without a database.
 */

/**
 * The real game limits, mirrored from src/lib/constants.js and from the
 * CHECK constraints in supabase/migrations/0001_kogi_quest_namespaced_schema.sql.
 */
export const MAX_SCORE = 54300;
export const MAX_LEVEL = 11;

/** Columns any client role may read. `user_id` and `updated_at` are absent. */
export const GRANTED_COLUMNS = ['id', 'created_at', 'username', 'score', 'level'];

export function createFakeSupabase({ session = null } = {}) {
    const state = {
        leaderboard: new Map(),   // keyed by user_id, mirroring the unique constraint
        reports: [],
        calls: [],                // table names touched
        rpcCalls: []              // { fn, args }
    };

    const authUid = () => session?.user?.id ?? null;

    const err = (code, message) => ({ data: null, error: { code, message } });
    const denied = (what) => err('42501', `permission denied for ${what}`);
    const checkErr = (c) => err('23514', `violates check constraint "${c}"`);

    // ---- kogi_quest_submit_score(): the only write path -------------------
    const submitScore = ({ p_score, p_level, p_username }) => {
        // EXECUTE is granted to `authenticated` only.
        if (!authUid()) return denied('function kogi_quest_submit_score');

        // Mirrors the migration: 543 questions x 100 points, 11 levels.
        if (p_score == null || p_score < 0 || p_score > MAX_SCORE || p_score % 100 !== 0) {
            return err('22023', `Invalid score: expected a multiple of 100 between 0 and ${MAX_SCORE}`);
        }
        if (p_level == null || p_level < 1 || p_level > MAX_LEVEL) {
            return err('22023', `Invalid level: expected a value between 1 and ${MAX_LEVEL}`);
        }

        let name = String(p_username ?? '').trim().slice(0, 50);
        if (name === '') name = 'Explorer';

        // The owner comes from auth.uid(), never from a parameter.
        const uid = authUid();
        const existing = state.leaderboard.get(uid);
        if (!existing) {
            state.leaderboard.set(uid, {
                id: `row-${state.leaderboard.size + 1}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                user_id: uid,
                username: name,
                score: p_score,
                level: p_level
            });
            return { data: p_score, error: null };
        }
        if (p_score > existing.score) {
            existing.score = p_score;
            existing.level = p_level;
        }
        existing.username = name;
        existing.updated_at = new Date().toISOString();
        return { data: existing.score, error: null };
    };

    // ---- kogi_quest_question_suggestions ---------------------------------
    const reportInsert = (row) => {
        if (!authUid()) return denied('table kogi_quest_question_suggestions');
        if (row.user_id !== authUid()) {
            return err('42501', 'new row violates row-level security policy');
        }
        if ('status' in row && row.status !== 'pending') {
            return err('42501', 'new row violates row-level security policy');
        }
        const qid = (row.question_id ?? '').trim();
        if (qid.length < 1 || qid.length > 100) return checkErr('..._question_id_check');
        if ((row.suggested_answer ?? '').length > 500) return checkErr('..._suggested_answer_check');
        if ((row.user_comment ?? '').length > 2000) return checkErr('..._user_comment_check');
        if (!(row.suggested_answer ?? '').trim() && !(row.user_comment ?? '').trim()) {
            return checkErr('..._not_empty_check');
        }
        state.reports.push({ id: `rep-${state.reports.length + 1}`, status: 'pending', ...row });
        return { data: null, error: null };
    };

    const thenable = (result) => ({
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
        select: () => thenable(result),
        order: () => thenable(result),
        limit: () => thenable(result),
        maybeSingle: () => thenable(result)
    });

    return {
        __state: state,
        auth: {
            getSession: vi.fn(() => Promise.resolve({ data: { session }, error: null })),
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
            signOut: vi.fn(() => Promise.resolve({ error: null }))
        },

        rpc(fn, args) {
            state.rpcCalls.push({ fn, args });
            if (fn === 'kogi_quest_submit_score') return thenable(submitScore(args ?? {}));
            return thenable(err('42883', `function ${fn} does not exist`));
        },

        from(table) {
            state.calls.push(table);
            return {
                select: (columns = '*') => {
                    if (table === 'kogi_quest_leaderboard') {
                        // Column privileges: any column outside the grant list
                        // is refused, exactly as Postgres would.
                        const asked = columns.split(',').map((c) => c.trim());
                        const ungranted = asked.filter(
                            (c) => c === '*' || !GRANTED_COLUMNS.includes(c)
                        );
                        if (ungranted.length > 0) {
                            return thenable(denied(
                                `column ${ungranted[0]} of relation kogi_quest_leaderboard`
                            ));
                        }
                        const rows = [...state.leaderboard.values()]
                            .sort((a, b) => b.score - a.score)
                            .map((r) => Object.fromEntries(asked.map((c) => [c, r[c]])));
                        return thenable({ data: rows, error: null });
                    }
                    if (table === 'kogi_quest_question_suggestions') {
                        return thenable(denied('table kogi_quest_question_suggestions'));
                    }
                    return thenable(err('PGRST205', `Could not find the table '${table}'`));
                },
                insert: (row) => thenable(
                    table === 'kogi_quest_question_suggestions'
                        ? reportInsert(Array.isArray(row) ? row[0] : row)
                        : err('PGRST205', `Could not find the table '${table}'`)
                ),
                // No client-side upsert/update/delete path exists any more.
                upsert: () => thenable(denied('table kogi_quest_leaderboard')),
                update: () => thenable(denied('table kogi_quest_leaderboard')),
                delete: () => thenable(denied('table kogi_quest_leaderboard'))
            };
        }
    };
}

export const makeSession = (id, fullName = 'Ada Test') => ({
    user: {
        id,
        email: `${fullName.split(' ')[0].toLowerCase()}@example.com`,
        user_metadata: { full_name: fullName }
    }
});
