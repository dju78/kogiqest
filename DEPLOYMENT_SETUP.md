# KogiQuest — deployment & database setup

## 1. Database

| Object | Kind | Purpose |
| --- | --- | --- |
| `public.kogi_quest_leaderboard` | table | One row per player, holding their best run. RLS on; clients may read five columns and cannot write at all. |
| `public.kogi_quest_submit_score(int,int,text)` | function | The **only** write path. `SECURITY DEFINER`, empty `search_path`, `EXECUTE` to `authenticated` only. |
| `public.kogi_quest_question_suggestions` | table | Player-filed question reports. Insert-only; unreadable to players. |

> **KogiQuest and Takete-Ide share this Supabase project on purpose**, including
> its authentication. Nothing here creates a new project or changes the project
> URL or publishable key. `public.question_suggestions` (no prefix) belongs to
> the other application: the migration never creates, alters, renames, drops,
> re-policies or re-grants it, and no KogiQuest code reads or writes it.

### Applying the migration

Open **Supabase Dashboard → SQL Editor → New query**, paste
[`supabase/migrations/0001_kogi_quest_namespaced_schema.sql`](supabase/migrations/0001_kogi_quest_namespaced_schema.sql),
and run it. It is idempotent — running it twice is safe and gives the same result. It ends
with `NOTIFY pgrst, 'reload schema';` after `COMMIT`, so Supabase's API layer
picks up the new tables and RPC immediately instead of returning `PGRST205`
until its cache happens to refresh.

Expected output is a four-row summary:

```
                 object                  | exists | rls_enabled | policies | anon_reads_username | anon_reads_user_id | auth_can_update
-----------------------------------------+--------+-------------+----------+---------------------+--------------------+-----------------
 1. kogi_quest_leaderboard               | t      | t           |        3 | t                   | f                  | f
 2. kogi_quest_question_suggestions      | t      | t           |        1 |                     | f                  | f
 3. question_suggestions (other app)     | t      | <unchanged> | <unch.>  |                     | <unchanged>        | <unchanged>
 4. kogi_quest_submit_score() [function] | t      |             |        0 | t                   | f                  |
```

Rows 1, 2 and 4 must match exactly. On row 4 the two boolean columns are reused:
`anon_reads_username` means *`authenticated` may EXECUTE the function* (must be
`t`) and `anon_reads_user_id` means *`anon` may EXECUTE it* (must be `f`).
Row 3 is informational — compare it against what you recorded beforehand.

### Security model

The anon (publishable) key is **public by design**. Access control is Row Level
Security plus column privileges:

- **Reading the leaderboard.** RLS stays enabled. Client roles get
  `GRANT SELECT (id, created_at, username, score, level)` and nothing else.
  `user_id` and `updated_at` are granted to nobody, so they cannot be selected,
  filtered on, or ordered by — PostgreSQL requires SELECT privilege on every
  column a query references, including in `WHERE`. **No definer-rights view is
  used**; there is no `security_invoker = false` object in this schema.
- **Writing a score.** Clients hold no INSERT, UPDATE or DELETE grant on the
  table. The only path is `kogi_quest_submit_score(p_score, p_level, p_username)`:
  `SECURITY DEFINER`, `SET search_path = ''`, all references fully qualified,
  `EXECUTE` revoked from `PUBLIC` and `anon` and granted to `authenticated`. It
  takes the owner from `auth.uid()`, so a caller cannot submit for anyone else,
  and it keeps whichever score is higher.
- **Reports.** Only `authenticated` may insert, only as themselves, only with
  `status = 'pending'`. No SELECT/UPDATE/DELETE policy or grant exists, so
  nobody but the service role can read or moderate them.

### What the constraints do and do not prove

Validated in the database, using the game's **real** limits rather than round
numbers: score is a multiple of 100 between 0 and **54,300**; level is **1–11**;
username is 1–50 characters; exactly one row per user (`UNIQUE (user_id)`);
ownership is `auth.uid()`, taken server-side.

Those limits come from the application source:

| Limit | Value | Source |
| --- | --- | --- |
| Points per correct answer | 100 | `src/components/GameEngine.jsx` — `setScore(s => s + POINTS_PER_QUESTION)` |
| Questions in the game | 543 | `src/lib/constants.js` — levels 1–11 hold 23, 50, 50, 50, 50, 50, 20, 50, 50, 50, 100 |
| Maximum score | 54,300 | 543 × 100, exported as `MAX_POSSIBLE_SCORE` |
| Highest level | 11 | `GAME_LEVELS.length`, exported as `MAX_LEVEL`; `GameEngine` submits `currentLevelIndex + 1` |

`src/lib/constants.js` exports `POINTS_PER_QUESTION`, `MAX_LEVEL` and
`MAX_POSSIBLE_SCORE`, and a unit test asserts they match the database limits, so
the two cannot drift apart silently.

> **Adding or removing questions changes the maximum score.** Re-run the
> migration with the new figure — it drops and re-adds the constraint, so a
> re-run updates it in place. A stale ceiling would reject a legitimate perfect
> run.

**Scores are self-reported, not verified.** The quiz is scored in the browser,
so a determined signed-in user can still submit any well-formed value in range.
The constraints reject malformed and out-of-range submissions and stop one
player writing another's row; they do not prove a score was earned, and the
leaderboard should not be described as tamper-proof.

Verified scores would need server-side answer checking — the client submitting
its answers rather than a total, and a server function that alone holds the
answer key computing the score. That is a **future enhancement**, not something
this migration provides.

**The service-role key must never be used in the browser, this repository, any
`VITE_` variable, or the GitHub Pages bundle.** The build fails on purpose if a
`VITE_SUPABASE_SERVICE_ROLE_KEY` is present.

