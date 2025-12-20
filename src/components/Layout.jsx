import React from 'react';
import { Rocket } from 'lucide-react';

const Layout = ({ children, user, onLoginClick, onLogoutClick }) => {
    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 text-white overflow-hidden">
            <header className="p-6 flex justify-between items-center backdrop-blur-sm bg-white/5 border-b border-white/10 z-20">
                <div className="flex items-center gap-2">
                    <Rocket className="w-8 h-8 text-cyan-400" />
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">
                        KogiQuest
                    </h1>
                </div>

                <div className="flex items-center gap-6">
                    <div className="hidden md:block text-xs font-light text-slate-400 tracking-widest uppercase">
                        OMOYELE EDUVERSE
                    </div>

                    {user ? (
                        <div className="flex items-center gap-4 bg-white/5 pl-4 pr-2 py-1.5 rounded-full border border-white/10">
                            <span className="text-sm font-medium text-slate-200">{displayName}</span>
                            <button
                                onClick={onLogoutClick}
                                className="px-4 py-1.5 bg-white/10 hover:bg-red-500/20 hover:text-red-400 rounded-full text-xs font-bold transition-all border border-white/5 hover:border-red-500/30"
                            >
                                Sign Out
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={onLoginClick}
                            className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full text-sm font-bold shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/25 active:scale-95 transition-all"
                        >
                            Log In / Sign Up
                        </button>
                    )}
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
