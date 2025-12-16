import React from 'react';
import { motion } from 'framer-motion';

const Bubbles = () => {
    // Generate random bubbles
    const bubbles = Array.from({ length: 50 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100, // Random left position %
        size: Math.random() * 20 + 10, // Random size 10-30px
        duration: Math.random() * 2 + 3, // Random duration 3-5s
        delay: Math.random() * 2, // Random delay
        color: ['bg-cyan-400', 'bg-purple-400', 'bg-yellow-400', 'bg-green-400', 'bg-red-400'][Math.floor(Math.random() * 5)]
    }));

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {bubbles.map((bubble) => (
                <motion.div
                    key={bubble.id}
                    className={`absolute rounded-full ${bubble.color} opacity-70`}
                    style={{
                        left: `${bubble.x}%`,
                        width: bubble.size,
                        height: bubble.size,
                        bottom: -50,
                    }}
                    animate={{
                        y: -1000, // Float up
                        x: Math.random() * 100 - 50, // Slight horizontal drift
                        opacity: [0, 0.8, 0], // Fade in then out
                    }}
                    transition={{
                        duration: bubble.duration,
                        repeat: Infinity,
                        delay: bubble.delay,
                        ease: "linear"
                    }}
                />
            ))}
        </div>
    );
};

export default Bubbles;
