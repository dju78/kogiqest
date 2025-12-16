import React, { useState, useEffect } from 'react';
import { ChevronLeft, CheckCircle, XCircle, ArrowRight, RotateCcw, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GAME_LEVELS } from '../lib/constants';
import Bubbles from './Bubbles';

const GameEngine = ({ onExit }) => {
    const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [gameState, setGameState] = useState('playing'); // playing, levelComplete, gameComplete
    const [selectedOption, setSelectedOption] = useState(null);
    const [feedback, setFeedback] = useState(null); // 'correct' or 'incorrect'
    const [levelCorrectCount, setLevelCorrectCount] = useState(0); // Track correct answers for current level

    const currentLevel = GAME_LEVELS[currentLevelIndex];
    const currentQuestion = currentLevel.questions[currentQuestionIndex];

    // Calculate Max Score dynamically
    const MAX_SCORE = GAME_LEVELS.reduce((acc, level) => acc + level.questions.length, 0) * 100;
    const isPerfectScore = score === MAX_SCORE;

    // Check if current level was perfect
    const isLevelPerfect = levelCorrectCount === currentLevel.questions.length;

    // Load High Score on mount
    useEffect(() => {
        const saved = localStorage.getItem('kogi-quest-highscore');
        if (saved) setHighScore(parseInt(saved));
    }, []);

    // Save High Score on game complete
    useEffect(() => {
        if (gameState === 'gameComplete') {
            if (score > highScore) {
                setHighScore(score);
                localStorage.setItem('kogi-quest-highscore', score.toString());
            }
        }
    }, [gameState, score, highScore]);

    const handleOptionSelect = (optionIndex) => {
        if (selectedOption !== null) return; // Prevent multiple clicks

        setSelectedOption(optionIndex);
        const isCorrect = optionIndex === currentQuestion.answer;

        if (isCorrect) {
            setFeedback('correct');
            setScore(s => s + 100);
            setLevelCorrectCount(c => c + 1);
        } else {
            setFeedback('incorrect');
        }

        // Auto advance after 1.5s
        setTimeout(() => {
            handleNext();
        }, 1500);
    };

    const handleNext = () => {
        setSelectedOption(null);
        setFeedback(null);

        // Check if more questions in level
        if (currentQuestionIndex < currentLevel.questions.length - 1) {
            setCurrentQuestionIndex(i => i + 1);
        } else {
            // Level Complete
            if (currentLevelIndex < GAME_LEVELS.length - 1) {
                setGameState('levelComplete');
            } else {
                setGameState('gameComplete');
            }
        }
    };

    const nextLevel = () => {
        setCurrentLevelIndex(i => i + 1);
        setCurrentQuestionIndex(0);
        setLevelCorrectCount(0); // Reset for next level
        setGameState('playing');
    };

    const resetGame = () => {
        setCurrentLevelIndex(0);
        setCurrentQuestionIndex(0);
        setScore(0);
        setLevelCorrectCount(0);
        setGameState('playing');
    };

    return (
        <div className="container mx-auto p-4 md:p-8 h-full flex flex-col relative overflow-hidden">
            {/* Show Bubbles if perfect score (Overall or Level) */}
            {(gameState === 'gameComplete' && isPerfectScore) || (gameState === 'levelComplete' && isLevelPerfect) ? <Bubbles /> : null}

            {/* HUD */}
            <div className="flex justify-between items-center mb-6 bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-md relative z-10">
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
                                className="h-full flex flex-col justify-center max-w-3xl mx-auto w-full"
                            >
                                <div className="mb-4 text-cyan-300 font-medium tracking-wide">
                                    {currentLevel.title} &bull; Q{currentQuestionIndex + 1}/{currentLevel.questions.length}
                                </div>

                                <h2 className="text-2xl md:text-4xl font-bold mb-12 leading-tight">
                                    {currentQuestion.question}
                                </h2>

                                <div className="space-y-4">
                                    {currentQuestion.options.map((option, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleOptionSelect(idx)}
                                            disabled={selectedOption !== null}
                                            className={`w-full p-6 rounded-xl border-2 text-left text-lg font-medium transition-all duration-200 
                            ${selectedOption === null
                                                    ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-cyan-400/50'
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
                            </motion.div>
                        )}

                        {gameState === 'levelComplete' && (
                            <motion.div
                                key="levelinfo"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="h-full flex flex-col items-center justify-center text-center relative"
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
                                className="h-full flex flex-col items-center justify-center text-center relative"
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

                                {score >= highScore && score > 0 && (
                                    <div className="mb-8 flex items-center gap-2 text-yellow-400 animate-pulse">
                                        <Trophy className="w-6 h-6" />
                                        <span className="font-bold">New High Score!</span>
                                    </div>
                                )}

                                <div className="flex gap-4">
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
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Levels Sidebar (Desktop) */}
                <div className="hidden lg:block w-72 bg-white/5 rounded-2xl border border-white/10 p-6 overflow-y-auto">
                    <h3 className="text-slate-400 uppercase tracking-widest text-xs font-bold mb-6">Quest Map</h3>
                    <div className="space-y-4">
                        {GAME_LEVELS.map((level, index) => {
                            const isActive = index === currentLevelIndex;
                            const isPast = index < currentLevelIndex;
                            const isFuture = index > currentLevelIndex;

                            return (
                                <div
                                    key={level.id}
                                    className={`relative p-4 rounded-xl border transition-all duration-300
                                        ${isActive ? 'bg-cyan-500/10 border-cyan-500' : ''}
                                        ${isPast ? 'bg-green-500/5 border-green-500/30 opacity-70' : ''}
                                        ${isFuture ? 'bg-white/5 border-white/5 opacity-50' : ''}
                                    `}
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                                            ${isActive ? 'bg-cyan-500 text-slate-900' : ''}
                                            ${isPast ? 'bg-green-500/20 text-green-400' : ''}
                                            ${isFuture ? 'bg-white/10 text-slate-500' : ''}
                                        `}>
                                            {isPast ? <CheckCircle className="w-4 h-4" /> : index + 1}
                                        </div>
                                        <div className={`font-bold text-sm ${isActive ? 'text-white' : 'text-slate-400'}`}>
                                            Level {index + 1}
                                        </div>
                                    </div>
                                    {isActive && (
                                        <div className="text-xs text-cyan-300 ml-9">
                                            Current Location
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GameEngine;
