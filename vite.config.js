import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    base: "/kogiqest/",
    define: {
        // Fallback values if env vars are not set during build
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
            process.env.VITE_SUPABASE_URL || 'https://xnsvxgqvamjaqrexiash.supabase.co'
        ),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
            process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_WrwwQ3BywY7ZrhUrbF7wLQ_Zc9XGsip'
        ),
    },
});
