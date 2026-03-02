export const maxDuration = 60;

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function POST(request) {
  const supabase = getSupabase();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Check tier
    const { data: tierData } = await supabase
      .from("user_tiers")
      .select("tier, ai_calls_this_month, ai_calls_reset_at")
      .eq("user_id", user.id)
      .single();

    const tier = tierData?.tier || "free";
    if (tier === "free") {
      return Response.json({ error: "AI Narrative requires a Pro or Agency plan." }, { status: 403 });
    }

    const limits = { pro: 50, agency: 200 };
    const resetDate = tierData?.ai_calls_reset_at ? new Date(tierData.ai_calls_reset_at) : null;
    const callCount = resetDate && new Date() > resetDate ? 0 : (tierData?.ai_calls_this_month || 0);
    if (callCount >= (limits[tier] || 50)) {
      return Response.json({ error: "Monthly AI narrative limit reached." }, { status: 429 });
    }

    const { fileName, rowCount, totalRows, columnSummaries } = await request.json();

    const colDescriptions = columnSummaries
      .map((c) => {
        const top = c.topValues?.slice(0, 5).join(", ") || "";
        const statsStr = c.stats
          ? ` (mean: ${c.stats.mean}, median: ${c.stats.median}, range: ${c.stats.min}–${c.stats.max})`
          : "";
        const avgStr = c.avg !== undefined ? ` (avg: ${c.avg})` : "";
        return `- "${c.name}" [${c.type}]: ${c.count} responses${statsStr}${avgStr}${top ? `. Top values: ${top}` : ""}`;
      })
      .join("\n");

    const filteredNote =
      rowCount < totalRows
        ? ` (filtered to ${rowCount.toLocaleString()} of ${totalRows.toLocaleString()} total rows)`
        : "";

    const prompt = `You are a data analyst writing an executive summary for a client-facing report.

Dataset: "${fileName || "Untitled"}" — ${rowCount.toLocaleString()} rows${filteredNote}, ${columnSummaries.length} columns.

Column summaries:
${colDescriptions}

Write a clear, professional narrative (250–350 words) that:
1. Opens with the single most important finding
2. Highlights 2–3 key patterns or trends in the data
3. Notes anything unexpected or worth investigating
4. Closes with one actionable recommendation

Write in plain prose paragraphs. No headers, no bullet points. Write as if presenting to a non-technical client.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const narrative = message.content[0].text;

    // Increment usage counter
    await supabase
      .from("user_tiers")
      .update({
        ai_calls_this_month: callCount + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return Response.json({ narrative });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
