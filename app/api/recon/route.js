import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

export async function POST(request) {
  try {
    const { columns, rowCount, userContext } = await request.json();
    if (!columns?.length) {
      return Response.json({ error: "No columns" }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const colLines = columns
      .map((c) => `- "${c.name}" (${c.type}, ${c.uniqueCount ?? "?"} unique values): ${c.samples.join(", ") || "no samples"}`)
      .join("\n");

    const columnNames = new Set(columns.map((c) => c.name));

    const contextBlock = userContext
      ? `\nUser context:
- Data domain: ${userContext.dataType || "unspecified"}
- Goal: ${userContext.goal || "not provided"}
- Audience: ${userContext.audience || "not provided"}
Use this context to tailor chart titles, choose the most relevant dimensions, and frame questions in terms the audience cares about.\n`
      : "";

    const prompt = `You are a senior data analyst profiling a CSV dataset to auto-build a business dashboard.

Dataset: ${rowCount} rows, ${columns.length} columns
${contextBlock}
Columns (name, detected type, unique value count, sample values):
${colLines}

Your job — in this order:
1. Profile the data: what one row represents, what the primary metric is, how each dimension is used
2. Generate 4–6 chart recipes that answer the most important questions an executive would ask before asking them

Chart types:
- "bar" — vertical bar, for ≤8 discrete categories or periods (year, quarter); use for volume comparison when categories are similar in size
- "bar_horizontal" — horizontal bar, for ranked lists with long labels
- "line" — area/line, for trends over many continuous time periods (use when xDim is a date column or there are 8+ periods)
- "donut" — proportional share of a whole, for ≤6 categories; best for "what portion is X?" questions — use even when showing sums if the question is about distribution or exposure
- "stacked_100" — 100% stacked bar, shows composition mix per category; use when xDim categories vary widely in total size (one may dominate) — normalises to 100% so composition is readable regardless of volume differences
- "stacked_absolute" — stacked bar with real values; use ONLY when xDim is a time dimension (year/quarter) and you want to show volume growth AND composition change simultaneously

Aggregations: "sum", "avg", "count"

Chart recipe rules:
- metric must be a numeric column (type numeric)
- xDim is the primary grouping axis — categorical or time dimension
- stackDim is only used with stacked_100 or stacked_absolute — it adds a second dimension
- For time-based bar charts, ALWAYS prefer a discrete time column (Year, Quarter) over a raw date column — Year and Quarter produce clean grouped bars; raw dates produce hundreds of bars
- For the growth-over-time question (Q1), ALWAYS use a Year column as xDim if one exists — NEVER use Quarter for this recipe even if the question mentions quarterly performance; Quarter collapses all years together (Q1 accumulates every year's Q1) making it useless for showing growth trends
- If a Year column exists, Q1 MUST be answered with a separate Year-based recipe — do not combine growth and quarterly granularity into one recipe
- Quarter is only appropriate for intra-year granularity questions (e.g. "where did it peak within a year?") and must never appear in a recipe whose question contains the words "growing", "growth", or "trend over"
- Use "line" only when xDim is a raw date column or there are genuinely many continuous periods
- Use "donut" (not "bar") when xDim is a status, risk, tier, or categorical column with ≤6 unique values and the question asks about distribution or exposure — bar makes the dominant category look fine and the minority invisible; donut shows each slice's share of the whole
- Use "bar_horizontal" for columns with more than 6 categories
- Use "stacked_100" (not "stacked_absolute") when xDim is a geographic, industry, or segment dimension — one region/segment almost always dominates in absolute terms, making stacked_absolute unreadable; stacked_100 shows plan/product mix per segment regardless of size
- Use "stacked_absolute" only when xDim is a time dimension (year/quarter) so the reader can see both volume and composition changing over time
- Never use a raw date column (type: date) as xDim for stacked_100 or stacked_absolute — use a discrete time column (Year, Quarter, Month) instead; if none exists, skip the stacked chart
- Order recipes most-to-least strategically important
- Use EXACT column names from the input list above

Executive questions to answer (map these to your recipes):
1. Is the overall metric growing over time? (MUST use Year as xDim if a Year column exists — never Quarter for this recipe)
2. Which entity (client/product/rep) drives the most value?
3. What is the geographic or segment distribution? (use donut if xDim ≤6 values; use stacked_100 with stackDim = plan/type/tier for geographic breakdowns with a second dimension)
4. Which quarter or period sees the strongest and weakest performance? (use Quarter as xDim — this chart aggregates ALL years together to reveal seasonal patterns; the question MUST be framed as a seasonal/cyclical insight e.g. "Which quarter drives the most revenue?" NOT as a single-year question like "within 2022..." — never reference a specific year in this question)
5. Are we dangerously concentrated in one entity in any given period? (use stacked_100 with xDim = time and stackDim = who dimension e.g. client/rep/product — NOT geography)
6. Are we looking at many small deals or few large ones (avg vs total)?
7. Which segments are growing vs contracting over time? (use stacked_absolute with xDim = time and stackDim = who or what dimension)

Return ONLY this JSON — no markdown, no explanation:
{
  "dataContext": "one present-tense sentence describing what this dataset tracks",
  "dataProfile": {
    "grain": "what one row represents (e.g. transaction, survey_response, employee_record, daily_snapshot)",
    "primaryMetric": "the main numeric column name being measured",
    "dimensions": {
      "who": ["entity columns: client, customer, rep, product, etc."],
      "where": ["geography columns: region, country, city, etc."],
      "when": ["time columns: date, year, quarter, month, etc."],
      "what": ["category columns: type, stage, department, status, etc."]
    }
  },
  "chartRecipes": [
    {
      "question": "Is the business growing?",
      "title": "Revenue by Year",
      "subtitle": "Total across all clients and regions",
      "metric": "Amount",
      "xDim": "Year",
      "stackDim": null,
      "chartType": "bar",
      "aggregation": "sum"
    }
  ]
}`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });

    if (message.stop_reason === "max_tokens") {
      return Response.json({ error: "Response truncated — max_tokens hit" }, { status: 500 });
    }

    let text = message.content[0].text.trim();
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    const result = JSON.parse(text);

    // Guard: strip any recipes that reference columns not in this dataset
    if (result.chartRecipes) {
      result.chartRecipes = result.chartRecipes.filter(
        (r) =>
          columnNames.has(r.metric) &&
          columnNames.has(r.xDim) &&
          (r.stackDim === null || r.stackDim === undefined || columnNames.has(r.stackDim))
      );
    }

    // Guard: primaryMetric must exist in the dataset
    if (
      result.dataProfile?.primaryMetric &&
      !columnNames.has(result.dataProfile.primaryMetric)
    ) {
      result.dataProfile.primaryMetric = null;
    }

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
