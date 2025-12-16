import React, { useState } from 'react';
import Layout from './components/Layout';
import Hero from './components/Hero';
import GameEngine from './components/GameEngine';

function App() {
    const [isPlaying, setIsPlaying] = useState(false);

    return (
        <Layout>
            {isPlaying ? (
                <GameEngine onExit={() => setIsPlaying(false)} />
            ) : (
                <Hero onStart={() => setIsPlaying(true)} />
            )}
        </Layout>
    );
}

export default App;
