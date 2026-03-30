import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

export async function POST(request) {
  try {
    const { columns, rowCount } = await request.json();
    if (!columns?.length) {
      return Response.json({ error: "No columns" }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const colLines = columns
      .map((c) => `- "${c.name}" (${c.type}): ${c.samples.join(", ") || "no samples"}`)
      .join("\n");

    const prompt = `Analyze this CSV dataset and return ONLY a valid JSON object — no markdown, no code blocks, no explanation.

Dataset: ${rowCount} rows, ${columns.length} columns

Columns (name, detected type, sample values):
${colLines}

Return this exact JSON structure:
{
  "dataContext": "one sentence describing what this dataset tracks and what it is for",
  "columns": [
    {"name": "exact column name from input", "description": "plain-English label for this column", "isKPI": false}
  ],
  "suggestedComparisons": [
    {"metric": "numeric column name", "groupBy": "categorical column name", "label": "Metric by Category"}
  ]
}

Rules:
- dataContext: one clear sentence, present tense, no filler
- columns: include ALL columns; isKPI true only for business outcome metrics (revenue, score, rate, count, satisfaction, nps)
- suggestedComparisons: up to 3 pairs, most insightful first; metric must be numeric or likert_num type; groupBy can be categorical (for group breakdowns) OR date (for trends over time); for date groupBy use label like "Revenue over Time"
- Use exact column names from the input
- Return ONLY the JSON object, nothing else`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    });

    let text = message.content[0].text.trim();
    // Strip markdown code fences if model wraps its output
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    const result = JSON.parse(text);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
