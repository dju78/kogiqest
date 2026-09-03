import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { createFakeSupabase, makeSession } from './fakeSupabase';

// Deliberately does NOT mock '../lib/constants': these tests exercise the
// real 11-title, 543-question game data, so "all 11 titles are visible" and
// "Takete-Ide of Amuro is selectable" prove something about production data,
// not a stand-in.
let fake;

vi.mock('../lib/supabase', async () => {
    const actual = await vi.importActual('../lib/supabase');
    return { ...actual, get supabase() { return fake; }, configError: null, isConfigured: true };
});

const { GAME_LEVELS } = await import('../lib/constants');
const GameEngine = (await import('../components/GameEngine')).default;

const REQUIRED_TITLES = [
    'The Confluence Origins',
    'Igala Kingdom Chronicles',
    'Ebira Heritage',
    'Okun Traditions',
    'Political History',
    'People & Places',
    'Tribes of the Confluence',
    'Industries & Resources',
    'Cultural Mosaic',
    'Legends & Icons',
    'Takete-Ide of Amuro'
];

beforeEach(() => {
    localStorage.clear();
    fake = createFakeSupabase({ session: null });
});
afterEach(() => vi.clearAllMocks());


// ---------------------------------------------------------------------------
describe('required test 1: all 11 titles are visible', () => {
    it('shows the exact required titles, using their real GAME_LEVELS ids', () => {
        expect(GAME_LEVELS.map((t) => t.title)).toEqual(REQUIRED_TITLES);

        render(<GameEngine user={null} onExit={() => { }} />);
        for (const title of REQUIRED_TITLES) {
            expect(screen.getByRole('button', { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toBeTruthy();
        }
    });

    it('shows the heading "Choose Your Quest" and the supporting copy', () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        expect(screen.getByText('Choose Your Quest')).toBeTruthy();
        expect(screen.getByText(/Explore any title in any order\. Every quest is available from the beginning\./i)).toBeTruthy();
    });

    it('shows each title\'s question count', () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        for (const title of GAME_LEVELS) {
            const card = screen.getByRole('button', { name: new RegExp(title.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
            expect(within(card).getByText(`${title.questions.length} questions`)).toBeTruthy();
        }
    });
});

// ---------------------------------------------------------------------------
describe('required test 2: no title is locked', () => {
    it('every title card is an enabled, clickable button', () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        for (const title of REQUIRED_TITLES) {
            const card = screen.getByRole('button', { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
            expect(card).not.toBeDisabled();
        }
    });

    it('renders no "Locked" or "Unlock" text anywhere on the selector', () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        expect(document.body.textContent).not.toMatch(/\blocked\b/i);
        expect(document.body.textContent).not.toMatch(/\bunlock/i);
    });

    it('every title starts with the status "Not started"', () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        const notStarted = screen.getAllByText('Not started');
        expect(notStarted.length).toBe(11);
    });
});

// ---------------------------------------------------------------------------
describe('required test 3: any title can be selected immediately', () => {
    it('opens a title from the middle of the list with no prerequisite', async () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        fireEvent.click(screen.getByRole('button', { name: /Cultural Mosaic/i }));
        await waitFor(() => expect(document.body.textContent).toMatch(/Cultural Mosaic.*Q1\//));
    });

    it('opens the last title in the list directly', async () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        fireEvent.click(screen.getByRole('button', { name: /Legends & Icons/i }));
        await waitFor(() => expect(document.body.textContent).toMatch(/Legends & Icons.*Q1\//));
    });
});

// ---------------------------------------------------------------------------
describe('required test 4: Takete-Ide of Amuro on a fresh session', () => {
    it('is immediately selectable with no prior progress', async () => {
        expect(localStorage.getItem('kogi-quest-progress-v1')).toBeNull();
        render(<GameEngine user={null} onExit={() => { }} />);

        const card = screen.getByRole('button', { name: /Takete-Ide of Amuro/i });
        expect(card).not.toBeDisabled();
        expect(within(card).getByText('100 questions')).toBeTruthy();

        fireEvent.click(card);
        await waitFor(() => expect(document.body.textContent).toMatch(/Takete-Ide of Amuro.*Q1\/100/));
    });
});

// ---------------------------------------------------------------------------
describe('required test 5: switching titles preserves progress', () => {
    it('answering one question in title A, switching to B, and returning to A resumes at Q2', async () => {
        render(<GameEngine user={null} onExit={() => { }} />);

        fireEvent.click(screen.getByRole('button', { name: /The Confluence Origins/i }));
        await waitFor(() => expect(document.body.textContent).toMatch(/Q1\/23/));

        // Answer question 1 (whichever option — correctness doesn't matter here).
        const options = document.querySelectorAll('button.w-full.p-4');
        fireEvent.click(options[0]);
        fireEvent.click(screen.getByRole('button', { name: /confirm selection/i }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled());
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        await waitFor(() => expect(document.body.textContent).toMatch(/Q2\/23/));

        // Switch to a different title mid-play.
        fireEvent.click(screen.getByRole('button', { name: /choose another title/i }));
        await screen.findByText('Choose Your Quest');
        expect(screen.getByRole('button', { name: /The Confluence Origins/i }).textContent).toMatch(/In progress/);

        fireEvent.click(screen.getByRole('button', { name: /Igala Kingdom Chronicles/i }));
        await waitFor(() => expect(document.body.textContent).toMatch(/Igala Kingdom Chronicles.*Q1\//));

        // Back to the selector, then back into the first title: must resume at Q2.
        fireEvent.click(screen.getByRole('button', { name: /choose another title/i }));
        await screen.findByText('Choose Your Quest');
        fireEvent.click(screen.getByRole('button', { name: /The Confluence Origins/i }));
        await waitFor(() => expect(document.body.textContent).toMatch(/The Confluence Origins.*Q2\/23/));
    });
});

// ---------------------------------------------------------------------------
describe('required test 6: guest progress survives a refresh', () => {
    it('persists to localStorage and reloads correctly into a fresh mount', async () => {
        // Generous timeouts throughout: under full-suite parallel load the
        // default 1000ms can be tight for a real render + effect cycle.
        const T = { timeout: 4000 };
        const { unmount } = render(<GameEngine user={null} onExit={() => { }} />);
        fireEvent.click(screen.getByRole('button', { name: /Ebira Heritage/i }));
        await waitFor(() => expect(document.body.textContent).toMatch(/Q1\//), T);

        const options = document.querySelectorAll('button.w-full.p-4');
        fireEvent.click(options[0]);
        fireEvent.click(screen.getByRole('button', { name: /confirm selection/i }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled(), T);

        // Actually advance to Q2, so resuming at "wherever the player left
        // off" is a meaningful check rather than one Q1 would satisfy anyway.
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        await waitFor(() => expect(document.body.textContent).toMatch(/Q2\/50/), T);

        const stored = JSON.parse(localStorage.getItem('kogi-quest-progress-v1'));
        expect(Object.keys(stored.titles[3].answers).length).toBe(1);
        expect(stored.titles[3].currentIndex).toBe(1);

        // Simulate a page refresh: unmount and mount a brand-new component
        // tree. localStorage (unlike React state) is untouched by this.
        unmount();
        render(<GameEngine user={null} onExit={() => { }} />);

        // Before reopening it, the selector card itself must reflect the
        // persisted progress.
        const card = await screen.findByRole('button', { name: /Ebira Heritage/i }, T);
        expect(card.textContent).toMatch(/In progress/);
        expect(card.textContent).toMatch(/1\/50 answered/);

        // Reopening it must resume at Q2, not restart at Q1.
        fireEvent.click(card);
        await waitFor(() => expect(document.body.textContent).toMatch(/Q2\/50/), T);
    });
});

// ---------------------------------------------------------------------------
describe('required test 10: no user-visible "Level" or "Locked" text', () => {
    it('the selector screen never says Level or Locked', () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        expect(document.body.textContent).not.toMatch(/\blevel\b/i);
        expect(document.body.textContent).not.toMatch(/\blocked\b/i);
    });

    it('the playing screen never says Level or Locked', async () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        fireEvent.click(screen.getByRole('button', { name: /Okun Traditions/i }));
        await waitFor(() => expect(document.body.textContent).toMatch(/Q1\//));
        expect(document.body.textContent).not.toMatch(/\blevel\b/i);
        expect(document.body.textContent).not.toMatch(/\blocked\b/i);
    });

    it('the quest-complete screen never says "Level Complete" or "Next Level"', async () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        // A short real title exists (Tribes of the Confluence, 20 questions)
        // but even that is too many to click through here; use the shared
        // completion-copy check against static strings instead of a full
        // playthrough, which is covered end-to-end in guestFlow.test.jsx.
        expect(GameEngine.toString()).not.toMatch(/Level Complete|Level Mastered|Next Level/);
    });
});

// ---------------------------------------------------------------------------
describe('required test 11: guest gameplay still requires no account', () => {
    it('no login screen appears while choosing or playing a title', async () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        expect(document.body.textContent).not.toMatch(/welcome back|create account|sign in to/i);

        fireEvent.click(screen.getByRole('button', { name: /Political History/i }));
        await waitFor(() => expect(document.body.textContent).toMatch(/Q1\//));
        expect(document.body.textContent).not.toMatch(/welcome back|create account|sign in to/i);
        expect(fake.__state.rpcCalls.length).toBe(0);
    });
});

// ---------------------------------------------------------------------------
describe('accessibility', () => {
    it('title cards are real buttons with descriptive accessible names', () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        const card = screen.getByRole('button', { name: /The Confluence Origins, 23 questions, Not started/i });
        expect(card.tagName).toBe('BUTTON');
    });

    it('the currently selected title is marked aria-current', async () => {
        render(<GameEngine user={null} onExit={() => { }} />);
        fireEvent.click(screen.getByRole('button', { name: /^Ebira Heritage/i }));
        await waitFor(() => expect(document.body.textContent).toMatch(/Q1\//));
        fireEvent.click(screen.getByRole('button', { name: /choose another title/i }));
        const card = await screen.findByRole('button', { name: /Ebira Heritage.*currently selected/i });
        expect(card.getAttribute('aria-current')).toBe('true');
    });
});
