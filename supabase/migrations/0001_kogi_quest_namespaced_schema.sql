-- =====================================================================
-- KogiQuest schema (namespaced)
-- =====================================================================
-- KogiQuest and Takete-Ide deliberately share this Supabase project and its
-- authentication system. Every object created here is therefore namespaced
-- with a `kogi_quest_` prefix.
--
-- THIS MIGRATION DOES NOT TOUCH ANY PRE-EXISTING OBJECT.
-- In particular `public.question_suggestions` is never created, altered,
-- renamed, dropped, re-policied or re-granted. No unrelated Takete-Ide table,
-- policy, role or grant is modified. The project URL and publishable key are
-- unchanged; nothing here requires a new Supabase project.
--
-- Safe to run repeatedly: every statement is idempotent.
-- Run as the project owner in Supabase Dashboard -> SQL Editor.
--
-- ---------------------------------------------------------------------
-- Security model
-- ---------------------------------------------------------------------
-- The anon / publishable key is PUBLIC. It is an identifier, not a secret.
-- Row Level Security plus column privileges are the security boundary.
--
--   * No definer-rights ("security_invoker = false") view is used. Public
--     leaderboard reads hit the base table directly, with RLS enabled and
--     column-level SELECT granted on the five safe columns only. `user_id`
--     is granted to no client role, so it cannot be selected, filtered or
--     ordered on: PostgreSQL requires SELECT privilege on every column a
--     query references, including in WHERE and ORDER BY.
--   * Clients hold NO insert, update or delete privilege on the leaderboard.
--     The single write path is kogi_quest_submit_score(), a narrowly scoped
--     SECURITY DEFINER function with a fixed empty search_path, fully
--     qualified references, and EXECUTE granted to `authenticated` only.
--
-- ---------------------------------------------------------------------
-- Honest limits on score integrity
-- ---------------------------------------------------------------------
-- The constraints below validate that a submitted score is well-formed and
-- that it belongs to the caller. They do NOT prove the player earned it.
-- The quiz is scored entirely in the browser, so a determined signed-in user
-- can still submit any well-formed value within range. Leaderboard scores are
-- self-reported and should be read that way.
--
-- Genuinely verified scores would require server-side answer checking: the
-- client would submit its answers rather than a total, and a server-side
-- function that alone holds the answer key would compute the score. That is a
-- future enhancement, not something this migration provides.
--
-- ---------------------------------------------------------------------
-- Where the numeric limits come from
-- ---------------------------------------------------------------------
-- These are the game's real limits, read from the application source, not
-- round numbers:
--
--   100 points per correct answer
--       src/lib/constants.js         export const POINTS_PER_QUESTION = 100;
--       src/components/GameEngine.jsx  setScore(s => s + POINTS_PER_QUESTION)
--
--   543 questions across 11 levels  ->  MAX SCORE 54300
--       src/lib/constants.js
--           export const MAX_POSSIBLE_SCORE =
--               GAME_LEVELS.reduce((t, l) => t + l.questions.length, 0)
--               * POINTS_PER_QUESTION;
--       GAME_LEVELS levels 1-11 hold
--           23, 50, 50, 50, 50, 50, 20, 50, 50, 50, 100 questions = 543
--
--   HIGHEST LEVEL 11
--       src/lib/constants.js         export const MAX_LEVEL = GAME_LEVELS.length;
--       src/components/GameEngine.jsx  p_level: currentLevelIndex + 1
--
-- src/lib/constants.js exports MAX_POSSIBLE_SCORE and MAX_LEVEL so the app and
-- this migration cannot drift apart silently.
--
-- IF YOU ADD OR REMOVE QUESTIONS the maximum score changes. Re-run this
-- migration with the new figure: the constraint is dropped and re-added, so a
-- re-run updates it in place. Leaving it stale would reject legitimate scores
-- from a perfect run.
-- =====================================================================

begin;

do $$
begin
    if to_regnamespace('public') is null then
        raise exception 'public schema not found; wrong database?';
    end if;
