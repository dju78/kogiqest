-- =====================================================================
-- KogiQuest — POST-MIGRATION verification V1-V8  (READ-ONLY)
-- =====================================================================
-- Run these in the Supabase SQL Editor AFTER applying
-- supabase/migrations/0001_kogi_quest_namespaced_schema.sql
--
-- Nothing here writes, creates, alters or drops anything.
-- Expected results are noted under each query.
-- =====================================================================


-- ---------------------------------------------------------------------
-- V1) Column privileges: the allow-list, and the absence of user_id.
-- ---------------------------------------------------------------------
select
    a.attname                                                                                  as column_name,
    has_column_privilege('anon',          'public.kogi_quest_leaderboard', a.attname, 'SELECT') as anon_select,
    has_column_privilege('authenticated', 'public.kogi_quest_leaderboard', a.attname, 'SELECT') as auth_select
from pg_attribute a
where a.attrelid = 'public.kogi_quest_leaderboard'::regclass
  and a.attnum > 0
  and not a.attisdropped
order by a.attnum;
-- EXPECTED
--   id, username, score, level, created_at  ->  t / t
--   user_id, updated_at                     ->  f / f


-- ---------------------------------------------------------------------
-- V2) No client write privilege on the leaderboard.
-- ---------------------------------------------------------------------
select
    has_table_privilege('anon',          'public.kogi_quest_leaderboard', 'SELECT') as anon_select_any,
    has_table_privilege('anon',          'public.kogi_quest_leaderboard', 'INSERT') as anon_insert,
    has_table_privilege('authenticated', 'public.kogi_quest_leaderboard', 'INSERT') as auth_insert,
    has_table_privilege('authenticated', 'public.kogi_quest_leaderboard', 'UPDATE') as auth_update,
    has_table_privilege('authenticated', 'public.kogi_quest_leaderboard', 'DELETE') as auth_delete;
-- EXPECTED: f | f | f | f | f
-- (anon_select_any is false because the grant is column-level, not table-level.)


-- ---------------------------------------------------------------------
-- V3) The write function is hardened and correctly granted.
-- ---------------------------------------------------------------------
select
    p.proname,
    p.prosecdef                                               as security_definer,
    p.proconfig                                               as settings,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_execute,
    has_function_privilege('anon',          p.oid, 'EXECUTE') as anon_execute,
    has_function_privilege('public',        p.oid, 'EXECUTE') as public_execute
from pg_proc p
where p.oid = 'public.kogi_quest_submit_score(integer,integer,text)'::regprocedure;
-- EXPECTED: security_definer = t
--           settings         = {"search_path=\"\""}
--           auth_execute     = t
--           anon_execute     = f
--           public_execute   = f


-- ---------------------------------------------------------------------
-- V4) No definer-rights view was introduced.
-- ---------------------------------------------------------------------
select count(*) as kogi_quest_views
from pg_views
where schemaname = 'public' and viewname like 'kogi_quest%';
-- EXPECTED: 0


-- ---------------------------------------------------------------------
-- V5) RLS is enabled, with the expected policies.
-- ---------------------------------------------------------------------
select
    c.relname                                                    as table_name,
    c.relrowsecurity                                             as rls_enabled,
    (select count(*) from pg_policies p
      where p.schemaname = 'public' and p.tablename = c.relname)  as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'                 -- ordinary tables only, not indexes
  and c.relname like 'kogi_quest_%'
order by c.relname;
-- EXPECTED: kogi_quest_leaderboard          | t | 3
--           kogi_quest_question_suggestions | t | 1

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename like 'kogi_quest_%'
order by tablename, policyname;
-- EXPECTED (4 rows):
--   kogi_quest_leaderboard          | kq leaderboard: insert own row       | INSERT | {authenticated}
--   kogi_quest_leaderboard          | kq leaderboard: public read          | SELECT | {anon,authenticated} | qual = true
--   kogi_quest_leaderboard          | kq leaderboard: update own row       | UPDATE | {authenticated}
--   kogi_quest_question_suggestions | kq reports: insert own pending report| INSERT | {authenticated}


-- ---------------------------------------------------------------------
-- V6) Validation constraints.
-- ---------------------------------------------------------------------
select
    conrelid::regclass::text as table_name,
    conname                  as constraint_name,
    pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('public.kogi_quest_leaderboard'::regclass,
                   'public.kogi_quest_question_suggestions'::regclass)
order by 1, 2;
-- EXPECTED to include:
--   kogi_quest_leaderboard_user_id_key            UNIQUE (user_id)
--   kogi_quest_leaderboard_score_check            CHECK (score >= 0 AND score <= 54300 AND score % 100 = 0)
--   kogi_quest_leaderboard_level_check            CHECK (level >= 1 AND level <= 11)
--   kogi_quest_leaderboard_username_check         CHECK (char_length(btrim(username)) BETWEEN 1 AND 50)
--   ..._question_suggestions_status_check         CHECK (status IN ('pending','approved','rejected'))
--   ..._question_suggestions_not_empty_check      CHECK (answer or comment non-blank)
--   plus the question_id / suggested_answer / user_comment length checks


-- ---------------------------------------------------------------------
-- V7) The other application's table is exactly as recorded in P1/P2.
--     Re-run these two and compare against the preflight output.
-- ---------------------------------------------------------------------
select
    (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'question_suggestions')      as policies,
    (select relrowsecurity from pg_class
      where oid = to_regclass('public.question_suggestions'))                  as rls_enabled,
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'question_suggestions')   as columns,
    (select count(*) from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'question_suggestions')   as grants;

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'question_suggestions'
order by policyname;

-- And prove no KogiQuest policy was added to it:
select count(*) as kq_policies_on_other_app_table
from pg_policies
where schemaname = 'public' and tablename = 'question_suggestions'
  and policyname like 'kq %';
-- EXPECTED: 0


-- ---------------------------------------------------------------------
-- V8) Did the previously-deployed build write KogiQuest reports into the
--     other application's table? KogiQuest question ids look like
--     'tki1', 'trb3', 'in7' — a short letter prefix plus digits.
-- ---------------------------------------------------------------------
select
    id,
    created_at,
    question_id,
    left(coalesce(user_comment, ''), 60) as comment_preview
from public.question_suggestions
where question_id ~ '^[a-z]{2,4}[0-9]+$'
order by created_at desc
limit 50;
-- Any rows returned are KogiQuest reports sitting in another application's
-- table, written by the build currently live on GitHub Pages. Decide with that
-- table's owner whether to migrate or delete them. The migration deliberately
-- does not touch them.
