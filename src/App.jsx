import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Layout from './components/Layout';
import Hero from './components/Hero';
import GameEngine from './components/GameEngine';
import Auth from './components/Auth';

const ProtectedRoute = ({ user, children }) => {
    if (!user) {
        return <Navigate to="/auth" replace />;
    }
    return children;
};

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
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
                <Route path="/" element={<Hero onStart={() => navigate('/quiz')} />} />
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
                <Route
                    path="/quiz"
                    element={
                        <ProtectedRoute user={user}>
                            <GameEngine user={user} onExit={() => navigate('/')} />
                        </ProtectedRoute>
                    }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Layout>
    );
}

export default App;
