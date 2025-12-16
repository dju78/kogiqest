import React from 'react';
import { Play, Star, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

const Hero = ({ onStart }) => {
    return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center mt-20">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="max-w-2xl space-y-8"
            >
                <div className="inline-block p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md mb-4 shadow-xl shadow-purple-500/20">
                    <Star className="w-16 h-16 text-yellow-400 mx-auto mb-2" />
                    <h2 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-purple-200">
                        Adventure Awaits
                    </h2>
                </div>

                <p className="text-xl text-slate-300 max-w-lg mx-auto leading-relaxed">
                    Embark on a journey through the EduVerse. Master challenges, unlock knowledge, and become a legend about the history, Culture and traditions of Kogi State
                </p>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onStart}
                    className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full text-xl font-bold hover:shadow-lg hover:shadow-cyan-500/30 transition-all duration-300"
                >
                    <Play className="w-6 h-6 fill-current" />
                    Start Game
                    <div className="absolute inset-0 rounded-full bg-white/20 blur-lg opacity-0 group-hover:opacity-50 transition-opacity" />
                </motion.button>

                <div className="flex justify-center gap-8 pt-12 text-sm text-slate-400">
                    <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        <span>Leaderboards</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-purple-400" />
                        <span>Achievements</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Hero;
