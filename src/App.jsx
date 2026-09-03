import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase, configError } from './lib/supabase';
import Layout from './components/Layout';
import Hero from './components/Hero';
import GameEngine from './components/GameEngine';
import Auth from './components/Auth';
import ConfigurationError from './components/ConfigurationError';

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (configError) {
            setLoading(false);
            return;
        }

        // Check active sessions and sets the user
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for changes on auth state (logged in, signed out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                // If we were on auth page, go home or to quiz
                // But typically if they sign in, we just hide auth.
                // With routing, we can navigate.
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // A misconfigured build gets an explicit, actionable screen rather than a
    // spinner that never resolves.
    if (configError) {
        return <ConfigurationError title={configError.title} detail={configError.detail} />;
    }

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    return (
        <Layout
            user={user}
            onLoginClick={() => navigate('/auth')}
            onLogoutClick={handleLogout}
        >
            <Routes>
                <Route path="/" element={<Hero user={user} onStart={() => navigate('/quiz')} />} />
                <Route
                    path="/auth"
                    element={
                        user ? (
                            <Navigate to="/" replace />
                        ) : (
                            <Auth
                                onAuthSuccess={(u) => {
                                    setUser(u);
                                    navigate('/');
                                }}
                                onBack={() => navigate('/')}
                            />
                        )
                    }
                />
                {/* Open to everyone. `user` may be null: GameEngine plays the
                    full quiz for guests and simply skips leaderboard writes. */}
                <Route
                    path="/quiz"
                    element={<GameEngine user={user} onExit={() => navigate('/')} />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Layout>
    );
}

export default App;