end;
$$;


-- =====================================================================
-- 1. kogi_quest_leaderboard
-- =====================================================================
create table if not exists public.kogi_quest_leaderboard (
    id          uuid        primary key default gen_random_uuid(),
    user_id     uuid        not null references auth.users (id) on delete cascade,
    username    text        not null,
    score       integer     not null default 0,
    level       integer     not null default 1,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

comment on table public.kogi_quest_leaderboard is
    'KogiQuest: one row per player holding their best self-reported run. Written only via kogi_quest_submit_score(). user_id is granted to no client role.';

-- ---------------------------------------------------------------------
-- Validation: one leaderboard record per authenticated user, plus range
-- and shape checks on everything a client can influence.
-- ---------------------------------------------------------------------
do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.kogi_quest_leaderboard'::regclass
          and conname  = 'kogi_quest_leaderboard_user_id_key'
    ) then
        alter table public.kogi_quest_leaderboard
            add constraint kogi_quest_leaderboard_user_id_key unique (user_id);
    end if;
end;
$$;

alter table public.kogi_quest_leaderboard
    drop constraint if exists kogi_quest_leaderboard_username_check;
alter table public.kogi_quest_leaderboard
    add  constraint kogi_quest_leaderboard_username_check
    check (char_length(btrim(username)) between 1 and 50);

-- Every correct answer is worth exactly 100 points and there are 543
-- questions, so the only valid totals are multiples of 100 from 0 to 54300.
-- This rejects malformed and impossible values. It does not prove the score
-- was earned.
alter table public.kogi_quest_leaderboard
    drop constraint if exists kogi_quest_leaderboard_score_check;
alter table public.kogi_quest_leaderboard
    add  constraint kogi_quest_leaderboard_score_check
    check (score >= 0 and score <= 54300 and score % 100 = 0);

-- 11 levels exist; GameEngine submits currentLevelIndex + 1.
alter table public.kogi_quest_leaderboard
    drop constraint if exists kogi_quest_leaderboard_level_check;
alter table public.kogi_quest_leaderboard
    add  constraint kogi_quest_leaderboard_level_check
    check (level >= 1 and level <= 11);

create index if not exists kogi_quest_leaderboard_score_idx
    on public.kogi_quest_leaderboard (score desc, created_at asc);


-- ---------------------------------------------------------------------
-- RLS: enabled, with a read-only policy for client roles. Row visibility
-- is public; COLUMN visibility is handled by the grants below.
-- ---------------------------------------------------------------------
alter table public.kogi_quest_leaderboard enable row level security;

revoke all on public.kogi_quest_leaderboard from anon;
revoke all on public.kogi_quest_leaderboard from authenticated;

-- The allow-list. `user_id` and `updated_at` are deliberately absent.
grant select (id, created_at, username, score, level)
    on public.kogi_quest_leaderboard to anon, authenticated;

-- Deliberately no INSERT, UPDATE or DELETE grant to any client role:
-- kogi_quest_submit_score() is the only write path.

drop policy if exists "kq leaderboard: public read" on public.kogi_quest_leaderboard;
create policy "kq leaderboard: public read"
    on public.kogi_quest_leaderboard for select
    to anon, authenticated
    using (true);

-- Defence in depth. These write policies are unreachable today because no
-- client role holds an INSERT or UPDATE grant. They exist so that if such a
-- grant is ever added by mistake, ownership is still enforced.
drop policy if exists "kq leaderboard: insert own row" on public.kogi_quest_leaderboard;
create policy "kq leaderboard: insert own row"
    on public.kogi_quest_leaderboard for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists "kq leaderboard: update own row" on public.kogi_quest_leaderboard;
create policy "kq leaderboard: update own row"
    on public.kogi_quest_leaderboard for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);


