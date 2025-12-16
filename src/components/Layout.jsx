import React from 'react';
import { Rocket } from 'lucide-react';

const Layout = ({ children }) => {
    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 text-white overflow-hidden">
            <header className="p-6 flex justify-between items-center backdrop-blur-sm bg-white/5 border-b border-white/10 z-10">
                <div className="flex items-center gap-2">
                    <Rocket className="w-8 h-8 text-cyan-400" />
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">
                        KogiQuest
                    </h1>
                </div>
                <div className="text-sm font-light text-slate-300">
                    OMOYELE EDUVERSE
                </div>
            </header>

            <main className="flex-1 relative">
                {/* Background decorative elements */}
                <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500/20 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

                {children}
            </main>
        </div>
    );
};

export default Layout;
