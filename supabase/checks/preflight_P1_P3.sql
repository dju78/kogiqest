-- =====================================================================
-- KogiQuest — PREFLIGHT checks P1-P3  (READ-ONLY)
-- =====================================================================
-- Run these in the Supabase SQL Editor BEFORE applying
-- supabase/migrations/0001_kogi_quest_namespaced_schema.sql
--
-- Nothing here writes, creates, alters or drops anything. Save the output:
-- P1 and P2 are the baseline you compare against in post-migration check V7,
-- to prove the shared project's `public.question_suggestions` was untouched.
-- =====================================================================


-- ---------------------------------------------------------------------
-- P1) Baseline for the other application's table.
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


-- ---------------------------------------------------------------------
-- P2) Its exact policy list.
-- ---------------------------------------------------------------------
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'question_suggestions'
order by policyname;


-- ---------------------------------------------------------------------
-- P3) Confirm nothing already uses the KogiQuest names.
--     All three are expected to be NULL on a first run. If any is
--     non-NULL the migration is still safe (it is idempotent), but you
--     are re-running rather than installing.
-- ---------------------------------------------------------------------
select
    to_regclass('public.kogi_quest_leaderboard')                                as leaderboard_table,
    to_regclass('public.kogi_quest_question_suggestions')                       as reports_table,
    to_regprocedure('public.kogi_quest_submit_score(integer,integer,text)')     as submit_score_fn,
    (select count(*) from pg_views
      where schemaname = 'public' and viewname like 'kogi_quest%')              as kogi_quest_views;
