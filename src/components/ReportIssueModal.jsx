import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { getOrCreateUserId } from '../lib/user';
import { X, AlertCircle, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ReportIssueModal = ({ isOpen, onClose, questionId, questionText }) => {
    const [suggestion, setSuggestion] = useState('');
    const [comment, setComment] = useState('');
    const [status, setStatus] = useState('idle'); // idle, submitting, success, error
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('submitting');

        try {
            const userId = getOrCreateUserId();
            const { error } = await supabase
                .from('question_suggestions')
                .insert([
                    {
                        question_id: questionId,
                        user_id: userId,
                        suggested_answer: suggestion,
                        user_comment: comment,
                        status: 'pending' // pending review
                    }
                ]);

            if (error) {
                // Check if it's the mock client error
                if (error.message && error.message.includes('Missing Keys')) {
                    throw new Error('Supabase is not configured yet. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.');
                }
                throw error;
            }

            setStatus('success');
            setTimeout(() => {
                onClose();
                setStatus('idle');
                setErrorMessage('');
                setSuggestion('');
                setComment('');
            }, 2000);
        } catch (err) {
            console.error('Error submitting report:', err);
            setErrorMessage(err.message || 'Failed to submit report. Please try again.');
            setStatus('error');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                    Report an Issue
                </h2>

                <p className="text-slate-400 text-sm mb-6">
                    Found a mistake in this question? Let us know so we can fix it!
                </p>

                {status === 'success' ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                            <Check className="w-6 h-6 text-green-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Thank You!</h3>
                        <p className="text-slate-400">Your report has been submitted for review.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Suggested Answer (Optional)
                            </label>
                            <input
                                type="text"
                                value={suggestion}
                                onChange={(e) => setSuggestion(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                                placeholder="What is the correct answer?"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Comments
                            </label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors min-h-[100px]"
                                placeholder="Describe the issue... (e.g. 'The date is wrong', 'Typo in option A')"
                            />
                        </div>

                        {status === 'error' && (
                            <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                                {errorMessage}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={status === 'submitting' || !comment.trim()}
                            className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {status === 'submitting' ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                'Submit Report'
                            )}
                        </button>
                    </form>
                )}
            </motion.div>
        </div>
    );
};

export default ReportIssueModal;
