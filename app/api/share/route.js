import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function POST(request) {
  try {
    const supabase = getSupabase();
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: tierData } = await supabase
      .from("user_tiers")
      .select("tier, shares_created")
      .eq("user_id", user.id)
      .single();

    const tier = tierData?.tier || "free";
    if (tier === "free") {
      return Response.json({ error: "Shareable dashboards require a Pro or Agency plan." }, { status: 403 });
    }

    const sharesLimit = tier === "pro" ? 25 : Infinity;
    const sharesUsed = tierData?.shares_created || 0;
    if (sharesUsed >= sharesLimit) {
      return Response.json({ error: "Share limit reached. Upgrade to Agency for unlimited shares." }, { status: 429 });
    }

    const { title, columns, rowCount, totalRows, narrative } = await request.json();
    const safeColumns = columns.map(({ sampleResponses: _r, ...col }) => col);

    const { data, error } = await supabase
      .from("shared_dashboards")
      .insert({
        user_id: user.id,
        title: title || "Untitled Dashboard",
        summary_json: { columns: safeColumns, rowCount, totalRows },
        narrative: narrative || null,
        is_public: true,
      })
      .select("id")
      .single();

    if (error) throw error;

    await supabase
      .from("user_tiers")
      .update({ shares_created: sharesUsed + 1 })
      .eq("user_id", user.id);

    return Response.json({ id: data.id });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

    const { data, error } = await supabase
      .from("shared_dashboards")
      .select("id, title, description, summary_json, narrative, view_count, created_at")
      .eq("id", id)
      .eq("is_public", true)
      .single();

    if (error || !data) return Response.json({ error: "Dashboard not found" }, { status: 404 });

    supabase.rpc("increment_view_count", { dashboard_id: id });

    return Response.json(data);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
