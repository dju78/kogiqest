import React from 'react';
import { Play, Star, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Leaderboard from './Leaderboard';

const Hero = () => {
    const [isLeaderboardOpen, setIsLeaderboardOpen] = React.useState(false);
    const [session, setSession] = React.useState(null);
    const navigate = useNavigate();

    React.useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSession(data.session));
        const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
        return () => sub.subscription.unsubscribe();
    }, []);

    const handleStart = () => {
        if (!session) {
            navigate("/auth");
            return;
        }
        navigate("/quiz");
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center mt-20">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="max-w-2xl space-y-8"
            >
                <div className="inline-block p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md mb-4 shadow-2xl shadow-purple-500/20 glass">
                    <Star className="w-16 h-16 text-yellow-400 mx-auto mb-2 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
                    <h2 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-purple-200 text-glow">
                        Adventure Awaits
                    </h2>
                </div>

                <p className="text-xl text-slate-300 max-w-lg mx-auto leading-relaxed font-light">
                    Embark on a journey through the <span className="text-cyan-400 font-medium">EduVerse</span>. Master challenges, unlock knowledge, and become a legend about the history, Culture and traditions of Kogi State
                </p>

                <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(34, 211, 238, 0.4)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleStart}
                    className="group relative inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full text-xl font-bold transition-all duration-300 shadow-xl"
                >
                    <Play className="w-6 h-6 fill-current" />
                    Start Game
                    <div className="absolute inset-0 rounded-full bg-white/20 blur-xl opacity-0 group-hover:opacity-40 transition-opacity" />
                </motion.button>

                <div className="flex justify-center gap-8 pt-12 text-sm text-slate-400">
                    <button
                        onClick={() => setIsLeaderboardOpen(true)}
                        className="flex items-center gap-2 hover:text-cyan-400 transition-colors"
                    >
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        <span>Leaderboards</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-purple-400" />
                        <span>Achievements</span>
                    </div>
                </div>
            </motion.div>

            <Leaderboard
                isOpen={isLeaderboardOpen}
                onClose={() => setIsLeaderboardOpen(false)}
            />
        </div>
    );
};

export default Hero;
