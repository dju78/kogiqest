import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createFakeSupabase, makeSession, GRANTED_COLUMNS, MAX_SCORE, MAX_LEVEL } from './fakeSupabase';

const ADA = '11111111-1111-1111-1111-111111111111';
const BOLA = '22222222-2222-2222-2222-222222222222';

let fake;

vi.mock('../lib/supabase', async () => {
    const actual = await vi.importActual('../lib/supabase');
    return { ...actual, get supabase() { return fake; }, configError: null, isConfigured: true };
});

const { TABLES, RPC, LEADERBOARD_PUBLIC_COLUMNS } = await import('../lib/supabase');
const ReportIssueModal = (await import('../components/ReportIssueModal')).default;
const Leaderboard = (await import('../components/Leaderboard')).default;
const Hero = (await import('../components/Hero')).default;

beforeEach(() => { localStorage.clear(); });
afterEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
describe('namespacing', () => {
    it('uses kogi_quest_ prefixed objects only', () => {
        expect(TABLES.leaderboard).toBe('kogi_quest_leaderboard');
        expect(TABLES.questionSuggestions).toBe('kogi_quest_question_suggestions');
        expect(RPC.submitScore).toBe('kogi_quest_submit_score');
    });

    it("never references the shared project's question_suggestions table", () => {
        expect(Object.values(TABLES)).not.toContain('question_suggestions');
        expect(Object.values(TABLES)).not.toContain('leaderboard');
    });

    it('no longer depends on a definer-rights public view', () => {
        expect(TABLES).not.toHaveProperty('leaderboardPublic');
    });
});

// ---------------------------------------------------------------------------
describe('score submission (authenticated)', () => {
    beforeEach(() => { fake = createFakeSupabase({ session: makeSession(ADA) }); });

    const submit = (score, level = 11, username = 'ada') =>
        fake.rpc(RPC.submitScore, { p_score: score, p_level: level, p_username: username });

    it('a signed-in player submits their score through the RPC', async () => {
        const { data, error } = await submit(500);
        expect(error).toBeNull();
        expect(data).toBe(500);
        expect(fake.__state.rpcCalls[0].fn).toBe('kogi_quest_submit_score');
    });

    it('never sends a user id from the client', async () => {
        await submit(500);
        expect(Object.keys(fake.__state.rpcCalls[0].args)).toEqual(['p_score', 'p_level', 'p_username']);
        expect(JSON.stringify(fake.__state.rpcCalls[0].args)).not.toContain(ADA);
    });

    it('keeps one leaderboard record per player', async () => {
        await submit(500); await submit(900); await submit(100);
        expect(fake.__state.leaderboard.size).toBe(1);
    });

    it('retains the highest score', async () => {
        await submit(500); await submit(900, 11); await submit(100, 2);
        const row = fake.__state.leaderboard.get(ADA);
        expect(row.score).toBe(900);
        expect(row.level).toBe(11);
    });

    it('rejects a score that is not a multiple of 100', async () => {
        expect((await submit(157)).error.code).toBe('22023');
    });

    it('uses the real game limits, not round numbers', () => {
        expect(MAX_SCORE).toBe(54300);   // 543 questions x 100 points
        expect(MAX_LEVEL).toBe(11);      // GAME_LEVELS.length
    });

    it('accepts a perfect run at the exact maximum', async () => {
        const { data, error } = await submit(MAX_SCORE, MAX_LEVEL);
        expect(error).toBeNull();
        expect(data).toBe(MAX_SCORE);
    });

    it('rejects an out-of-range score and level', async () => {
        expect((await submit(-100)).error).not.toBeNull();
        expect((await submit(MAX_SCORE + 100)).error).not.toBeNull();
        expect((await submit(500, 0)).error).not.toBeNull();
        expect((await submit(500, MAX_LEVEL + 1)).error).not.toBeNull();
    });

    it('has no direct write path to the table', async () => {
        expect((await fake.from(TABLES.leaderboard).upsert({ score: 1000000 })).error.code).toBe('42501');
        expect((await fake.from(TABLES.leaderboard).update({ score: 1000000 })).error.code).toBe('42501');
        expect((await fake.from(TABLES.leaderboard).delete()).error.code).toBe('42501');
    });
});

// ---------------------------------------------------------------------------
describe('guest play', () => {
    beforeEach(() => { fake = createFakeSupabase({ session: null }); });

    it('an anonymous visitor cannot call the score RPC', async () => {
        const { error } = await fake.rpc(RPC.submitScore, { p_score: 500, p_level: 1, p_username: 'ghost' });
        expect(error.code).toBe('42501');
        expect(fake.__state.leaderboard.size).toBe(0);
    });

    it('Start Game is offered to a signed-out visitor', () => {
        render(<MemoryRouter><Hero user={null} /></MemoryRouter>);
        expect(screen.getByRole('button', { name: /start game/i })).toBeTruthy();
    });

    it('Hero contains no signed-out redirect to /auth', () => {
        expect(Hero.toString()).not.toContain('/auth');
    });

    it('a guest run writes nothing to the database', async () => {
        render(<MemoryRouter><Hero user={null} /></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: /start game/i }));
        expect(fake.__state.calls.length).toBe(0);
        expect(fake.__state.rpcCalls.length).toBe(0);
    });
});

