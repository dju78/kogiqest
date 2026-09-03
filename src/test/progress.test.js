import { describe, it, expect } from 'vitest';
import {
    createEmptyProgress, recordAnswer, setCurrentIndex,
    resetTitle, titleStatus, titleAnsweredCount, titleCorrectCount, overallScore
} from '../lib/progress';
import { GAME_LEVELS, MAX_POSSIBLE_SCORE, POINTS_PER_QUESTION } from '../lib/constants';

const Q = ['q1', 'q2', 'q3'];

describe('overallScore / recordAnswer: deduplicated, capped scoring', () => {
    it('a fresh progress object scores zero', () => {
        expect(overallScore(createEmptyProgress())).toBe(0);
    });

    it('each correct answer contributes exactly 100 points, never more', () => {
        let progress = createEmptyProgress();
        progress = recordAnswer(progress, 1, Q, 'q1', 0, true);
        expect(overallScore(progress)).toBe(100);
        progress = recordAnswer(progress, 1, Q, 'q2', 0, true);
        expect(overallScore(progress)).toBe(200);
    });

    it('a wrong answer contributes nothing', () => {
        let progress = createEmptyProgress();
        progress = recordAnswer(progress, 1, Q, 'q1', 1, false);
        expect(overallScore(progress)).toBe(0);
    });

    it('re-answering the same question correctly again does not add points twice', () => {
        let progress = createEmptyProgress();
        progress = recordAnswer(progress, 1, Q, 'q1', 0, true);
        progress = recordAnswer(progress, 1, Q, 'q1', 0, true);
        progress = recordAnswer(progress, 1, Q, 'q1', 0, true);
        expect(overallScore(progress)).toBe(100);
        expect(progress.scoredQuestionIds).toEqual(['q1']);
    });

    it('a later wrong answer does not revoke points already earned', () => {
        let progress = createEmptyProgress();
        progress = recordAnswer(progress, 1, Q, 'q1', 0, true);
        progress = recordAnswer(progress, 1, Q, 'q1', 1, false);
        expect(overallScore(progress)).toBe(100);
    });

    it('resetting a title (Play Again) does not duplicate previously awarded points', () => {
        let progress = createEmptyProgress();
        progress = recordAnswer(progress, 1, Q, 'q1', 0, true);
        progress = recordAnswer(progress, 1, Q, 'q2', 0, true);
        expect(overallScore(progress)).toBe(200);

        // Play Again: fresh run of the same title.
        progress = resetTitle(progress, 1, Q);
        expect(titleAnsweredCount(progress, 1)).toBe(0);
        expect(overallScore(progress)).toBe(200); // lifetime score untouched

        // Answering the same two questions correctly again must not re-award them.
        progress = recordAnswer(progress, 1, Q, 'q1', 0, true);
        progress = recordAnswer(progress, 1, Q, 'q2', 0, true);
        expect(overallScore(progress)).toBe(200);
    });

    it('question ids are global: the same id scored under one title never re-scores under another', () => {
        let progress = createEmptyProgress();
        progress = recordAnswer(progress, 1, Q, 'shared-id', 0, true);
        expect(overallScore(progress)).toBe(100);
        // Same id, different (hypothetical) title context — still one entry.
        progress = recordAnswer(progress, 2, ['shared-id'], 'shared-id', 0, true);
        expect(overallScore(progress)).toBe(100);
        expect(progress.scoredQuestionIds).toEqual(['shared-id']);
    });

    it('cannot exceed the true maximum: answering every real question correctly caps at 54300', () => {
        let progress = createEmptyProgress();
        for (const title of GAME_LEVELS) {
            const ids = title.questions.map((q) => q.id);
            for (const id of ids) {
                progress = recordAnswer(progress, title.id, ids, id, 0, true);
            }
        }
        expect(overallScore(progress)).toBe(54300);
        expect(overallScore(progress)).toBe(MAX_POSSIBLE_SCORE);
        expect(POINTS_PER_QUESTION).toBe(100);
    });

    it('answering every real question twice (a full replay of everything) still caps at 54300', () => {
        let progress = createEmptyProgress();
        const pass = () => {
            for (const title of GAME_LEVELS) {
                const ids = title.questions.map((q) => q.id);
                for (const id of ids) {
                    progress = recordAnswer(progress, title.id, ids, id, 0, true);
                }
            }
        };
        pass();
        pass();
        expect(overallScore(progress)).toBe(54300);
        expect(progress.scoredQuestionIds.length).toBe(543);
    });
});

describe('titleStatus', () => {
    it('is not-started before any question is answered', () => {
        expect(titleStatus(createEmptyProgress(), 1, 3)).toBe('not-started');
    });

    it('is in-progress after some but not all questions are answered', () => {
        let progress = createEmptyProgress();
        progress = recordAnswer(progress, 1, Q, 'q1', 0, true);
        expect(titleStatus(progress, 1, 3)).toBe('in-progress');
    });

    it('is completed once every question in the title has been answered', () => {
        let progress = createEmptyProgress();
        progress = recordAnswer(progress, 1, Q, 'q1', 0, true);
        progress = recordAnswer(progress, 1, Q, 'q2', 1, false);
        progress = recordAnswer(progress, 1, Q, 'q3', 0, true);
        expect(titleStatus(progress, 1, 3)).toBe('completed');
    });

    it('resetting a completed title returns it to not-started', () => {
        let progress = createEmptyProgress();
        progress = recordAnswer(progress, 1, Q, 'q1', 0, true);
        progress = recordAnswer(progress, 1, Q, 'q2', 0, true);
        progress = recordAnswer(progress, 1, Q, 'q3', 0, true);
        expect(titleStatus(progress, 1, 3)).toBe('completed');
        progress = resetTitle(progress, 1, Q);
        expect(titleStatus(progress, 1, 3)).toBe('not-started');
    });

    it('titles are independent: completing one leaves another untouched', () => {
        let progress = createEmptyProgress();
        progress = recordAnswer(progress, 1, Q, 'q1', 0, true);
        progress = recordAnswer(progress, 1, Q, 'q2', 0, true);
        progress = recordAnswer(progress, 1, Q, 'q3', 0, true);
        expect(titleStatus(progress, 1, 3)).toBe('completed');
        expect(titleStatus(progress, 2, 5)).toBe('not-started');
    });
});

describe('resume: currentIndex and answers survive switching titles', () => {
    it('preserves currentIndex when the player leaves and returns', () => {
        let progress = createEmptyProgress();
        progress = recordAnswer(progress, 1, Q, 'q1', 0, true);
        progress = setCurrentIndex(progress, 1, Q, 1);

        // Simulate switching to a different title and back: nothing here
        // touches title 1's stored state unless we explicitly act on it.
        progress = recordAnswer(progress, 2, ['a', 'b'], 'a', 0, true);

        expect(progress.titles[1].currentIndex).toBe(1);
        expect(titleCorrectCount(progress, 1)).toBe(1);
        expect(titleCorrectCount(progress, 2)).toBe(1);
    });

    it('freezes the question order on first visit so a reload resumes consistently', () => {
        let progress = createEmptyProgress();
        progress = recordAnswer(progress, 1, ['q3', 'q1', 'q2'], 'q3', 0, true);
        const firstOrder = progress.titles[1].order;

        // A later call with a differently-ordered (freshly shuffled) id list
        // must not disturb the already-frozen order.
        progress = recordAnswer(progress, 1, ['q1', 'q2', 'q3'], 'q1', 0, true);
        expect(progress.titles[1].order).toEqual(firstOrder);
    });
});
