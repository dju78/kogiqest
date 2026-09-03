-- =====================================================================
-- KogiQuest RLS + privilege test suite
-- =====================================================================
-- Runs the real policies, grants and function against a real Postgres as the
-- real `anon` and `authenticated` roles. Every check raises on failure, so a
-- clean run means every assertion held.
--
--   npm run test:db
-- =====================================================================

\set ON_ERROR_STOP on
\timing off

insert into auth.users (id, email) values
    ('11111111-1111-1111-1111-111111111111', 'ada@example.com'),
    ('22222222-2222-2222-2222-222222222222', 'bola@example.com')
on conflict (id) do nothing;

create or replace function pg_temp.sign_in(p_user uuid)
returns void language sql as $$
    select set_config('request.jwt.claims',
                      json_build_object('sub', p_user)::text, false);
$$;

create or replace function pg_temp.sign_out()
returns void language sql as $$
    select set_config('request.jwt.claims', '', false);
$$;

create or replace function pg_temp.must_fail(p_label text, p_sql text)
returns void language plpgsql as $$
begin
    begin
        execute p_sql;
    exception when others then
        raise notice 'PASS  %  (blocked: %)', p_label, replace(sqlerrm, E'\n', ' ');
        return;
    end;
    raise exception 'FAIL  %  -- statement was allowed but must have been blocked', p_label;
end;
$$;

create or replace function pg_temp.check_true(p_label text, p_cond boolean)
returns void language plpgsql as $$
begin
    if p_cond is not true then
        raise exception 'FAIL  %', p_label;
    end if;
    raise notice 'PASS  %', p_label;
end;
$$;


-- =====================================================================
-- A. Write path: only the RPC, only for signed-in players
-- =====================================================================

-- 1-3. Clients hold no direct write privilege at all.
select pg_temp.check_true('1. authenticated has NO direct INSERT on leaderboard',
    not has_table_privilege('authenticated', 'public.kogi_quest_leaderboard', 'INSERT'));
select pg_temp.check_true('2. authenticated has NO direct UPDATE on leaderboard',
    not has_table_privilege('authenticated', 'public.kogi_quest_leaderboard', 'UPDATE'));
select pg_temp.check_true('3. authenticated has NO DELETE on leaderboard',
    not has_table_privilege('authenticated', 'public.kogi_quest_leaderboard', 'DELETE'));

-- 4. Anonymous visitors cannot call the submission function.
set role anon;
select pg_temp.sign_out();
select pg_temp.must_fail('4. anon cannot execute kogi_quest_submit_score',
    $$select public.kogi_quest_submit_score(500, 3, 'ghost')$$);
reset role;

-- 5. A signed-in player submits their own score through the RPC.
set role authenticated;
select pg_temp.sign_in('11111111-1111-1111-1111-111111111111');
select pg_temp.check_true('5. signed-in player submits a score via RPC',
    (select public.kogi_quest_submit_score(500, 3, 'ada') = 500));
reset role;

-- 6. The row is owned by the caller: the RPC never takes an id parameter.
select pg_temp.check_true('6. row is owned by auth.uid(), not a client parameter',
    (select user_id = '11111111-1111-1111-1111-111111111111'
       from public.kogi_quest_leaderboard where username = 'ada'));

-- 7. A signed-in player cannot write directly, even as themselves.
set role authenticated;
select pg_temp.sign_in('11111111-1111-1111-1111-111111111111');
select pg_temp.must_fail('7. player cannot INSERT into the leaderboard directly',
    $$insert into public.kogi_quest_leaderboard (user_id, username, score, level)
      values ('11111111-1111-1111-1111-111111111111', 'ada', 9999900, 99)$$);
select pg_temp.must_fail('8. player cannot UPDATE the leaderboard directly',
    $$update public.kogi_quest_leaderboard set score = 1000000$$);
select pg_temp.must_fail('9. player cannot DELETE from the leaderboard',
    $$delete from public.kogi_quest_leaderboard$$);
reset role;

-- 10-12. Highest score is preserved; one row per player.
set role authenticated;
select pg_temp.sign_in('11111111-1111-1111-1111-111111111111');
select public.kogi_quest_submit_score(900, 5, 'ada');
select pg_temp.check_true('10. a better run raises the stored score',
    (select public.kogi_quest_submit_score(900, 5, 'ada') = 900));
select pg_temp.check_true('11. a worse run does NOT lower the stored score',
    (select public.kogi_quest_submit_score(100, 1, 'ada') = 900));
reset role;
select pg_temp.check_true('12. exactly one leaderboard row per player',
    (select count(*) = 1 from public.kogi_quest_leaderboard
      where user_id = '11111111-1111-1111-1111-111111111111'));
select pg_temp.check_true('13. the level of the better run is retained',
    (select level = 5 from public.kogi_quest_leaderboard
      where user_id = '11111111-1111-1111-1111-111111111111'));

-- 14. One player's submission cannot affect another player's row.
set role authenticated;
select pg_temp.sign_in('22222222-2222-2222-2222-222222222222');
select public.kogi_quest_submit_score(700, 4, 'bola');
reset role;
select pg_temp.check_true('14. a second player gets their own row, first untouched',
    (select count(*) = 2 from public.kogi_quest_leaderboard)
    and (select score = 900 from public.kogi_quest_leaderboard
          where user_id = '11111111-1111-1111-1111-111111111111'));

