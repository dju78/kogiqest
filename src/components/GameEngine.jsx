import React, { useState, useEffect, useRef } from 'react';
import {
    ChevronLeft, CheckCircle, XCircle, ArrowRight, RotateCcw, Trophy,
    AlertTriangle, Compass, ListChecks, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, RPC } from '../lib/supabase';
import { GAME_LEVELS, MAX_POSSIBLE_SCORE, QUESTION_BY_ID } from '../lib/constants';
import { shuffled } from '../lib/shuffle';
import {
    loadProgress, saveProgress, ensureTitleState, recordAnswer, setCurrentIndex,
    resetTitle, titleStatus, titleAnsweredCount, titleCorrectCount, overallScore
} from '../lib/progress';
import Leaderboard from './Leaderboard';
import Bubbles from './Bubbles';
import ReportIssueModal from './ReportIssueModal';

const STATUS_LABEL = {
    'not-started': 'Not started',
    'in-progress': 'In progress',
    'completed': 'Completed'
};

const STATUS_BADGE_CLASS = {
    'not-started': 'bg-white/10 text-slate-400',
    'in-progress': 'bg-cyan-500/20 text-cyan-300',
    'completed': 'bg-green-500/20 text-green-300'
};

const GameEngine = ({ onExit, user }) => {
    const [progress, setProgress] = useState(() => loadProgress());
    // Which title is loaded (playing or just finished). null = quest selector.
    const [activeTitleId, setActiveTitleId] = useState(null);
    // 'select' | 'playing' | 'complete'
    const [view, setView] = useState('select');
    const [stagedOption, setStagedOption] = useState(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [showGuestNudge, setShowGuestNudge] = useState(false);

    const advanceTimer = useRef(null);
    useEffect(() => () => clearTimeout(advanceTimer.current), []);

    // The auto-advance timer schedules handleNextQuestion from the render at
    // the moment the player confirmed an answer — before that answer's state
    // update has committed. On the "this was the last question" branch that
    // closure's `progress` would be stale by exactly the answer just given,
    // undercounting the score submitted to the leaderboard. A ref sidesteps
    // it: it is kept in sync by the effect below and always read fresh.
    const progressRef = useRef(progress);
    useEffect(() => { progressRef.current = progress; }, [progress]);

    const updateProgress = (updater) => {
        setProgress((prev) => {
            const next = updater(prev);
            saveProgress(next);
            return next;
        });
    };

    const activeTitle = activeTitleId ? GAME_LEVELS.find((t) => t.id === activeTitleId) : null;
    const activeQuestionIds = activeTitle ? activeTitle.questions.map((q) => q.id) : [];
    const titleState = activeTitleId ? progress.titles[activeTitleId] : null;
    const currentIndex = titleState?.currentIndex ?? 0;
    const orderedQuestions = titleState ? titleState.order.map((id) => QUESTION_BY_ID.get(id)) : [];
    const currentQuestion = orderedQuestions[currentIndex];
    const currentAnswer = currentQuestion ? titleState?.answers?.[currentQuestion.id] : null;
    const hasAnswered = !!currentAnswer;
    const selectedOption = currentAnswer ? currentAnswer.selectedOption : null;
    const feedback = currentAnswer ? (currentAnswer.correct ? 'correct' : 'incorrect') : null;

    const overall = overallScore(progress);
    const isOverallPerfect = overall === MAX_POSSIBLE_SCORE;

    // Was every question in this title's current run answered correctly?
    const isTitleRunPerfect =
        !!titleState && titleState.order.length > 0 &&
        titleState.order.every((id) => titleState.answers[id]?.correct);

    const openTitle = (titleId) => {
        const title = GAME_LEVELS.find((t) => t.id === titleId);
        const questionIds = title.questions.map((q) => q.id);
        updateProgress((prev) => ({
            ...prev,
            titles: { ...prev.titles, [titleId]: ensureTitleState(prev, titleId, questionIds) }
        }));
        clearTimeout(advanceTimer.current);
        setStagedOption(null);
        setActiveTitleId(titleId);
        setView('playing');
    };

    const backToSelector = () => {
        clearTimeout(advanceTimer.current);
        setStagedOption(null);
        setView('select');
    };

    const handleOptionSelect = (optionIndex) => {
        if (hasAnswered) return;
        setStagedOption(optionIndex);
    };

    const submitScoreIfSignedIn = (finishedTitleId, scoreAtCompletion) => {
        if (!user || scoreAtCompletion <= 0) return;
        (async () => {
            const username =
                user.user_metadata?.full_name?.trim() ||
                user.email?.split('@')[0] ||
                'Explorer';

            const { error } = await supabase.rpc(RPC.submitScore, {
                p_score: scoreAtCompletion,
                p_level: finishedTitleId,
                p_username: username.slice(0, 50)
            });

            if (error) {
                console.error('Error submitting score to leaderboard:', error);
                setSubmitError("Your score couldn't be saved to the global leaderboard.");
            }
        })();
    };

    const finishTitle = (finishedTitleId, progressAtFinish) => {
        setView('complete');
        const score = overallScore(progressAtFinish);
        if (!user) {
            if (score > 0) setShowGuestNudge(true);
            return;
        }
        submitScoreIfSignedIn(finishedTitleId, score);
    };

    const handleConfirmSubmission = () => {
        if (stagedOption === null || hasAnswered || !currentQuestion) return;

        const isCorrect = stagedOption === currentQuestion.answer;
        updateProgress((prev) =>
            recordAnswer(prev, activeTitleId, activeQuestionIds, currentQuestion.id, stagedOption, isCorrect)
        );
        setStagedOption(null);

        // Auto advance after 1.5s (cancelled if the player navigates first)
        clearTimeout(advanceTimer.current);
        advanceTimer.current = setTimeout(() => {
            handleNextQuestion();
        }, 1500);
    };

    const handleNextQuestion = () => {
        if (currentIndex < orderedQuestions.length - 1) {
            const nextIndex = currentIndex + 1;
            updateProgress((prev) => {
                const next = setCurrentIndex(prev, activeTitleId, activeQuestionIds, nextIndex);
                return next;
            });
            setStagedOption(null);
            return;
        }

        // Last question of this run: finish the title.
        clearTimeout(advanceTimer.current);
        setStagedOption(null);
        setSubmitError(null);
        setShowGuestNudge(false);
        finishTitle(activeTitleId, progressRef.current);
    };

    const handlePrevQuestion = () => {
        if (currentIndex > 0) {
            clearTimeout(advanceTimer.current);
            updateProgress((prev) => setCurrentIndex(prev, activeTitleId, activeQuestionIds, currentIndex - 1));
            setStagedOption(null);
        }
    };

    const playAgain = () => {
        clearTimeout(advanceTimer.current);
        const freshOrder = shuffled(activeQuestionIds);
        updateProgress((prev) => resetTitle(prev, activeTitleId, freshOrder));
        setStagedOption(null);
        setSubmitError(null);
        setShowGuestNudge(false);
        setView('playing');
    };

    const chooseAnotherTitle = () => {
        setSubmitError(null);
        setShowGuestNudge(false);
        setView('select');
    };

    return (
        <div className="container mx-auto p-4 md:p-8 flex-1 flex flex-col relative">
            {(view === 'complete' && (isOverallPerfect || isTitleRunPerfect)) ? <Bubbles /> : null}

            {/* HUD */}
            <div className="flex flex-wrap gap-3 justify-between items-center mb-6 bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-md relative z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onExit}
                        className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-sm font-medium"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Quit
                    </button>
                    {view === 'playing' && (
                        <button
                            onClick={backToSelector}
                            className="flex items-center gap-2 text-cyan-300 hover:text-cyan-200 transition-colors text-sm font-medium"
                        >
                            <ListChecks className="w-4 h-4" />
                            Choose Another Title
                        </button>
                    )}
                </div>
                <div className="flex gap-6">
                    {activeTitle && (
                        <div className="text-center max-w-[10rem] sm:max-w-[16rem]">
                            <span className="text-xs text-slate-400 uppercase tracking-wider">Current Title</span>
                            <div className="text-sm sm:text-base font-bold text-cyan-400 leading-snug break-words">
                                {activeTitle.title}
                            </div>
                        </div>
                    )}
                    <div className="text-center">
                        <span className="text-xs text-slate-400 uppercase tracking-wider">Score</span>
                        <div className="text-xl font-bold text-purple-400">{overall}</div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex gap-8 min-h-0 relative z-10">
                <div className="flex-1 relative">
                    {/*
                        Plain conditional rendering, not AnimatePresence: with
                        three mutually-exclusive views swapped via a wrapper
                        component (QuestSelector) rather than a bare motion.*
                        element, AnimatePresence's exit choreography would
                        intermittently stall in production builds specifically
                        (reproduced repeatedly against the built bundle; not
                        reproducible in dev and not caught by jsdom tests) —
                        the outgoing view's DOM stuck in place indefinitely
                        while state had already moved on, leaving the screen
                        showing stale content. Each view still animates in via
                        its own initial/animate props; it just unmounts
                        instantly instead of fading out.
                    */}
                    <>
                        {view === 'select' && (
                            <QuestSelector
                                key="select"
                                progress={progress}
                                activeTitleId={activeTitleId}
                                onSelect={openTitle}
                            />
                        )}

                        {view === 'playing' && currentQuestion && (
                            <motion.div
                                key="question"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className={`flex-1 flex flex-col justify-center max-w-3xl mx-auto w-full transition-all duration-300
                                    ${feedback === 'incorrect' ? 'animate-shake' : ''}
                                    ${feedback === 'correct' ? 'animate-success' : ''}
                                `}
                            >
                                <div className="mb-4 text-cyan-300 font-medium tracking-wide flex flex-wrap items-center gap-4">
                                    <div className="flex items-center glass border border-white/10 rounded-lg p-1">
                                        <button
                                            onClick={handlePrevQuestion}
                                            disabled={currentIndex === 0}
                                            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-xs font-bold uppercase tracking-wider"
                                            title="Previous Question"
                                        >
                                            Back
                                        </button>
                                        <div className="w-[1px] h-4 bg-white/10 mx-1" />
                                        <button
                                            onClick={handleNextQuestion}
                                            disabled={!hasAnswered}
                                            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-xs font-bold uppercase tracking-wider"
                                            title="Next Question"
                                        >
                                            Next
                                        </button>
                                    </div>
                                    <span className="text-sm break-words">
                                        {activeTitle.title} &bull; Q{currentIndex + 1}/{orderedQuestions.length}
                                    </span>
                                </div>

                                <h2 className="text-xl sm:text-2xl md:text-4xl font-bold mb-8 md:mb-12 leading-tight">
                                    {currentQuestion.question}
                                </h2>

                                <div className="space-y-3 sm:space-y-4">
                                    {currentQuestion.options.map((option, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleOptionSelect(idx)}
                                            disabled={hasAnswered}
                                            className={`w-full p-4 sm:p-6 rounded-xl border-2 text-left text-base sm:text-lg font-medium transition-all duration-200
                            ${!hasAnswered
                                                    ? stagedOption === idx
                                                        ? 'bg-cyan-500/10 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                                                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-cyan-400/30'
                                                    : idx === currentQuestion.answer
                                                        ? 'bg-green-500/20 border-green-500 text-green-100'
                                                        : selectedOption === idx
                                                            ? 'bg-red-500/20 border-red-500 text-red-100'
                                                            : 'bg-white/5 border-white/10 opacity-50'
                                                }
                          `}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span>{option}</span>
                                                {!hasAnswered && stagedOption === idx && (
                                                    <motion.div
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        className="w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)]"
                                                    />
                                                )}
                                                {hasAnswered && idx === currentQuestion.answer && (
                                                    <CheckCircle className="w-6 h-6 text-green-400" />
                                                )}
                                                {hasAnswered && selectedOption === idx && idx !== currentQuestion.answer && (
                                                    <XCircle className="w-6 h-6 text-red-400" />
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-8 flex justify-center h-16">
                                    <AnimatePresence>
                                        {stagedOption !== null && !hasAnswered && (
                                            <motion.button
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 10 }}
                                                onClick={handleConfirmSubmission}
                                                className="px-10 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl font-bold text-white shadow-xl shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-105 transition-all flex items-center gap-3 border border-white/10"
                                            >
                                                Confirm Selection <CheckCircle className="w-5 h-5" />
                                            </motion.button>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <div className="mt-6 flex justify-end">
                                    <button
                                        onClick={() => setIsReportModalOpen(true)}
                                        className="text-xs text-slate-500 hover:text-cyan-400 flex items-center gap-1 transition-colors opacity-60 hover:opacity-100"
                                    >
                                        <AlertTriangle className="w-3 h-3" />
                                        Report an issue
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {view === 'complete' && activeTitle && (
                            <motion.div
                                key="titlecomplete"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex-1 flex flex-col items-center justify-center text-center relative py-12"
                            >
                                <div className="w-20 h-20 bg-cyan-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-cyan-500/50">
                                    <CheckCircle className="w-10 h-10 text-white" />
                                </div>
                                <h2 className="text-4xl font-bold mb-4">
                                    {isTitleRunPerfect ? "Quest Mastered!" : "Quest Complete!"}
                                </h2>
                                <p className="text-xl text-cyan-200 mb-2 max-w-lg font-medium">
                                    {isTitleRunPerfect
                                        ? "Incredible! You are a true Legend of the Confluence!"
                                        : "Great effort! Review the history books and try again to achieve a perfect score."}
                                </p>
                                <p className="text-slate-400 mb-1 max-w-md">
                                    You've finished {activeTitle.title}.
                                </p>
                                <p className="text-cyan-300 font-semibold mb-6">
                                    {titleCorrectCount(progress, activeTitleId)} of {orderedQuestions.length} correct
                                </p>

                                <div className="mb-8">
                                    <div className="text-5xl font-black text-white">{overall.toLocaleString()}</div>
                                    <p className="text-slate-400 uppercase tracking-widest text-xs mt-1">Overall Score</p>
                                </div>

                                {isOverallPerfect && (
                                    <div className="mb-6 flex items-center gap-2 text-yellow-400 animate-pulse">
                                        <Trophy className="w-6 h-6" />
                                        <span className="font-bold">Every quest mastered — the full 54,300!</span>
                                    </div>
                                )}

                                {showGuestNudge && (
                                    <p className="mb-6 text-sm text-cyan-200 bg-cyan-500/10 border border-cyan-400/20 rounded-xl px-4 py-3 max-w-md">
                                        Great score! Sign in if you would like to save it to the global leaderboard.
                                    </p>
                                )}

                                {submitError && (
                                    <p className="mb-6 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 max-w-md">
                                        {submitError}
                                    </p>
                                )}

                                <div className="flex flex-wrap justify-center gap-4">
                                    <button
                                        onClick={playAgain}
                                        className="px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full font-bold flex items-center gap-2 transition-colors"
                                    >
                                        <RotateCcw className="w-4 h-4" /> Play Again
                                    </button>
                                    <button
                                        onClick={chooseAnotherTitle}
                                        className="px-8 py-3 bg-white text-slate-900 rounded-full font-bold flex items-center gap-2 hover:bg-cyan-50 transition-colors shadow-lg"
                                    >
                                        Choose Another Title <ArrowRight className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={onExit}
                                        className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full font-bold shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all"
                                    >
                                        Return Home
                                    </button>
                                </div>

                                <div className="mt-8 pt-8 border-t border-white/10 w-full max-w-sm mx-auto">
                                    <button
                                        onClick={() => setIsLeaderboardOpen(true)}
                                        className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors mx-auto"
                                    >
                                        <Trophy className="w-5 h-5 text-yellow-500" />
                                        <span className="font-medium">View Global Leaderboards</span>
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </>
                </div>
            </div>

            {currentQuestion && (
                <ReportIssueModal
                    isOpen={isReportModalOpen}
                    user={user}
                    onClose={() => setIsReportModalOpen(false)}
                    questionId={currentQuestion.id}
                    questionText={currentQuestion.question}
                />
            )}

            <Leaderboard
                isOpen={isLeaderboardOpen}
                onClose={() => setIsLeaderboardOpen(false)}
            />
        </div>
    );
};

/**
 * "Choose Your Quest" — every title is selectable immediately, in any order.
 * There is no locked, disabled or prerequisite state.
 */
const QuestSelector = ({ progress, activeTitleId, onSelect }) => (
    <motion.div
        key="selector"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="flex-1 flex flex-col"
    >
        <div className="mb-6 text-center sm:text-left">
            <h2 id="choose-your-quest" className="text-2xl sm:text-3xl font-bold text-white flex items-center justify-center sm:justify-start gap-3">
                <Compass className="w-7 h-7 text-cyan-400" aria-hidden="true" />
                Choose Your Quest
            </h2>
            <p className="text-slate-400 mt-2 max-w-2xl mx-auto sm:mx-0">
                Explore any title in any order. Every quest is available from the beginning.
            </p>
        </div>

        <div
            aria-labelledby="choose-your-quest"
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto pr-1"
        >
            {GAME_LEVELS.map((title) => {
                const total = title.questions.length;
                const status = titleStatus(progress, title.id, total);
                const answered = titleAnsweredCount(progress, title.id);
                const correct = titleCorrectCount(progress, title.id);
                const isActive = title.id === activeTitleId;

                return (
                    <button
                        key={title.id}
                        type="button"
                        onClick={() => onSelect(title.id)}
                        aria-current={isActive ? 'true' : undefined}
                        aria-label={`${title.title}, ${total} questions, ${STATUS_LABEL[status]}${isActive ? ', currently selected' : ''}`}
                        className={`text-left p-5 rounded-2xl border transition-all duration-200 bg-gradient-to-br ${title.color}/10
                            hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
                            ${isActive ? 'border-cyan-400 ring-1 ring-cyan-400/60 shadow-[0_0_20px_rgba(34,211,238,0.15)]' : 'border-white/10'}
                        `}
                    >
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <h3 className="font-bold text-lg text-white leading-snug break-words">
                                {title.title}
                            </h3>
                            {isActive && (
                                <span className="shrink-0 text-cyan-300" title="Currently selected">
                                    <Sparkles className="w-5 h-5" aria-hidden="true" />
                                </span>
                            )}
                        </div>

                        <p className="text-sm text-slate-400 mb-4">{total} questions</p>

                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${STATUS_BADGE_CLASS[status]}`}>
                                {STATUS_LABEL[status]}
                            </span>
                            {status !== 'not-started' && (
                                <span className="text-xs text-slate-500">
                                    {answered}/{total} answered &bull; {correct} correct
                                </span>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    </motion.div>
);

export default GameEngine;
