import { POINTS_PER_QUESTION } from './constants';

// localStorage key. Bumped from the old single-run 'kogi-quest-highscore' key
// because the shape is entirely different: this stores per-title state and a
// lifetime record of which questions have ever been answered correctly.
const STORAGE_KEY = 'kogi-quest-progress-v1';

/**
 * A brand-new progress object: nobody has played anything yet.
 *
 * `scoredQuestionIds` is the lifetime set of question ids that have ever been
 * answered correctly, across every title. It is the single source of truth
 * for the overall score, and it only ever grows: an id is added at most once,
 * so replaying a title — or the same question twice — can never inflate the
 * total past one entry per question, and the maximum possible size is the
 * total question count (543), giving a hard ceiling of 54300 points without
 * needing a separate clamp.
 */
export function createEmptyProgress() {
    return { scoredQuestionIds: [], titles: {} };
}

export function loadProgress() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return createEmptyProgress();
        const parsed = JSON.parse(raw);
        return {
            scoredQuestionIds: Array.isArray(parsed?.scoredQuestionIds) ? parsed.scoredQuestionIds : [],
            titles: parsed?.titles && typeof parsed.titles === 'object' ? parsed.titles : {}
        };
    } catch {
        return createEmptyProgress();
    }
}

export function saveProgress(progress) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
        // Storage full or unavailable (private browsing). Progress simply
        // won't survive a refresh; the current session keeps working.
    }
}

/**
 * Returns the title's play state, creating it (with a frozen question order)
 * on first visit. The order is persisted so a browser refresh resumes with
 * the same sequence rather than a fresh shuffle.
 */
export function ensureTitleState(progress, titleId, questionIds) {
    const existing = progress.titles[titleId];
    if (existing && Array.isArray(existing.order) && existing.order.length === questionIds.length) {
        return existing;
    }
    return { order: [...questionIds], answers: {}, currentIndex: 0 };
}

function withTitleState(progress, titleId, questionIds, updater) {
    const current = ensureTitleState(progress, titleId, questionIds);
    const nextTitleState = updater(current);
    return {
        ...progress,
        titles: { ...progress.titles, [titleId]: nextTitleState }
    };
}

/**
 * Records one answer for one question. Returns a new progress object; never
 * mutates the one passed in.
 *
 * A question that has already been scored correctly (ever, in any title —
 * question ids are globally unique) does not add points again on a repeat
 * correct answer, and a wrong answer never removes points already earned.
 */
export function recordAnswer(progress, titleId, questionIds, questionId, selectedOption, isCorrect) {
    const withAnswer = withTitleState(progress, titleId, questionIds, (state) => ({
        ...state,
        answers: { ...state.answers, [questionId]: { selectedOption, correct: isCorrect } }
    }));

    if (!isCorrect || withAnswer.scoredQuestionIds.includes(questionId)) {
        return withAnswer;
    }

    return {
        ...withAnswer,
        scoredQuestionIds: [...withAnswer.scoredQuestionIds, questionId]
    };
}

export function setCurrentIndex(progress, titleId, questionIds, index) {
    return withTitleState(progress, titleId, questionIds, (state) => ({ ...state, currentIndex: index }));
}

/** Starts a title over: fresh shuffle, cleared answers. Lifetime score is untouched. */
export function resetTitle(progress, titleId, freshQuestionIds) {
    return {
        ...progress,
        titles: { ...progress.titles, [titleId]: { order: [...freshQuestionIds], answers: {}, currentIndex: 0 } }
    };
}

export function titleAnsweredCount(progress, titleId) {
    const state = progress.titles[titleId];
    return state ? Object.keys(state.answers).length : 0;
}

export function titleCorrectCount(progress, titleId) {
    const state = progress.titles[titleId];
    if (!state) return 0;
    return Object.values(state.answers).filter((a) => a.correct).length;
}

/** 'not-started' | 'in-progress' | 'completed', for the quest-selection cards. */
export function titleStatus(progress, titleId, totalQuestions) {
    const answered = titleAnsweredCount(progress, titleId);
    if (answered === 0) return 'not-started';
    if (answered >= totalQuestions) return 'completed';
    return 'in-progress';
}

/** The overall, lifetime, cross-title score. Never exceeds 54300 by construction. */
export function overallScore(progress) {
    return progress.scoredQuestionIds.length * POINTS_PER_QUESTION;
}
