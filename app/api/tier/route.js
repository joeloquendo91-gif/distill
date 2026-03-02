import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function GET(request) {
  try {
    const supabase = getSupabase();
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return Response.json({ tier: "free" });

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return Response.json({ tier: "free" });

    const { data } = await supabase
      .from("user_tiers")
      .select("tier, row_limit, ai_calls_this_month, shares_created")
      .eq("user_id", user.id)
      .single();

    return Response.json(data || { tier: "free" });
  } catch {
    return Response.json({ tier: "free" });
  }
}
