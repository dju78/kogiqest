import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Shown when the build genuinely lacks its Supabase environment variables.
 * A deliberate, explanatory screen beats a blank page or a spinner that never
 * resolves. It names the missing variables but never their values.
 */
const ConfigurationError = ({ title, detail }) => (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white/5 backdrop-blur-xl border border-amber-500/20 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-4 text-amber-400">
                <AlertTriangle className="w-7 h-7 shrink-0" />
                <h1 className="text-2xl font-bold">{title}</h1>
            </div>

            <p className="text-slate-300 mb-6 leading-relaxed">{detail}</p>

            <div className="bg-slate-950/50 border border-white/10 rounded-2xl p-5 text-sm text-slate-400 space-y-3">
                <p className="font-semibold text-slate-200">How to fix this</p>
                <ul className="list-disc ml-5 space-y-2">
                    <li>
                        Running locally: copy <code className="text-cyan-300">.env.example</code> to{' '}
                        <code className="text-cyan-300">.env</code>, fill in both values, then restart the dev server.
                    </li>
                    <li>
                        Deployed build: set <code className="text-cyan-300">VITE_SUPABASE_URL</code> and{' '}
                        <code className="text-cyan-300">VITE_SUPABASE_ANON_KEY</code> as GitHub Actions secrets and re-run
                        the workflow.
                    </li>
                </ul>
                <p className="pt-2 border-t border-white/10 text-xs">
                    Only the anon (publishable) key belongs in a browser build. Never add a service-role key: it bypasses
                    Row Level Security.
                </p>
            </div>
        </div>
    </div>
);

export default ConfigurationError;