-- 15-18. Server-side validation inside the RPC.
set role authenticated;
select pg_temp.sign_in('11111111-1111-1111-1111-111111111111');
select pg_temp.must_fail('15. RPC rejects a negative score',
    $$select public.kogi_quest_submit_score(-100, 1, 'ada')$$);
select pg_temp.must_fail('16. RPC rejects a score above the real maximum (54300)',
    $$select public.kogi_quest_submit_score(54400, 1, 'ada')$$);
select pg_temp.must_fail('17. RPC rejects a score that is not a multiple of 100',
    $$select public.kogi_quest_submit_score(157, 1, 'ada')$$);
select pg_temp.must_fail('18. RPC rejects level 0',
    $$select public.kogi_quest_submit_score(500, 0, 'ada')$$);
-- Boundary: a perfect run is exactly 543 questions x 100 = 54300 on level 11.
select pg_temp.must_fail('18b. RPC rejects level 12 (only 11 levels exist)',
    $$select public.kogi_quest_submit_score(500, 12, 'ada')$$);
select pg_temp.check_true('18c. RPC accepts a perfect score of 54300 on level 11',
    (select public.kogi_quest_submit_score(54300, 11, 'ada') = 54300));
select pg_temp.must_fail('18d. direct write of an impossible score is blocked anyway',
    $$insert into public.kogi_quest_leaderboard (user_id, username, score, level)
      values ('11111111-1111-1111-1111-111111111111', 'ada', 54400, 11)$$);
select public.kogi_quest_submit_score(900, 5, repeat('x', 80));
reset role;
-- Verified as the owner: `authenticated` deliberately cannot filter on user_id.
select pg_temp.check_true('19. RPC clamps an over-long username to 50 chars',
    (select char_length(username) = 50 from public.kogi_quest_leaderboard
      where user_id = '11111111-1111-1111-1111-111111111111'));

set role authenticated;
select pg_temp.sign_in('11111111-1111-1111-1111-111111111111');
select pg_temp.check_true('20. RPC substitutes a default for a blank username',
    (select public.kogi_quest_submit_score(900, 5, '   ') = 54300));
reset role;
select pg_temp.check_true('21. blank username became the default, not empty',
    (select username = 'Explorer' from public.kogi_quest_leaderboard
      where user_id = '11111111-1111-1111-1111-111111111111'));

-- 22. The function is hardened.
select pg_temp.check_true('22. RPC is SECURITY DEFINER with an empty search_path',
    (select p.prosecdef
              and exists (select 1 from unnest(p.proconfig) c
                           where c like 'search_path=%'
                             and btrim(split_part(c, '=', 2), '"') = '')
       from pg_proc p
      where p.oid = 'public.kogi_quest_submit_score(integer,integer,text)'::regprocedure));


-- =====================================================================
-- B. Read path: column privileges, no definer-rights view
-- =====================================================================

-- 23. There is no view in front of the leaderboard.
select pg_temp.check_true('23. no definer-rights leaderboard view exists',
    (select not exists (select 1 from pg_views
       where schemaname = 'public' and viewname like 'kogi_quest_leaderboard%')));

-- 24-25. Anonymous visitors read the safe columns.
set role anon;
select pg_temp.sign_out();
create temp table anon_rows as
    select id, created_at, username, score, level
      from public.kogi_quest_leaderboard;
reset role;
select pg_temp.check_true('24. anon can read the safe leaderboard columns',
    (select count(*) = 2 from anon_rows));
-- Ada's best is now the perfect 54300 from assertion 18c; Bola's is 700.
select pg_temp.check_true('25. anon sees both players'' scores',
    (select count(*) = 2 from anon_rows where score in (54300, 700)));

-- 26-29. user_id is unreachable from every angle.
set role anon;
select pg_temp.sign_out();
select pg_temp.must_fail('26. anon cannot SELECT user_id',
    $$select user_id from public.kogi_quest_leaderboard$$);
select pg_temp.must_fail('27. anon cannot SELECT *',
    $$select * from public.kogi_quest_leaderboard$$);
select pg_temp.must_fail('28. anon cannot FILTER on user_id',
    $$select id from public.kogi_quest_leaderboard
       where user_id = '11111111-1111-1111-1111-111111111111'$$);
select pg_temp.must_fail('29. anon cannot ORDER BY user_id',
    $$select id from public.kogi_quest_leaderboard order by user_id$$);
select pg_temp.must_fail('30. anon cannot read updated_at',
    $$select updated_at from public.kogi_quest_leaderboard$$);
reset role;

-- 31-33. The same holds for a signed-in player: no one gets user_id.
set role authenticated;
select pg_temp.sign_in('11111111-1111-1111-1111-111111111111');
select pg_temp.must_fail('31. authenticated cannot SELECT user_id',
    $$select user_id from public.kogi_quest_leaderboard$$);
