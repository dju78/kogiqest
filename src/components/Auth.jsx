import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, LogIn, UserPlus, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

const Auth = ({ onAuthSuccess, onBack }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        fullName: ''
    });

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isLogin) {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: formData.email,
                    password: formData.password,
                });
                if (error) throw error;
                if (data.user) onAuthSuccess(data.user);
            } else {
                const { data, error } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: {
                        data: {
                            full_name: formData.fullName,
                        }
                    }
                });
                if (error) throw error;
                if (data.user) {
                    // Supabase might require email confirmation depending on settings
                    // If data.user exists but data.session is null, it's confirmation pending
                    if (data.session) {
                        onAuthSuccess(data.user);
                    } else {
                        setError('Success! Please check your email to confirm your account.');
                    }
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md"
            >
                {onBack && (
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </button>
                )}

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
                    {/* Decorative Background Elements */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl -ml-16 -mb-16" />

                    <div className="relative z-10">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 mb-2">
                                {isLogin ? 'Welcome Back' : 'Create Account'}
                            </h2>
                            <p className="text-slate-400">
                                {isLogin
                                    ? 'Login to track your quest through Kogi'
                                    : 'Join the EduVerse adventure today'}
                            </p>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex items-start gap-3 p-4 rounded-xl mb-6 border ${error.includes('Success')
                                        ? 'bg-green-500/10 border-green-500/20 text-green-400'
                                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                                    }`}
                            >
                                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                                <p className="text-sm">{error}</p>
                            </motion.div>
                        )}

                        <form onSubmit={handleAuth} className="space-y-4">
                            {!isLogin && (
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-300 ml-1">Full Name</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                        <input
                                            required={!isLogin}
                                            type="text"
                                            name="fullName"
                                            value={formData.fullName}
                                            onChange={handleChange}
                                            placeholder="John Doe"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-300 ml-1">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                    <input
                                        required
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="you@example.com"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all outline-none"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-300 ml-1">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                    <input
                                        required
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        placeholder="••••••••"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-600 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition-all outline-none"
                                    />
                                </div>
                            </div>

                            <button
                                disabled={loading}
                                type="submit"
                                className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold py-4 rounded-xl mt-6 hover:shadow-lg hover:shadow-cyan-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        {isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                                        {isLogin ? 'Sign In' : 'Create Account'}
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-8 pt-6 border-t border-white/5 text-center">
                            <button
                                onClick={() => setIsLogin(!isLogin)}
                                className="text-slate-400 hover:text-cyan-400 transition-colors text-sm"
                            >
                                {isLogin
                                    ? "Don't have an account? Sign up"
                                    : "Already have an account? Sign in"}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Auth;
