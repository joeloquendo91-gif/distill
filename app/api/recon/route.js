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

    const columnNames = new Set(columns.map((c) => c.name));

    const prompt = `You are a senior data analyst profiling a CSV dataset to auto-build a business dashboard.

Dataset: ${rowCount} rows, ${columns.length} columns

Columns (name, detected type, sample values):
${colLines}

Your job — in this order:
1. Profile the data: what one row represents, what the primary metric is, how each dimension is used
2. Generate 4–6 chart recipes that answer the most important questions an executive would ask before asking them

Chart types:
- "bar" — vertical bar, for ≤8 discrete categories or periods (year, quarter)
- "bar_horizontal" — horizontal bar, for ranked lists with long labels
- "line" — area/line, for trends over many continuous time periods (use when xDim is a date column or there are 8+ periods)
- "donut" — proportional share of a whole, for ≤6 categories
- "stacked_100" — 100% stacked bar, shows composition per period (concentration/dependency risk)
- "stacked_absolute" — stacked bar with real values, shows volume AND composition together

Aggregations: "sum", "avg", "count"

Chart recipe rules:
- metric must be a numeric column (type numeric)
- xDim is the primary grouping axis — categorical or time dimension
- stackDim is only used with stacked_100 or stacked_absolute — it adds a second dimension
- Prefer "bar" for year/quarter; use "line" for date or 8+ time periods
- Order recipes most-to-least strategically important
- Use EXACT column names from the input list above

Executive questions to answer (map these to your recipes):
1. Is the overall metric growing over time?
2. Which entity (client/product/rep) drives the most value?
3. What is the geographic or segment distribution?
4. Where exactly did the metric peak or decline (granular time)?
5. Are we dangerously concentrated in one entity in any given period?
6. Are we looking at many small deals or few large ones (avg vs total)?
7. Which segments are growing vs contracting over time?

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
  "columns": [
    {"name": "exact column name", "description": "plain-English label", "isKPI": false}
  ],
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
  ],
  "suggestedComparisons": [
    {"metric": "numeric column name", "groupBy": "categorical column name", "label": "Label →"}
  ]
}`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

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
