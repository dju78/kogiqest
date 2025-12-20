import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Layout from './components/Layout';
import Hero from './components/Hero';
import GameEngine from './components/GameEngine';
import Auth from './components/Auth';

function App() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [user, setUser] = useState(null);
    const [showAuth, setShowAuth] = useState(false);

    useEffect(() => {
        // Check active sessions and sets the user
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        // Listen for changes on auth state (logged in, signed out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) setShowAuth(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setIsPlaying(false);
    };

    return (
        <Layout
            user={user}
            onLoginClick={() => setShowAuth(true)}
            onLogoutClick={handleLogout}
        >
            {showAuth ? (
                <Auth
                    onAuthSuccess={(u) => {
                        setUser(u);
                        setShowAuth(false);
                    }}
                    onBack={() => setShowAuth(false)}
                />
            ) : isPlaying ? (
                <GameEngine user={user} onExit={() => setIsPlaying(false)} />
            ) : (
                <Hero onStart={() => setIsPlaying(true)} />
            )}
        </Layout>
    );
}

export default App;
