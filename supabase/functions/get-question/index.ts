import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Grab the JWT from the request
    const authHeader = req.headers.get("Authorization") ?? "";

    // If no bearer token, block
    if (!authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    // Create a Supabase client that uses the user's JWT
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
    });

    // Validate the user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    // Now fetch (RLS will enforce auth-only access)
    const { data, error } = await supabase
        .from("questions")
        .select("id, question, options, category, difficulty") // Exclude 'answer' to prevent cheating
        .limit(1);

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ data }), {
        headers: { "Content-Type": "application/json" },
    });
});