-- ---------------------------------------------------------------------
-- The one write path.
--
-- SECURITY DEFINER so it can write a table clients cannot touch directly.
-- The owner is derived from auth.uid() rather than trusted from a parameter,
-- so a caller cannot submit for anybody else. Empty search_path and fully
-- qualified references prevent search_path capture.
--
-- Returns the player's stored best score, so the client can report the
-- outcome without reading the row back.
-- ---------------------------------------------------------------------
create or replace function public.kogi_quest_submit_score(
    p_score    integer,
    p_level    integer,
    p_username text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_uid  uuid    := (select auth.uid());
    v_name text    := left(btrim(coalesce(p_username, '')), 50);
    v_best integer;
begin
    if v_uid is null then
        raise exception 'A signed-in player is required to submit a score'
            using errcode = '42501';
    end if;

    -- 543 questions x 100 points. See the header for the source references.
    if p_score is null or p_score < 0 or p_score > 54300 or p_score % 100 <> 0 then
        raise exception 'Invalid score: expected a multiple of 100 between 0 and 54300'
            using errcode = '22023';
    end if;

    if p_level is null or p_level < 1 or p_level > 11 then
        raise exception 'Invalid level: expected a value between 1 and 11'
            using errcode = '22023';
    end if;

    if v_name = '' then
        v_name := 'Explorer';
    end if;

    insert into public.kogi_quest_leaderboard as l
        (user_id, username, score, level)
    values
        (v_uid, v_name, p_score, p_level)
    on conflict (user_id) do update
        set score      = greatest(l.score, excluded.score),
            -- Keep the level belonging to the better run.
            level      = case when excluded.score > l.score
                              then excluded.level else l.level end,
            -- A player may always correct their display name.
            username   = excluded.username,
            updated_at = now()
    returning l.score into v_best;

    return v_best;
end;
$$;

comment on function public.kogi_quest_submit_score(integer, integer, text) is
    'KogiQuest: the only write path to the leaderboard. Owner taken from auth.uid(); keeps the player''s highest score. Scores are self-reported, not server-verified.';

-- EXECUTE is granted to PUBLIC by default; take it back and hand it only to
-- signed-in players. Anonymous visitors cannot call this at all.
revoke all on function public.kogi_quest_submit_score(integer, integer, text) from public;
revoke all on function public.kogi_quest_submit_score(integer, integer, text) from anon;
grant execute on function public.kogi_quest_submit_score(integer, integer, text) to authenticated;


-- =====================================================================
-- 2. kogi_quest_question_suggestions
-- =====================================================================
create table if not exists public.kogi_quest_question_suggestions (
    id                uuid        primary key default gen_random_uuid(),
    user_id           uuid        not null references auth.users (id) on delete cascade,
    question_id       text        not null,
    suggested_answer  text,
    user_comment      text,
    status            text        not null default 'pending',
    created_at        timestamptz not null default now()
);

comment on table public.kogi_quest_question_suggestions is
    'KogiQuest: question reports from signed-in players. Insert-only for players; readable only by the service role.';

alter table public.kogi_quest_question_suggestions
    drop constraint if exists kogi_quest_question_suggestions_status_check;
alter table public.kogi_quest_question_suggestions
    add  constraint kogi_quest_question_suggestions_status_check
    check (status in ('pending', 'approved', 'rejected'));

alter table public.kogi_quest_question_suggestions
    drop constraint if exists kogi_quest_question_suggestions_question_id_check;
alter table public.kogi_quest_question_suggestions
    add  constraint kogi_quest_question_suggestions_question_id_check
    check (char_length(btrim(question_id)) between 1 and 100);

alter table public.kogi_quest_question_suggestions
    drop constraint if exists kogi_quest_question_suggestions_suggested_answer_check;
alter table public.kogi_quest_question_suggestions
    add  constraint kogi_quest_question_suggestions_suggested_answer_check
    check (suggested_answer is null or char_length(suggested_answer) <= 500);

alter table public.kogi_quest_question_suggestions
    drop constraint if exists kogi_quest_question_suggestions_user_comment_check;
alter table public.kogi_quest_question_suggestions
    add  constraint kogi_quest_question_suggestions_user_comment_check
    check (user_comment is null or char_length(user_comment) <= 2000);

alter table public.kogi_quest_question_suggestions
    drop constraint if exists kogi_quest_question_suggestions_not_empty_check;
alter table public.kogi_quest_question_suggestions
    add  constraint kogi_quest_question_suggestions_not_empty_check
    check (
        char_length(btrim(coalesce(suggested_answer, ''))) > 0
        or char_length(btrim(coalesce(user_comment, ''))) > 0
    );

create index if not exists kogi_quest_question_suggestions_status_idx
    on public.kogi_quest_question_suggestions (status, created_at desc);

alter table public.kogi_quest_question_suggestions enable row level security;

revoke all on public.kogi_quest_question_suggestions from anon;
revoke all on public.kogi_quest_question_suggestions from authenticated;
grant insert on public.kogi_quest_question_suggestions to authenticated;

drop policy if exists "kq reports: insert own pending report"
    on public.kogi_quest_question_suggestions;
create policy "kq reports: insert own pending report"
    on public.kogi_quest_question_suggestions for insert
    to authenticated
    with check ((select auth.uid()) = user_id and status = 'pending');

-- No SELECT / UPDATE / DELETE policy and no matching grant: reports are
-- unreadable and unmodifiable by every client role, including their author.

commit;


-- =====================================================================
-- Tell PostgREST about the new tables and function
-- =====================================================================
-- Supabase's API layer caches the schema. Without this, the new objects can
-- return PGRST205 ("Could not find the table ... in the schema cache") until
-- the cache happens to refresh. Sent after COMMIT so the objects already
-- exist when PostgREST re-reads them.
notify pgrst, 'reload schema';


-- =====================================================================
-- Verification summary (read-only)
-- =====================================================================
-- One result set, so the Supabase SQL Editor shows it after the migration.
-- Column checks are guarded, so a table without a given column reports NULL
-- rather than erroring.
with obj(label, qname) as (
    values
        ('1. kogi_quest_leaderboard',           'public.kogi_quest_leaderboard'),
        ('2. kogi_quest_question_suggestions',  'public.kogi_quest_question_suggestions'),
        ('3. question_suggestions (other app)', 'public.question_suggestions')
),
res as (
    select label, qname, to_regclass(qname) as rel from obj
)
select
    label                                                       as object,
    (rel is not null)                                           as exists,
    (select c.relrowsecurity from pg_class c where c.oid = rel) as rls_enabled,
    (select count(*) from pg_policies p
      where p.schemaname = split_part(qname, '.', 1)
        and p.tablename  = split_part(qname, '.', 2))           as policies,
    case when rel is not null and exists (
             select 1 from pg_attribute
              where attrelid = rel and attname = 'username'
                and attnum > 0 and not attisdropped)
         then has_column_privilege('anon', rel, 'username', 'SELECT')
    end                                                         as anon_reads_username,
    case when rel is not null and exists (
             select 1 from pg_attribute
              where attrelid = rel and attname = 'user_id'
                and attnum > 0 and not attisdropped)
         then has_column_privilege('anon', rel, 'user_id', 'SELECT')
    end                                                         as anon_reads_user_id,
    case when rel is not null
         then has_table_privilege('authenticated', rel, 'UPDATE')
    end                                                         as auth_can_update
from res

union all

select
    '4. kogi_quest_submit_score() [function]',
    to_regprocedure('public.kogi_quest_submit_score(integer,integer,text)') is not null,
    null::boolean,
    0::bigint,
    -- reuse the two boolean slots: can authenticated / anon execute it?
    case when to_regprocedure('public.kogi_quest_submit_score(integer,integer,text)') is not null
         then has_function_privilege('authenticated',
                to_regprocedure('public.kogi_quest_submit_score(integer,integer,text)'), 'EXECUTE')
    end,
    case when to_regprocedure('public.kogi_quest_submit_score(integer,integer,text)') is not null
         then has_function_privilege('anon',
                to_regprocedure('public.kogi_quest_submit_score(integer,integer,text)'), 'EXECUTE')
    end,
    null::boolean;