select pg_temp.must_fail('32. authenticated cannot FILTER on user_id',
    $$select id from public.kogi_quest_leaderboard
       where user_id = '22222222-2222-2222-2222-222222222222'$$);
reset role;
select pg_temp.check_true('33. user_id is granted to no client role',
    not has_column_privilege('anon', 'public.kogi_quest_leaderboard', 'user_id', 'SELECT')
    and not has_column_privilege('authenticated', 'public.kogi_quest_leaderboard', 'user_id', 'SELECT'));

-- 34. RLS is still on.
select pg_temp.check_true('34. RLS remains enabled on the leaderboard',
    (select relrowsecurity from pg_class
      where oid = 'public.kogi_quest_leaderboard'::regclass));


-- =====================================================================
-- C. Question reports
-- =====================================================================

set role anon;
select pg_temp.sign_out();
select pg_temp.must_fail('35. anon cannot file a report',
    $$insert into public.kogi_quest_question_suggestions
        (user_id, question_id, user_comment)
      values ('11111111-1111-1111-1111-111111111111', 'tki1', 'wrong answer')$$);
reset role;

set role authenticated;
select pg_temp.sign_in('11111111-1111-1111-1111-111111111111');
insert into public.kogi_quest_question_suggestions
    (user_id, question_id, suggested_answer, user_comment)
values ('11111111-1111-1111-1111-111111111111', 'tki1', 'Otafun', 'Listed answer looks wrong.');
reset role;
select pg_temp.check_true('36. a signed-in player can file a report',
    (select count(*) = 1 from public.kogi_quest_question_suggestions where question_id = 'tki1'));
select pg_temp.check_true('37. a new report is always pending',
    (select status = 'pending' from public.kogi_quest_question_suggestions where question_id = 'tki1'));

set role authenticated;
select pg_temp.sign_in('11111111-1111-1111-1111-111111111111');
select pg_temp.must_fail('38. a client cannot create an approved report',
    $$insert into public.kogi_quest_question_suggestions
        (user_id, question_id, user_comment, status)
      values ('11111111-1111-1111-1111-111111111111', 'tki2', 'x', 'approved')$$);
select pg_temp.must_fail('39. a client cannot create a rejected report',
    $$insert into public.kogi_quest_question_suggestions
        (user_id, question_id, user_comment, status)
      values ('11111111-1111-1111-1111-111111111111', 'tki2', 'x', 'rejected')$$);
select pg_temp.must_fail('40. a player cannot file a report for another user',
    $$insert into public.kogi_quest_question_suggestions
        (user_id, question_id, user_comment)
      values ('22222222-2222-2222-2222-222222222222', 'tki3', 'not mine')$$);
select pg_temp.must_fail('41. the author cannot read their reports back',
    $$select 1 from public.kogi_quest_question_suggestions$$);
select pg_temp.must_fail('42. the author cannot update a report',
    $$update public.kogi_quest_question_suggestions set status = 'approved'$$);
select pg_temp.must_fail('43. the author cannot delete a report',
    $$delete from public.kogi_quest_question_suggestions$$);
select pg_temp.must_fail('44. empty report rejected',
    $$insert into public.kogi_quest_question_suggestions
        (user_id, question_id, suggested_answer, user_comment)
      values ('11111111-1111-1111-1111-111111111111', 'tki4', '   ', '')$$);
select pg_temp.must_fail('45. over-long comment rejected',
    $$insert into public.kogi_quest_question_suggestions
        (user_id, question_id, user_comment)
      values ('11111111-1111-1111-1111-111111111111', 'tki4', repeat('x', 2001))$$);
select pg_temp.must_fail('46. over-long suggested answer rejected',
    $$insert into public.kogi_quest_question_suggestions
        (user_id, question_id, suggested_answer)
      values ('11111111-1111-1111-1111-111111111111', 'tki4', repeat('x', 501))$$);
select pg_temp.must_fail('47. blank question_id rejected',
    $$insert into public.kogi_quest_question_suggestions
        (user_id, question_id, user_comment)
      values ('11111111-1111-1111-1111-111111111111', '  ', 'x')$$);
reset role;

set role anon;
select pg_temp.sign_out();
select pg_temp.must_fail('48. anon cannot read reports',
    $$select 1 from public.kogi_quest_question_suggestions$$);
reset role;


-- =====================================================================
-- D. The shared project is left alone
-- =====================================================================
select pg_temp.check_true('49. no KogiQuest policy was added to question_suggestions',
    (select not exists (select 1 from pg_policies
       where schemaname = 'public' and tablename = 'question_suggestions'
         and policyname like 'kq %')));
select pg_temp.check_true('50. question_suggestions columns are unchanged',
    (select array_agg(column_name::text order by column_name)
       = array['created_at','id','question_id','status','suggested_answer','user_comment','user_id']
       from information_schema.columns
      where table_schema = 'public' and table_name = 'question_suggestions'));
select pg_temp.check_true('51. question_suggestions RLS flag untouched (still off in fixture)',
    (select not relrowsecurity from pg_class
      where oid = 'public.question_suggestions'::regclass));

\echo ''
\echo '================================================'
\echo ' All KogiQuest database assertions passed.'
\echo '================================================'
