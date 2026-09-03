import React, { useState } from 'react';
import { supabase, TABLES } from '../lib/supabase';
import { X, AlertCircle, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ReportIssueModal = ({ isOpen, onClose, questionId, questionText, user }) => {
    const [suggestion, setSuggestion] = useState('');
    const [comment, setComment] = useState('');
    const [status, setStatus] = useState('idle'); // idle, submitting, success, error
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('submitting');

        try {
            // Reports are attributable by design: RLS requires user_id to
            // equal auth.uid(), so only signed-in players can file one.
            if (!user?.id) {
                throw new Error('Please sign in before reporting an issue.');
            }
            if (!suggestion.trim() && !comment.trim()) {
                throw new Error('Add a suggested answer or a comment before submitting.');
            }

            const { error } = await supabase
                .from(TABLES.questionSuggestions)
                .insert({
                    question_id: String(questionId).slice(0, 100),
                    user_id: user.id,
                    suggested_answer: suggestion.trim().slice(0, 500) || null,
                    user_comment: comment.trim().slice(0, 2000) || null
                    // `status` is deliberately omitted. The column defaults to
                    // 'pending' and the RLS policy rejects any other value, so
                    // a client cannot file a pre-approved report.
                });

            if (error) {
                if (error.code === 'NOT_CONFIGURED') {
                    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
                }
                // PGRST205 = the table is not in the Supabase schema cache.
                if (error.code === 'PGRST205') {
                    throw new Error('Reports cannot be saved yet: the KogiQuest report table has not been created in Supabase.');
                }
                // 42501 / RLS rejection.
                if (error.code === '42501' || /row-level security/i.test(error.message || '')) {
                    throw new Error('You do not have permission to submit this report. Try signing in again.');
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="glass rounded-3xl p-8 w-full max-w-md shadow-2xl relative"
            >
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-2xl font-bold mb-2 flex items-center gap-3 text-white text-glow">
                    <AlertCircle className="w-6 h-6 text-yellow-500" />
                    Report an Issue
                </h2>

                <p className="text-slate-400 text-sm mb-8 font-light">
                    Found a mistake? Help us keep the <span className="text-cyan-400 font-medium">EduVerse</span> accurate for everyone!
                </p>

                {status === 'success' ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-6"
                        >
                            <Check className="w-8 h-8 text-green-400" />
                        </motion.div>
                        <h3 className="text-xl font-bold text-white mb-2">Thank You!</h3>
                        <p className="text-slate-400 font-light">Your report has been received.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                Suggested Answer (Optional)
                            </label>
                            <input
                                type="text"
                                value={suggestion}
                                onChange={(e) => setSuggestion(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                                placeholder="What is the correct answer?"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                Comments
                            </label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all min-h-[120px] resize-none"
                                placeholder="Describe the issue... (e.g. 'The date is wrong', 'Typo in option A')"
                            />
                        </div>

                        {status === 'error' && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-red-400 text-xs bg-red-500/10 p-4 rounded-xl border border-red-500/20"
                            >
                                {errorMessage}
                            </motion.div>
                        )}

                        {!user && (
                            <div className="text-yellow-400/80 text-[11px] bg-yellow-500/5 p-4 rounded-xl border border-yellow-500/10">
                                <span className="font-bold">Pro Tip:</span> Sign in to track your reports and earn community reputation!
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={status === 'submitting' || !comment.trim()}
                            className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:shadow-lg hover:shadow-cyan-500/20 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                        >
                            {status === 'submitting' ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
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
