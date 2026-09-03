import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Supabase credentials come from the environment only. There are no
// hard-coded fallbacks: a bundle must never carry credentials that were not
// deliberately supplied by the build.
//
//   local dev  -> kogi-quest/.env (see .env.example)
//   CI / Pages -> GitHub Actions secrets, see DEPLOYMENT_SETUP.md
//
// Only VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are ever exposed to the
// browser. The anon/publishable key is public by design; it is an identifier,
// not a secret, and Row Level Security is the actual security boundary.
// The service-role key must NEVER appear here, in .env, in CI, or in the
// bundle. It bypasses RLS entirely.
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "VITE_");
    const url = env.VITE_SUPABASE_URL?.trim();
    const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

    if (mode === "production" && (!url || !anonKey)) {
        // Warn loudly rather than failing the build: the app ships a
        // controlled configuration screen for this case, which is more useful
        // than a red CI log nobody reads. See src/lib/supabase.js.
        console.warn(
            "\n[kogi-quest] WARNING: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are missing.\n" +
            "  The build will succeed but the deployed app will show a configuration error.\n" +
            "  Set them as GitHub Actions secrets - see DEPLOYMENT_SETUP.md.\n"
        );
    }

    if (env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_KEY) {
        // A service-role key in a VITE_ variable would be inlined into the
        // public bundle. Refuse to build.
        throw new Error(
            "[kogi-quest] A service-role key was found in a VITE_ environment variable. " +
            "VITE_ variables are inlined into the public browser bundle. Remove it: the " +
            "service-role key bypasses Row Level Security and must never reach the client."
        );
    }

    return {
        plugins: [react()],
        base: "/kogiqest/",
    };
});