---

## 2. Playing without an account

No registration is required. `Start Game` goes straight to `/quiz` for everyone,
and `/quiz` is not behind an auth guard.

- **Guests** play the complete quiz. Their best score is kept in `localStorage`
  under `kogi-quest-highscore`. No leaderboard insert or RPC call is made for a
  guest, so finishing a run can never surface a database error. On completion
  they see: *"Great score! Sign in if you would like to save it to the global
  leaderboard."* Play Again works without signing in.
- **Signed-in players** additionally submit through `kogi_quest_submit_score()`.
- The public leaderboard is viewable by everyone, signed in or not.
- Filing a question report does require signing in, but that never interrupts
  gameplay.

---

## 3. Build variables

Two variables, both public-safe:

| Variable | Where to find it |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase Dashboard → Project Settings → Data API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API Keys → anon / publishable |

There are **no hard-coded fallbacks** in `vite.config.js`. If either variable is
missing, the app renders an explicit configuration screen naming what is absent,
rather than hanging on a spinner.

### Local development

```bash
cp .env.example .env   # then fill in both values
npm install
npm run dev
```

### GitHub Pages

Add both as repository secrets — **Settings → Secrets and variables → Actions →
New repository secret** — then re-run the workflow. The deploy workflow injects
them at build time and logs a warning if either is absent.

---

## 4. Tests

```bash
npm test        # component, guest-flow and data-access tests
npm run test:db # migration + RLS suite against a local throwaway Postgres
npm run typecheck
```

`npm run test:db` needs `psql` on PATH and a local Postgres. It creates and
drops a database, so it refuses anything that is not localhost and hard-refuses
hosted hostnames such as `*.supabase.co`. Override with
`KQ_TEST_PG=postgres://user@localhost:5432`.

The SQL suite runs the real policies, grants and function as the real `anon` and
`authenticated` roles and asserts 54 behaviours.

---

## 5. Verification queries (read-only)

None of these modify anything.

### Before the migration

```sql
-- P1) Record the state of the other application's table, so you can prove the
--     migration left it alone.
select
    (select count(*) from pg_policies
      where schemaname='public' and tablename='question_suggestions')      as policies,
    (select relrowsecurity from pg_class
      where oid = to_regclass('public.question_suggestions'))              as rls_enabled,
    (select count(*) from information_schema.columns
      where table_schema='public' and table_name='question_suggestions')   as columns;

-- P2) Its exact policy list.
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname='public' and tablename='question_suggestions'
order by policyname;

-- P3) Confirm nothing already uses the KogiQuest names.
select to_regclass('public.kogi_quest_leaderboard')          as leaderboard,
       to_regclass('public.kogi_quest_question_suggestions') as reports,
       to_regprocedure('public.kogi_quest_submit_score(integer,integer,text)') as fn;
-- all three expected to be NULL on a first run
```

### After the migration

```sql
-- V1) Column privileges: the allow-list, and the absence of user_id.
select a.attname as column_name,
       has_column_privilege('anon',          'public.kogi_quest_leaderboard', a.attname, 'SELECT') as anon_select,
       has_column_privilege('authenticated', 'public.kogi_quest_leaderboard', a.attname, 'SELECT') as auth_select
from pg_attribute a
where a.attrelid = 'public.kogi_quest_leaderboard'::regclass
  and a.attnum > 0 and not a.attisdropped
order by a.attnum;
-- expected: id, username, score, level, created_at -> t / t
--           user_id, updated_at                    -> f / f

-- V2) No client write privilege on the leaderboard.
select
    has_table_privilege('anon',          'public.kogi_quest_leaderboard', 'INSERT') as anon_insert,
    has_table_privilege('authenticated', 'public.kogi_quest_leaderboard', 'INSERT') as auth_insert,
    has_table_privilege('authenticated', 'public.kogi_quest_leaderboard', 'UPDATE') as auth_update,
    has_table_privilege('authenticated', 'public.kogi_quest_leaderboard', 'DELETE') as auth_delete;
-- expected: f, f, f, f

-- V3) The write function is hardened and correctly granted.
select p.proname,
       p.prosecdef                                               as security_definer,
       p.proconfig                                               as settings,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_execute,
       has_function_privilege('anon',          p.oid, 'EXECUTE') as anon_execute
from pg_proc p
where p.oid = 'public.kogi_quest_submit_score(integer,integer,text)'::regprocedure;
-- expected: security_definer = t, settings shows search_path set to empty, t, f

-- V4) No definer-rights view was introduced.
select count(*) as kogi_quest_views
from pg_views where schemaname='public' and viewname like 'kogi_quest%';
-- expected: 0

-- V5) RLS is on, with the expected policies.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname='public' and tablename like 'kogi_quest_%'
order by tablename, policyname;

-- V6) Validation constraints.
select conrelid::regclass::text as table_name, conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid in ('public.kogi_quest_leaderboard'::regclass,
                   'public.kogi_quest_question_suggestions'::regclass)
order by 1, 2;

-- V7) The other application's table is exactly as you recorded it.
--     Re-run P1 and P2 and compare the output.

-- V8) Did the previously-deployed build write KogiQuest reports into the other
--     application's table? KogiQuest question ids look like 'tki1', 'trb3'.
select id, created_at, question_id, left(coalesce(user_comment,''),60) as comment
from public.question_suggestions
where question_id ~ '^[a-z]{2,4}[0-9]+$'
order by created_at desc
limit 50;
-- Any rows are KogiQuest reports sitting in another app's table. Decide with
-- that table's owner whether to migrate or delete them; this migration does
-- not touch them.
```
