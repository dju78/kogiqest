import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createFakeSupabase, makeSession } from './fakeSupabase';

const ADA = '11111111-1111-1111-1111-111111111111';
const PROGRESS_KEY = 'kogi-quest-progress-v1';

let fake;

vi.mock('../lib/supabase', async () => {
    const actual = await vi.importActual('../lib/supabase');
    return { ...actual, get supabase() { return fake; }, configError: null, isConfigured: true };
});

// Two small titles, so a full play-through is fast. What's under test is the
// completion path and scoring, not the real 543-question data set (covered
// separately in questSelector.test.jsx).
vi.mock('../lib/constants', () => ({
    GAME_LEVELS: [
        {
            id: 1, title: 'Quest One', color: 'from-green-400 to-blue-500',
            questions: [
                { id: 'q1', question: 'Q1?', options: ['right', 'wrong'], answer: 0 },
                { id: 'q2', question: 'Q2?', options: ['right', 'wrong'], answer: 0 }
            ]
        },
        {
            id: 2, title: 'Quest Two', color: 'from-yellow-400 to-red-500',
            questions: [
                { id: 'q3', question: 'Q3?', options: ['right', 'wrong'], answer: 0 },
                { id: 'q4', question: 'Q4?', options: ['right', 'wrong'], answer: 0 }
            ]
        }
    ],
    POINTS_PER_QUESTION: 100,
    MAX_LEVEL: 2,
    MAX_POSSIBLE_SCORE: 400,
    QUESTION_BY_ID: new Map([
        ['q1', { id: 'q1', question: 'Q1?', options: ['right', 'wrong'], answer: 0 }],
        ['q2', { id: 'q2', question: 'Q2?', options: ['right', 'wrong'], answer: 0 }],
        ['q3', { id: 'q3', question: 'Q3?', options: ['right', 'wrong'], answer: 0 }],
        ['q4', { id: 'q4', question: 'Q4?', options: ['right', 'wrong'], answer: 0 }]
    ]),
    THEME_COLORS: {}
}));

const GameEngine = (await import('../components/GameEngine')).default;

beforeEach(() => { localStorage.clear(); });
afterEach(() => vi.clearAllMocks());

/** Answers the visible question correctly, then advances. */
const answerAndAdvance = async () => {
    const option = await screen.findByRole('button', { name: 'right' });
    fireEvent.click(option);
    fireEvent.click(await screen.findByRole('button', { name: /confirm selection/i }));
    const next = screen.getByRole('button', { name: 'Next' });
    await waitFor(() => expect(next).not.toBeDisabled());
    fireEvent.click(next);
};

/**
 * From the selector, opens a title by name and answers every question in it.
 * Waits for text unique to THIS title's completion screen — the generic
 * "Quest Complete!" heading repeats verbatim across completions, and
 * framer-motion's exit transition doesn't fully resolve in jsdom, so a
 * previous completion screen's copy of that heading can still be present
 * when the new one mounts.
 */
const playTitle = async (titleName) => {
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(titleName) }));
    await answerAndAdvance();
    await answerAndAdvance();
    await screen.findByText(new RegExp(`You've finished ${titleName}`));
};

