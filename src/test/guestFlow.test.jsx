import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createFakeSupabase, makeSession } from './fakeSupabase';

const ADA = '11111111-1111-1111-1111-111111111111';

let fake;

vi.mock('../lib/supabase', async () => {
    const actual = await vi.importActual('../lib/supabase');
    return { ...actual, get supabase() { return fake; }, configError: null, isConfigured: true };
});

// A short game, so a full play-through is fast. The number of questions is not
// what these tests are about — the completion path is.
vi.mock('../lib/constants', () => ({
    GAME_LEVELS: [
        {
            id: 1, title: 'Level One', color: '',
            questions: [
                { id: 'q1', question: 'Q1?', options: ['right', 'wrong'], answer: 0 },
                { id: 'q2', question: 'Q2?', options: ['right', 'wrong'], answer: 0 }
            ]
        },
        {
            id: 2, title: 'Level Two', color: '',
            questions: [
                { id: 'q3', question: 'Q3?', options: ['right', 'wrong'], answer: 0 },
                { id: 'q4', question: 'Q4?', options: ['right', 'wrong'], answer: 0 }
            ]
        }
    ],
    // GameEngine reads these from constants; mirror them for the 4-question
    // mock game so a perfect run is 400.
    POINTS_PER_QUESTION: 100,
    MAX_LEVEL: 2,
    MAX_POSSIBLE_SCORE: 400,
    THEME_COLORS: {}
}));

const GameEngine = (await import('../components/GameEngine')).default;

const HIGH_SCORE_KEY = 'kogi-quest-highscore';

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

/** Plays the whole mocked game to the completion screen. */
const playThrough = async () => {
    await answerAndAdvance();               // L1 Q1
    await answerAndAdvance();               // L1 Q2 -> level complete
    fireEvent.click(await screen.findByRole('button', { name: /next level/i }));
    await answerAndAdvance();               // L2 Q1
    await answerAndAdvance();               // L2 Q2 -> game complete
    await screen.findByText(/quest complete|perfect quest/i);
};

// ---------------------------------------------------------------------------
describe('guest completes the game without an account', () => {
    beforeEach(() => { fake = createFakeSupabase({ session: null }); });

    it('plays the full quiz and reaches the completion screen', async () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        await playThrough();
        expect(screen.getByText(/perfect quest|quest complete/i)).toBeTruthy();
    });

    it('never writes to the database', async () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        await playThrough();
        expect(fake.__state.rpcCalls).toHaveLength(0);
        expect(fake.__state.calls).toHaveLength(0);
        expect(fake.__state.leaderboard.size).toBe(0);
    });

    it('shows no database error to a guest', async () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        await playThrough();
        expect(screen.queryByText(/couldn't be saved/i)).toBeNull();
        expect(screen.queryByText(/not been set up/i)).toBeNull();
    });

    it('invites the guest to sign in, without demanding it', async () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        await playThrough();
        expect(screen.getByText(/sign in if you would like to save it/i)).toBeTruthy();
    });

    it('stores the guest high score in localStorage', async () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        await playThrough();
        await waitFor(() => expect(localStorage.getItem(HIGH_SCORE_KEY)).toBe('400'));
    });

    it('keeps a previous higher local score', async () => {
        localStorage.setItem(HIGH_SCORE_KEY, '900');
        render(<GameEngine user={null} onExit={() => { }} />);
        await playThrough();
        await waitFor(() => expect(localStorage.getItem(HIGH_SCORE_KEY)).toBe('900'));
    });

    it('offers Play Again without authentication', async () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        await playThrough();
        const again = screen.getByRole('button', { name: /play again/i });
        fireEvent.click(again);
        // Back at the first question of level one, still signed out.
        expect(await screen.findByText('Q1?')).toBeTruthy();
        expect(screen.queryByText(/welcome back|create account/i)).toBeNull();
        expect(fake.__state.rpcCalls).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
describe('authenticated player still saves their score', () => {
    beforeEach(() => { fake = createFakeSupabase({ session: makeSession(ADA, 'Ada Test') }); });

    it('submits exactly once, through the RPC', async () => {
        render(<GameEngine user={makeSession(ADA).user} onExit={() => { }} />);
        await playThrough();
        await waitFor(() => expect(fake.__state.rpcCalls).toHaveLength(1));
        expect(fake.__state.rpcCalls[0].fn).toBe('kogi_quest_submit_score');
    });

    it('sends only score, level and username — never a user id', async () => {
        render(<GameEngine user={makeSession(ADA).user} onExit={() => { }} />);
        await playThrough();
        await waitFor(() => expect(fake.__state.rpcCalls).toHaveLength(1));
        const { args } = fake.__state.rpcCalls[0];
        expect(Object.keys(args).sort()).toEqual(['p_level', 'p_score', 'p_username']);
        expect(JSON.stringify(args)).not.toContain(ADA);
        expect(args.p_score).toBe(400);
    });

    it('records the score against the signed-in player', async () => {
        render(<GameEngine user={makeSession(ADA).user} onExit={() => { }} />);
        await playThrough();
        await waitFor(() => expect(fake.__state.leaderboard.get(ADA)?.score).toBe(400));
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
        await playThrough();
        expect(screen.queryByText(/sign in if you would like to save it/i)).toBeNull();
    });
});