// ---------------------------------------------------------------------------
describe('leaderboard display', () => {
    beforeEach(async () => {
        fake = createFakeSupabase({ session: makeSession(ADA) });
        await fake.rpc(RPC.submitScore, { p_score: 900, p_level: 11, p_username: 'ada' });
        fake.__state.calls.length = 0;
    });

    it('reads the namespaced base table, not a view', async () => {
        render(<Leaderboard isOpen onClose={() => { }} />);
        await waitFor(() => expect(screen.getByText('ada')).toBeTruthy());
        expect(fake.__state.calls).toContain('kogi_quest_leaderboard');
        expect(fake.__state.calls).not.toContain('kogi_quest_leaderboard_public');
    });

    it('asks only for granted columns', () => {
        const asked = LEADERBOARD_PUBLIC_COLUMNS.split(',').map((c) => c.trim());
        expect(asked.slice().sort()).toEqual([...GRANTED_COLUMNS].sort());
        expect(asked).not.toContain('user_id');
    });

    it('is refused if it ever asks for user_id', async () => {
        const { error } = await fake.from(TABLES.leaderboard).select('id, user_id');
        expect(error.code).toBe('42501');
    });

    it('is refused if it ever asks for select *', async () => {
        const { error } = await fake.from(TABLES.leaderboard).select('*');
        expect(error.code).toBe('42501');
    });

    it('returns no user_id in any row', async () => {
        const { data } = await fake.from(TABLES.leaderboard).select(LEADERBOARD_PUBLIC_COLUMNS);
        expect(data.length).toBeGreaterThan(0);
        for (const row of data) expect(row).not.toHaveProperty('user_id');
    });

    it('is viewable by an anonymous visitor', async () => {
        const anon = createFakeSupabase({ session: null });
        anon.__state.leaderboard.set(ADA, {
            id: 'r1', created_at: 'x', user_id: ADA, username: 'ada', score: 900, level: 11
        });
        const { data, error } = await anon.from(TABLES.leaderboard).select(LEADERBOARD_PUBLIC_COLUMNS);
        expect(error).toBeNull();
        expect(data[0].username).toBe('ada');
    });
});

// ---------------------------------------------------------------------------
describe('question reports', () => {
    const fillAndSubmit = async (text = 'The listed answer looks wrong.') => {
        fireEvent.change(screen.getByPlaceholderText(/describe the issue/i), { target: { value: text } });
        fireEvent.click(screen.getByRole('button', { name: /submit report/i }));
    };

    it('a signed-in player can file a report', async () => {
        fake = createFakeSupabase({ session: makeSession(ADA) });
        render(<ReportIssueModal isOpen onClose={() => { }} user={makeSession(ADA).user}
            questionId="tki1" questionText="Q" />);
        await fillAndSubmit();
        await waitFor(() => expect(fake.__state.reports.length).toBe(1));
        expect(fake.__state.calls).toContain('kogi_quest_question_suggestions');
        expect(fake.__state.calls).not.toContain('question_suggestions');
    });

    it('new reports are always pending', async () => {
        fake = createFakeSupabase({ session: makeSession(ADA) });
        render(<ReportIssueModal isOpen onClose={() => { }} user={makeSession(ADA).user}
            questionId="tki1" questionText="Q" />);
        await fillAndSubmit();
        await waitFor(() => expect(fake.__state.reports.length).toBe(1));
        expect(fake.__state.reports[0].status).toBe('pending');
    });

    it('a guest is asked to sign in, without a database call', async () => {
        fake = createFakeSupabase({ session: null });
        render(<ReportIssueModal isOpen onClose={() => { }} user={null}
            questionId="tki1" questionText="Q" />);
        await fillAndSubmit();
        await waitFor(() => expect(screen.getByText(/please sign in/i)).toBeTruthy());
        expect(fake.__state.reports.length).toBe(0);
        expect(fake.__state.calls.length).toBe(0);
    });

    it('a client cannot create an approved report', async () => {
        fake = createFakeSupabase({ session: makeSession(ADA) });
        const { error } = await fake.from(TABLES.questionSuggestions)
            .insert({ user_id: ADA, question_id: 'tki1', user_comment: 'x', status: 'approved' });
        expect(error).not.toBeNull();
        expect(fake.__state.reports.length).toBe(0);
    });

    it('a player cannot file a report for another user', async () => {
        fake = createFakeSupabase({ session: makeSession(ADA) });
        const { error } = await fake.from(TABLES.questionSuggestions)
            .insert({ user_id: BOLA, question_id: 'tki1', user_comment: 'not mine' });
        expect(error.code).toBe('42501');
    });

    it('public users cannot read submitted reports', async () => {
        fake = createFakeSupabase({ session: null });
        const { data, error } = await fake.from(TABLES.questionSuggestions).select('*');
        expect(data).toBeNull();
        expect(error).not.toBeNull();
    });

    it('rejects empty and over-long reports', async () => {
        fake = createFakeSupabase({ session: makeSession(ADA) });
        expect((await fake.from(TABLES.questionSuggestions)
            .insert({ user_id: ADA, question_id: 'tki1', suggested_answer: ' ', user_comment: '' })).error.code)
            .toBe('23514');
        expect((await fake.from(TABLES.questionSuggestions)
            .insert({ user_id: ADA, question_id: 'tki1', user_comment: 'x'.repeat(2001) })).error.code)
            .toBe('23514');
    });
});
