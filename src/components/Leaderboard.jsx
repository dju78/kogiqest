import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy, Medal, User, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Leaderboard = ({ isOpen, onClose }) => {
    const [leaders, setLeaders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchLeaders();
        }
    }, [isOpen]);

    const fetchLeaders = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('leaderboard')
                .select('*')
                .order('score', { ascending: false })
                .limit(10);

            if (error) throw error;
            setLeaders(data || []);
        } catch (err) {
            console.error('Error fetching leaderboard:', err);
            setError('Failed to load leaderboard. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-lg glass rounded-3xl shadow-2xl overflow-hidden"
                    >
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center animate-float">
                                    <Trophy className="w-6 h-6 text-yellow-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-white text-glow">Global Leaderboard</h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>

                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-4">
                                    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                                    <p className="text-slate-400">Fetching legends...</p>
                                </div>
                            ) : error ? (
                                <div className="text-center py-12">
                                    <p className="text-red-400 mb-4">{error}</p>
                                    <button
                                        onClick={fetchLeaders}
                                        className="text-cyan-400 hover:text-cyan-300 font-medium"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            ) : leaders.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-slate-400">No legends yet. Be the first to claim the throne!</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {leaders.map((entry, index) => (
                                        <motion.div
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            key={entry.id}
                                            className={`flex items-center justify-between p-4 rounded-2xl border transition-all
                                                ${index === 0 ? 'bg-yellow-500/10 border-yellow-500/30' :
                                                    index === 1 ? 'bg-slate-300/10 border-slate-300/30' :
                                                        index === 2 ? 'bg-orange-500/10 border-orange-500/30' :
                                                            'bg-white/5 border-white/10'}
                                            `}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 flex justify-center font-bold text-lg">
                                                    {index === 0 ? <Medal className="w-6 h-6 text-yellow-500" /> :
                                                        index === 1 ? <Medal className="w-6 h-6 text-slate-300" /> :
                                                            index === 2 ? <Medal className="w-6 h-6 text-orange-500" /> :
                                                                <span className="text-slate-500">{index + 1}</span>}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-white flex items-center gap-2">
                                                        <User className="w-3 h-3 text-slate-500" />
                                                        {entry.username || 'Anonymous Explorer'}
                                                    </span>
                                                    <span className="text-xs text-slate-500 uppercase tracking-wider">Level {entry.level || 1}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xl font-black text-cyan-400">{entry.score.toLocaleString()}</div>
                                                <div className="text-[10px] text-slate-600 uppercase tracking-widest">Points</div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-slate-900/50 border-t border-white/10 text-center">
                            <p className="text-xs text-slate-500">
                                Top 10 Explorers of the Confluence
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default Leaderboard;