// ---------------------------------------------------------------------------
describe('guest plays a title without an account', () => {
    beforeEach(() => { fake = createFakeSupabase({ session: null }); });

    it('starts at the quest selector, not a login screen', () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        expect(screen.getByText('Choose Your Quest')).toBeTruthy();
        expect(screen.queryByText(/welcome back|create account/i)).toBeNull();
    });

    it('completes a title and reaches the completion screen', async () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        await playTitle('Quest One');
        expect(screen.getByText(/quest complete|quest mastered/i)).toBeTruthy();
    });

    it('never writes to the database', async () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        await playTitle('Quest One');
        expect(fake.__state.rpcCalls).toHaveLength(0);
        expect(fake.__state.calls).toHaveLength(0);
        expect(fake.__state.leaderboard.size).toBe(0);
    });

    it('shows no database error to a guest', async () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        await playTitle('Quest One');
        expect(screen.queryByText(/couldn't be saved/i)).toBeNull();
        expect(screen.queryByText(/not been set up/i)).toBeNull();
    });

    it('invites the guest to sign in, without demanding it', async () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        await playTitle('Quest One');
        expect(screen.getByText(/sign in if you would like to save it/i)).toBeTruthy();
    });

    it('stores guest progress in localStorage under the new progress key', async () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        await playTitle('Quest One');
        const stored = JSON.parse(localStorage.getItem(PROGRESS_KEY));
        expect(stored.scoredQuestionIds.sort()).toEqual(['q1', 'q2']);
    });

    it('completing a second title adds to the same overall score, not a new one', async () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        await playTitle('Quest One');
        expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)).scoredQuestionIds.length).toBe(2);
        fireEvent.click(screen.getByRole('button', { name: /choose another title/i }));
        await playTitle('Quest Two');
        const stored = JSON.parse(localStorage.getItem(PROGRESS_KEY));
        expect(stored.scoredQuestionIds.sort()).toEqual(['q1', 'q2', 'q3', 'q4']);
    });

    it('Play Again replays the same title, still without an account', async () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        await playTitle('Quest One');
        fireEvent.click(screen.getByRole('button', { name: /play again/i }));
        // Match by role, same as answerAndAdvance() elsewhere in this file:
        // under full-suite parallel load, waiting on plain text can race the
        // framer-motion exit/enter transition; waiting on the option button's
        // role has proven stable throughout this file.
        expect(await screen.findByRole('button', { name: 'right' }, { timeout: 3000 })).toBeTruthy();
        expect(screen.queryByText(/welcome back|create account/i)).toBeNull();
        expect(fake.__state.rpcCalls).toHaveLength(0);
    });

    it('replaying a completed title does not inflate the overall score', async () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        await playTitle('Quest One');
        let stored = JSON.parse(localStorage.getItem(PROGRESS_KEY));
        expect(stored.scoredQuestionIds.length).toBe(2);

        fireEvent.click(screen.getByRole('button', { name: /play again/i }));
        await answerAndAdvance();
        await answerAndAdvance();
        await screen.findByText(/quest complete|quest mastered/i);

        stored = JSON.parse(localStorage.getItem(PROGRESS_KEY));
        expect(stored.scoredQuestionIds.length).toBe(2); // still just q1, q2
    });
});

// ---------------------------------------------------------------------------
describe('authenticated player saves score per completed title', () => {
    beforeEach(() => { fake = createFakeSupabase({ session: makeSession(ADA, 'Ada Test') }); });

    it('submits through the RPC when a title is completed', async () => {
        render(<GameEngine user={makeSession(ADA).user} onExit={() => { }} />);
        await playTitle('Quest One');
        await waitFor(() => expect(fake.__state.rpcCalls).toHaveLength(1));
        expect(fake.__state.rpcCalls[0].fn).toBe('kogi_quest_submit_score');
    });

    it('sends only score, level and username — never a user id', async () => {
        render(<GameEngine user={makeSession(ADA).user} onExit={() => { }} />);
        await playTitle('Quest One');
        await waitFor(() => expect(fake.__state.rpcCalls).toHaveLength(1));
        const { args } = fake.__state.rpcCalls[0];
        expect(Object.keys(args).sort()).toEqual(['p_level', 'p_score', 'p_username']);
        expect(JSON.stringify(args)).not.toContain(ADA);
        expect(args.p_score).toBe(200);
        expect(args.p_level).toBe(1);
    });

    it('a second, different title submits the new cumulative score with its own level', async () => {
        render(<GameEngine user={makeSession(ADA).user} onExit={() => { }} />);
        await playTitle('Quest One');
        await waitFor(() => expect(fake.__state.rpcCalls).toHaveLength(1));
        fireEvent.click(screen.getByRole('button', { name: /choose another title/i }));
        await playTitle('Quest Two');
        await waitFor(() => expect(fake.__state.rpcCalls).toHaveLength(2));
        expect(fake.__state.rpcCalls[1].args.p_score).toBe(400);
        expect(fake.__state.rpcCalls[1].args.p_level).toBe(2);
    });

    it('records the score against the signed-in player', async () => {
        render(<GameEngine user={makeSession(ADA).user} onExit={() => { }} />);
        await playTitle('Quest One');
        await waitFor(() => expect(fake.__state.leaderboard.get(ADA)?.score).toBe(200));
    });

    it('the app and the database agree on the score limits', async () => {
        const { MAX_POSSIBLE_SCORE, MAX_LEVEL: appMaxLevel, POINTS_PER_QUESTION } =
            await vi.importActual('../lib/constants');
        const { MAX_SCORE, MAX_LEVEL } = await import('./fakeSupabase');
        expect(POINTS_PER_QUESTION).toBe(100);
        expect(MAX_POSSIBLE_SCORE).toBe(MAX_SCORE);
        expect(appMaxLevel).toBe(MAX_LEVEL);
    });

    it('does not show the guest sign-in invitation', async () => {
        render(<GameEngine user={makeSession(ADA).user} onExit={() => { }} />);
        await playTitle('Quest One');
        expect(screen.queryByText(/sign in if you would like to save it/i)).toBeNull();
    });
});
