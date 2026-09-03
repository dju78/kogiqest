import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, CheckCircle, XCircle, ArrowRight, RotateCcw, Trophy, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, RPC } from '../lib/supabase';
import { GAME_LEVELS, MAX_POSSIBLE_SCORE, POINTS_PER_QUESTION } from '../lib/constants';
import Leaderboard from './Leaderboard';
import Bubbles from './Bubbles';
import ReportIssueModal from './ReportIssueModal';

const GameEngine = ({ onExit, user }) => {
    const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [gameState, setGameState] = useState('playing'); // playing, levelComplete, gameComplete
    const [selectedOption, setSelectedOption] = useState(null);
    const [feedback, setFeedback] = useState(null); // 'correct' or 'incorrect'
    const [levelCorrectCount, setLevelCorrectCount] = useState(0); // Track correct answers for current level
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [answersHistory, setAnswersHistory] = useState({}); // Record { selectedOption, feedback } per questionIndex
    const [stagedOption, setStagedOption] = useState(null); // Option selected but not yet confirmed
    const [hasAnswered, setHasAnswered] = useState(false);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [showGuestNudge, setShowGuestNudge] = useState(false);

    // Pending "auto advance" timer, so it can be cancelled if the player navigates manually
    const advanceTimer = useRef(null);
    // Guards against submitting the same finished run to the leaderboard more than once
    const hasSubmittedScore = useRef(false);
    // High score as it was when this run started, so "New High Score!" stays truthful
    const previousHighScore = useRef(0);

    const currentLevel = GAME_LEVELS[currentLevelIndex];
    const currentQuestion = currentLevel.questions[currentQuestionIndex];

    // Shared with the database constraints; see lib/constants.js.
    const isPerfectScore = score === MAX_POSSIBLE_SCORE;

    // Check if current level was perfect
    const isLevelPerfect = levelCorrectCount === currentLevel.questions.length;

    // Load High Score on mount
    useEffect(() => {
        const saved = parseInt(localStorage.getItem('kogi-quest-highscore') || '0', 10);
        if (!Number.isNaN(saved) && saved > 0) {
            setHighScore(saved);
            previousHighScore.current = saved;
        }
    }, []);

    // Never leave a pending auto-advance timer behind on unmount
    useEffect(() => () => clearTimeout(advanceTimer.current), []);

    // Save High Score on game complete
    useEffect(() => {
        if (gameState !== 'gameComplete') return;
        if (hasSubmittedScore.current) return;
        hasSubmittedScore.current = true;

        // Local high score
        setHighScore(prev => {
            if (score > prev) {
                localStorage.setItem('kogi-quest-highscore', score.toString());
                return score;
            }
            return prev;
        });

        // Guests play the full game; their best score lives in localStorage
        // above. No database call is made for them at all, so finishing as a
        // guest can never surface a backend error.
        if (!user) {
            if (score > 0) setShowGuestNudge(true);
            return;
        }

        // Signed-in players submit through the single secure write path. The
        // function derives the owner from auth.uid() and keeps whichever score
        // is higher, so no client-supplied user id is involved.
        if (score > 0) {
            (async () => {
                const username =
                    user.user_metadata?.full_name?.trim() ||
                    user.email?.split('@')[0] ||
                    'Explorer';

                const { error } = await supabase.rpc(RPC.submitScore, {
                    p_score: score,
                    p_level: currentLevelIndex + 1,
                    p_username: username.slice(0, 50)
                });

                if (error) {
                    console.error('Error submitting score to leaderboard:', error);
                    setSubmitError("Your score couldn't be saved to the global leaderboard.");
                }
            })();
        }
    }, [gameState, score, user, currentLevelIndex]);

    const handleOptionSelect = (optionIndex) => {
        if (selectedOption !== null) return; // Already answered
        setStagedOption(optionIndex);
    };

    const goToQuestion = (index) => {
        clearTimeout(advanceTimer.current);
        setStagedOption(null);
        setCurrentQuestionIndex(index);

        // Restore a previously given answer, or present the question as unanswered
        const history = answersHistory[index];
        setSelectedOption(history ? history.selectedOption : null);
        setFeedback(history ? history.feedback : null);
        setHasAnswered(!!history);
    };

    const handleConfirmSubmission = () => {
        if (stagedOption === null || selectedOption !== null) return;

        const optionIndex = stagedOption;
        setSelectedOption(optionIndex);
        const isCorrect = optionIndex === currentQuestion.answer;

        if (isCorrect) {
            setFeedback('correct');
            setScore(s => s + POINTS_PER_QUESTION);
            setLevelCorrectCount(c => c + 1);
        } else {
            setFeedback('incorrect');
        }
        setHasAnswered(true);

        // Record in history
        setAnswersHistory(prev => ({
            ...prev,
            [currentQuestionIndex]: {
                selectedOption: optionIndex,
                feedback: isCorrect ? 'correct' : 'incorrect'
            }
        }));

        // Auto advance after 1.5s (cancelled if the player navigates first)
        clearTimeout(advanceTimer.current);
        advanceTimer.current = setTimeout(() => {
            handleNextQuestion();
        }, 1500);
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < currentLevel.questions.length - 1) {
            goToQuestion(currentQuestionIndex + 1);
            return;
        }

        // Level Complete
        clearTimeout(advanceTimer.current);
        setStagedOption(null);
        setSelectedOption(null);
        setFeedback(null);
        setHasAnswered(false);
        setGameState(currentLevelIndex < GAME_LEVELS.length - 1 ? 'levelComplete' : 'gameComplete');
    };

    const handlePrevQuestion = () => {
        if (currentQuestionIndex > 0) {
            goToQuestion(currentQuestionIndex - 1);
        }
    };

    const nextLevel = () => {
        clearTimeout(advanceTimer.current);
        setCurrentLevelIndex(i => i + 1);
        setCurrentQuestionIndex(0);
        setLevelCorrectCount(0); // Reset for next level
        setAnswersHistory({}); // Reset history for new level
        setStagedOption(null);
        setSelectedOption(null);
        setFeedback(null);
        setHasAnswered(false);
        setGameState('playing');
    };

    const resetGame = () => {
        clearTimeout(advanceTimer.current);
        hasSubmittedScore.current = false;
        previousHighScore.current = highScore;
        setCurrentLevelIndex(0);
        setCurrentQuestionIndex(0);
        setScore(0);
        setLevelCorrectCount(0);
        setAnswersHistory({});
        setStagedOption(null);
        setSelectedOption(null);
        setFeedback(null);
        setHasAnswered(false);
        setSubmitError(null);
        setShowGuestNudge(false);
        setGameState('playing');
    };

    return (
        <div className="container mx-auto p-4 md:p-8 flex-1 flex flex-col relative">
            {/* Show Bubbles if perfect score (Overall or Level) */}
            {(gameState === 'gameComplete' && isPerfectScore) || (gameState === 'levelComplete' && isLevelPerfect) ? <Bubbles /> : null}

            {/* HUD */}
            <div className="flex flex-wrap gap-3 justify-between items-center mb-6 bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-md relative z-10">
                <button
                    onClick={onExit}
                    className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-sm font-medium"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Quit
                </button>
                <div className="flex gap-6">
                    <div className="text-center">
                        <span className="text-xs text-slate-400 uppercase tracking-wider">Level</span>
                        <div className="text-xl font-bold text-cyan-400">{currentLevelIndex + 1}</div>
                    </div>
                    <div className="text-center">
                        <span className="text-xs text-slate-400 uppercase tracking-wider">Score</span>
                        <div className="text-xl font-bold text-purple-400">{score}</div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex gap-8 min-h-0 relative z-10">
                {/* Main Game Area */}
                <div className="flex-1 relative">
                    <AnimatePresence mode='wait'>
                        {gameState === 'playing' && (
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
                                <div className="mb-4 text-cyan-300 font-medium tracking-wide flex items-center gap-4">
                                    <div className="flex items-center glass border border-white/10 rounded-lg p-1">
                                        <button
                                            onClick={handlePrevQuestion}
                                            disabled={currentQuestionIndex === 0}
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
                                    <span className="text-sm">
                                        {currentLevel.title} &bull; Q{currentQuestionIndex + 1}/{currentLevel.questions.length}
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
                                            disabled={selectedOption !== null}
                                            className={`w-full p-4 sm:p-6 rounded-xl border-2 text-left text-base sm:text-lg font-medium transition-all duration-200 
                            ${selectedOption === null
                                                    ? stagedOption === idx
                                                        ? 'bg-cyan-500/10 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                                                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-cyan-400/30'
                                                    : idx === currentQuestion.answer && selectedOption !== null
                                                        ? 'bg-green-500/20 border-green-500 text-green-100'
                                                        : selectedOption === idx
                                                            ? 'bg-red-500/20 border-red-500 text-red-100'
                                                            : 'bg-white/5 border-white/10 opacity-50'
                                                }
                          `}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span>{option}</span>
                                                {selectedOption === null && stagedOption === idx && (
                                                    <motion.div
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        className="w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)]"
                                                    />
                                                )}
                                                {selectedOption !== null && idx === currentQuestion.answer && (
                                                    <CheckCircle className="w-6 h-6 text-green-400" />
                                                )}
                                                {selectedOption === idx && idx !== currentQuestion.answer && (
                                                    <XCircle className="w-6 h-6 text-red-400" />
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-8 flex justify-center h-16">
                                    <AnimatePresence>
                                        {stagedOption !== null && selectedOption === null && (
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

                        {gameState === 'levelComplete' && (
                            <motion.div
                                key="levelinfo"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex-1 flex flex-col items-center justify-center text-center relative py-12"
                            >
                                <div className="w-20 h-20 bg-cyan-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-cyan-500/50">
                                    <CheckCircle className="w-10 h-10 text-white" />
                                </div>
                                <h2 className="text-4xl font-bold mb-4">
                                    {isLevelPerfect ? "Level Mastered!" : "Level Complete!"}
                                </h2>
                                <p className="text-xl text-cyan-200 mb-6 max-w-lg font-medium">
                                    {isLevelPerfect
                                        ? "Incredible! You are a true Legend of the Confluence!"
                                        : "Great effort! Review the history books and try again to achieve a perfect score."}
                                </p>
                                <p className="text-slate-400 mb-8 max-w-md">
                                    You've finished {currentLevel.title}. Ready for the next challenge?
                                </p>
                                <button
                                    onClick={nextLevel}
                                    className="px-8 py-3 bg-white text-slate-900 rounded-full font-bold flex items-center gap-2 hover:bg-cyan-50 transition-colors shadow-lg"
                                >
                                    Next Level <ArrowRight className="w-5 h-5" />
                                </button>
                            </motion.div>
                        )}

                        {gameState === 'gameComplete' && (
                            <motion.div
                                key="gameover"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex-1 flex flex-col items-center justify-center text-center relative py-12"
                            >
                                <h2 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
                                    {isPerfectScore ? "Perfect Quest!" : "Quest Complete!"}
                                </h2>
                                <div className="text-8xl font-black text-white mb-2">{score}</div>
                                <p className="text-slate-400 mb-4 uppercase tracking-widest">Final Score</p>

                                <p className="text-xl text-cyan-200 mb-8 max-w-lg font-medium">
                                    {isPerfectScore
                                        ? "Incredible! You are a true Legend of the Confluence!"
                                        : "Great effort! Review the history books and try again to achieve a perfect score. You can do it!"}
                                </p>

                                {score > previousHighScore.current && score > 0 && (
                                    <div className="mb-8 flex items-center gap-2 text-yellow-400 animate-pulse">
                                        <Trophy className="w-6 h-6" />
                                        <span className="font-bold">New High Score!</span>
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
                                        onClick={resetGame}
                                        className="px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full font-bold flex items-center gap-2 transition-colors"
                                    >
                                        <RotateCcw className="w-4 h-4" /> Play Again
                                    </button>
                                    <button
                                        onClick={onExit}
                                        className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full font-bold shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all"
                                    >
                                        Return to Menu
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
                    </AnimatePresence>
                </div>

                {/* Levels Sidebar (Desktop) */}
                <div className="hidden lg:block w-72 glass rounded-3xl p-6 overflow-y-auto">
                    <h3 className="text-slate-400 uppercase tracking-widest text-xs font-bold mb-6 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                        Quest Map
                    </h3>
                    <div className="space-y-4">
                        {GAME_LEVELS.map((level, index) => {
                            const isActive = index === currentLevelIndex;
                            const isPast = index < currentLevelIndex;
                            const isFuture = index > currentLevelIndex;

                            return (
                                <div
                                    key={level.id}
                                    className={`relative p-4 rounded-2xl border transition-all duration-500
                                        ${isActive ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)] scale-[1.02]' : ''}
                                        ${isPast ? 'bg-green-500/5 border-green-500/20 opacity-60' : ''}
                                        ${isFuture ? 'bg-white/5 border-white/5 opacity-40' : ''}
                                    `}
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                                            ${isActive ? 'bg-cyan-400 text-slate-900 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : ''}
                                            ${isPast ? 'bg-green-500/20 text-green-400' : ''}
                                            ${isFuture ? 'bg-white/10 text-slate-500' : ''}
                                        `}>
                                            {isPast ? <CheckCircle className="w-5 h-5" /> : index + 1}
                                        </div>
                                        <div className={`font-bold text-sm tracking-tight ${isActive ? 'text-white' : 'text-slate-400'}`}>
                                            Level {index + 1}
                                        </div>
                                    </div>
                                    {isActive && (
                                        <motion.div
                                            initial={{ opacity: 0, x: -5 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="text-[10px] text-cyan-300 ml-11 font-medium uppercase tracking-widest"
                                        >
                                            In Exploration
                                        </motion.div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <ReportIssueModal
                isOpen={isReportModalOpen}
                user={user}
                onClose={() => setIsReportModalOpen(false)}
                questionId={currentQuestion ? currentQuestion.id : 'unknown'}
                questionText={currentQuestion ? currentQuestion.question : ''}
            />

            <Leaderboard
                isOpen={isLeaderboardOpen}
                onClose={() => setIsLeaderboardOpen(false)}
            />
        </div>
    );
};

export default GameEngine;
