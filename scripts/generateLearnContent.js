// scripts/generateLearnContent.js
// Generates content/learn/[slug].json for every topic in lib/learnTopics.js
// that doesn't already have a content file.
//
// Usage:
//   node scripts/generateLearnContent.js           — generate all missing
//   node scripts/generateLearnContent.js --force   — regenerate all
//   node scripts/generateLearnContent.js --slug how-to-make-a-line-chart-to-show-trends

import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import topics from "../lib/learnTopics.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, "../content/learn");
const client = new Anthropic();

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const SLUG_FILTER = args.includes("--slug")
  ? args[args.indexOf("--slug") + 1]
  : null;

function contentPath(slug) {
  return join(CONTENT_DIR, `${slug}.json`);
}

function buildPrompt(topic) {
  return `You are writing SEO-optimized content for a data visualization tool called Distill.
Distill lets users upload a CSV file and instantly get auto-generated charts, AI-written narratives, and shareable dashboards. It's free for CSVs up to 1,000 rows.

Write the article content for this topic:
- H1: "${topic.h1}"
- Primary keyword: "${topic.primaryKeyword}"
- Cluster: ${topic.clusterName}

WRITING RULES — follow these strictly:
1. No em dashes. Use commas, periods, or rewrite the sentence instead.
2. No AI-sounding filler ("In today's world", "It's worth noting", "Dive into", "Leverage", "Unlock", "Seamlessly").
3. Short, direct sentences. Active voice. Plain English.
4. Sound like a knowledgeable colleague explaining something, not a marketing page.
5. Primary keyword must appear in the intro paragraph (first 100 words).
6. Flesch reading score target: 60 or above. Keep it accessible.

Return ONLY a valid JSON object with this exact structure (no markdown, no code fences, no explanation):

{
  "intro": "2-3 sentence hook. State the problem, mention the fastest solution. Primary keyword must appear here.",

  "whatIs": {
    "heading": "What Is a [thing]?",
    "body": "2-3 sentences. Define it clearly. Explain what data it works best with."
  },

  "whenToUse": {
    "heading": "When Should You Use a [thing]?",
    "bullets": [
      "First use case. One sentence, specific.",
      "Second use case. One sentence, specific.",
      "Third use case. One sentence, specific."
    ]
  },

  "excelSteps": {
    "heading": "How to Make [thing] in Excel",
    "subheading": "Step-by-step instructions",
    "steps": [
      "Step 1 text.",
      "Step 2 text.",
      "Step 3 text.",
      "Step 4 text.",
      "Step 5 text.",
      "Step 6 text."
    ]
  },

  "sheetsSteps": {
    "heading": "How to Make [thing] in Google Sheets",
    "subheading": "Step-by-step instructions",
    "steps": [
      "Step 1 text.",
      "Step 2 text.",
      "Step 3 text.",
      "Step 4 text.",
      "Step 5 text.",
      "Step 6 text."
    ]
  },

  "distillSection": {
    "heading": "A Faster Way: Skip the Manual Steps with Distill",
    "body": "1 paragraph. Position Distill as the zero-friction alternative. Mention that uploading a CSV auto-generates charts instantly. Do not use em dashes."
  },

  "gifAlt": "One sentence describing a screen recording of a CSV being uploaded to Distill and generating [chart type] automatically.",

  "faqs": [
    {
      "q": "Can I do this without Excel?",
      "a": "Answer in 2-3 sentences. Mention Google Sheets and Distill as alternatives."
    },
    {
      "q": "A relevant technical question about the chart type or use case.",
      "a": "Clear, factual answer. 2-3 sentences."
    },
    {
      "q": "Is Distill free to use?",
      "a": "Yes. Distill's free tier supports CSV files up to 1,000 rows and includes all chart types. No account is required to try it."
    }
  ]
}`;
}

async function generateArticle(topic) {
  console.log(`Generating: ${topic.slug}`);

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: buildPrompt(topic) }],
  });

  const raw = message.content[0].text.trim();

  // Strip any accidental markdown code fences
  const jsonText = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    console.error(`  Parse error for ${topic.slug}:`, err.message);
    console.error("  Raw output:", raw.slice(0, 300));
    throw err;
  }

  return parsed;
}

async function main() {
  if (!existsSync(CONTENT_DIR)) {
    mkdirSync(CONTENT_DIR, { recursive: true });
  }

  const targets = topics.filter((t) => {
    if (SLUG_FILTER) return t.slug === SLUG_FILTER;
    if (FORCE) return true;
    return !existsSync(contentPath(t.slug));
  });

  if (targets.length === 0) {
    console.log("All content files already exist. Use --force to regenerate.");
    return;
  }

  console.log(`Generating ${targets.length} article(s)...\n`);

  let passed = 0;
  let failed = 0;

  for (const topic of targets) {
    try {
      const content = await generateArticle(topic);
      writeFileSync(contentPath(topic.slug), JSON.stringify(content, null, 2));
      console.log(`  Done: ${topic.slug}\n`);
      passed++;
    } catch (err) {
      console.error(`  Failed: ${topic.slug} — ${err.message}\n`);
      failed++;
    }
  }

  console.log(`\nComplete. ${passed} generated, ${failed} failed.`);
}

main();
