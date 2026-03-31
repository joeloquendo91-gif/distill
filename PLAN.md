# Distill — Project Plan

## What This App Is

**Distill** turns any CSV into an interactive dashboard with AI-generated insights and shareable links. All CSV parsing is client-side (never uploaded to a server). Only aggregated summaries are stored in Supabase for sharing.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React 19 |
| Styling | Tailwind CSS 4 |
| Database + Auth | Supabase (PostgreSQL, RLS, email/password auth) |
| AI | Anthropic Claude API |
| Charts | Recharts |
| CSV Parsing | PapaParse (browser-side) |
| Deployment | Vercel |

### Env vars needed (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
NEXT_PUBLIC_DEV_TIER=agency   # dev only — bypasses tier/auth checks
```

---

## What's Built

### Pages / Routes

| Path | Description |
|---|---|
| `/` | Marketing landing page (hero, features, how-it-works, pricing) |
| `/dashboard` | Main app — upload, explore, filter, narrative, share |
| `/share/[id]` | Public read-only dashboard view (server-rendered) |
| `POST /api/narrative` | Generates AI narrative via Claude (auth + tier-gated) |
| `POST /api/recon` | Haiku call on upload — profiles data + generates chart recipes |
| `POST /api/share` | Creates a shared dashboard record in Supabase |
| `GET /api/share?id=` | Fetches a shared dashboard + increments view count |
| `GET /api/tier` | Returns user's tier info |

### Core Features (all completed)

#### Data parsing & type detection
- CSV upload — drag-drop, client-side parse via PapaParse
- 7 column types auto-detected: `categorical`, `numeric`, `date`, `likert_num`, `likert_text`, `text`, `multi_select`
- Currency/percent stripping before numeric detection (`$1,000` → numeric)
- Likert text uses exact match only (no more "good morning" false positives)
- Comma multi-select requires finite vocabulary (≤30 unique options) — avoids "Smith, John" false positives
- High-cardinality columns (>80% unique) classified as TEXT instead of categorical

#### Type detection (all fixed)
- `tryParseDate()` handles DD-MMM-YYYY format (e.g. "15-Jul-2019") which `new Date()` rejects in V8
- Date check runs **before** numeric check — prevents alpha-month strings being swallowed as partial numbers
- Year columns (integers 1900–2100, ≤20 unique values) classified as `categorical` — no more "Year averages 2,020.93"
- Year-like categoricals promoted to `DATE` in `groupableColumns` so they appear in "View over time" and sort chronologically
- `analyzeDate` and `computeTimeSeriesBreakdown` both use `tryParseDate`

#### Insight sentences (data-analyst framing)
- Categorical: full distribution inline — `South (35%) · East (28%) · West (20%) · North (17%)`
- Numeric: total + median + range for large-value columns (mean ≥ 1000); mean + median + range otherwise
- Date: span + peak — `Jul 2019 – Dec 2022 · peak in 2021 (82 records)`
- `sum` added to `analyzeNumeric` stats

#### AI recon — analyst framework (rewritten 2026-03-30)
- Recon now runs a full data analyst framework on every upload:
  1. Profiles grain (what one row represents), primary metric, and dimension roles (who/where/when/what)
  2. Maps 7 universal executive questions to chart recipes using the actual column names
- Returns `dataProfile` (grain, primaryMetric, dimensions) + `chartRecipes` array
- Chart recipes validated server-side — any recipe referencing a non-existent column is stripped
- `max_tokens` increased to 2500
- `uniqueCount` per column now sent to the prompt so the LLM avoids donuts for 50-category columns

#### Recon prompt — chart type selection rules (hardened 2026-03-30 / 2026-03-31)
- **donut** — use for status/risk/tier/categorical columns with ≤6 unique values and distribution questions
- **stacked_100** — use when xDim is a geographic, industry, or segment dimension (one region almost always dominates in absolute terms; stacked_100 shows composition regardless)
- **stacked_absolute** — only when xDim is a time dimension (year/quarter) to show volume AND composition change
- **Year vs Quarter for growth question** — explicit rules added: Q1 MUST use Year as xDim (never Quarter); Quarter is only for intra-year seasonality questions; "growing/growth/trend over" in the question title bans Quarter
- Quarterly chart question framed as "aggregates ALL years together" — prevents single-year question framing

#### AI chart recipes — Dashboard mode (new 2026-03-30, fixed 2026-03-30)
- `DashboardCanvas` renders `ChartRecipeCard` components when recipes are available
- Falls back to manual column-card canvas when recon hasn't returned recipes yet
- "All Columns" view always shows the column cards unchanged
- **6 chart types now supported** in `ChartRecipeCard`:
  - `bar` — vertical bar for discrete categories/periods
  - `bar_horizontal` — horizontal ranked bar for long labels
  - `line` — area/line for continuous trends
  - `donut` — proportional share with full legend (name + value + %) below chart
  - `stacked_100` — 100% stacked bar for concentration/dependency risk
  - `stacked_absolute` — stacked bar showing volume AND composition
- `computeChartData(rows, recipe)` in csvParser executes any recipe against live filtered rows
- `computeKPIs(rows, dataProfile)` derives headline numbers (total, YoY%, top entity)
- **StackedBarChart TypeError fix** — `computeChartData` now routes by `chartType` (not `stackDim` presence) to `_computeStacked` or `_computeSimple`

#### Chart rendering fixes (2026-03-30)
- **Date sorting bug fixed** — line charts with raw date xDim (e.g. "15-Jul-2019") now call `_computeDateAggregated` which parses dates, groups by month or year depending on span, and sorts chronologically. Previously raw date strings fell through `getTimeRank` and sorted by value, scrambling the x-axis
- **Y axis visible on all chart types** — bar, horizontal bar, and line charts now show formatted tick values ($75K, 1.2M, etc.); stacked charts already had Y axis
- **Horizontal bar X axis** — value scale now shown along the bottom
- Chart heights increased slightly (180→200px) for better readability

#### Business KPI tiles (upgraded 2026-03-30)
- When recon `dataProfile` is available: shows Total metric, YoY%, Top entity + value, data quality
- Falls back to technical stats (rows, columns, completeness, anomalies) when no profile

#### Decision Brief — Sprint 1: UI shell with mock data (2026-03-31)
- New mode tabs (segmented control): **✦ Decision Brief** (default after upload) | **Dashboard**
- `activeMode` state resets to `"decision"` on every new upload
- Filter bar + recon context banner moved into Dashboard mode only
- `DecisionBriefPanel` — two-column layout:
  - Left: priority badge summary + `PriorityCard` list
  - Right: brief summary, data context (wired to `reconData.dataProfile`), "How to use this brief" guide
- `PriorityCard` — expandable evidence panel per priority:
  - Header: title, priority badge (high/medium/watch), confidence level
  - Summary: why it surfaced, affected segments with share %
  - Expanded: why it matters, evidence signals, recommended next steps, validation questions
- Mock data shows 3 priorities using specific named values (Direct Sales 94%, North America 94%, 2024 decline 9.3%)
- `isMock` flag shows "Example priorities — real analysis runs automatically after upload" disclaimer

#### Decision Brief — Sprint 2: Live signal extraction (2026-03-31)
- `lib/signalExtractor.js` — deterministic, LLM-free signal extraction from rows + dataProfile:
  - **Concentration signal** — fires when a single dimension value exceeds 50% of the primary metric; severity: high if >70%, medium if 50–70%; one signal per dimension group (who/where/what), takes strongest
  - **Trend signal** — fires when the most recent year declined vs prior year; severity: high if >10%, medium if 5–10%, watch if 3–5%; reads Year column from `dimensions.when`
  - **Disparity signal** — fires when top entity is ≥3× the average; medium priority; "who" dimensions only
- All signals produce fully-structured priority objects (title, whySurfaced, whyItMatters, affectedSegments, evidence signals, recommendedActions, validationQuestions)
- `liveBrief` useMemo in `page.js` — runs over `csvData.rows` (full dataset, not filtered) when both `csvData` and `reconData` are available
- `DecisionBriefPanel` receives `liveBrief` — mock fallback only when no file is loaded or recon hasn't completed

#### Dashboard Canvas (Looker Studio-style)
- Recipe mode: AI-generated chart set, 2-column grid, answers executive questions
- Manual mode (no recipes): top 4 columns by relevance, add/remove, "View over time" time axis
- "View over time" selector now includes year-like categorical columns (not just DATE type)
- View toggle: **Dashboard** (recipe or curated canvas) ↔ **All Columns** (full column grid)

#### Compare by (cross-column breakdown)
- On any numeric/Likert card — "Compare by" dropdown at card bottom
- Three optgroups: **Group by** (categorical), **URL breakdowns** (derived), **Over time** (date + year-like)
- Month/Quarter/Year labels sort chronologically and render as area charts
- Actual date columns use `computeTimeSeriesBreakdown` — aggregates by day/month/year based on span

#### URL dimension extraction
- Automatically detects URL columns (>70% of values start with `http://`)
- Extracts 3 derived grouping columns per URL column — subdomain, section, depth
- Only appear in "Compare by", not as chart cards

#### AI narrative
- Claude Sonnet generates 250–350 word executive summary (Pro/Agency)
- Context-aware: uses onboarding data (data type, goal, audience)
- Rate-limited by tier with monthly reset

#### Auth & tiers
- Supabase email/password auth
- Free / Pro / Agency tiers with feature gates
- `NEXT_PUBLIC_DEV_TIER=agency` in `.env.local` bypasses all tier checks locally
- Supabase stub client — app starts cleanly when Supabase isn't configured

#### Sharing
- Unique public URLs, only aggregated data stored (never raw CSV)
- View counter, tier-gated share limits

---

## The Chart Selection Framework

The recon doesn't use per-dataset rules. It uses a question-driven framework that generalizes to any business dataset:

**Step 1 — Profile the data**
- Grain: what one row represents (transaction, survey response, employee record, daily snapshot)
- Primary metric: the numeric column being measured
- Dimension roles: who (entity), where (geography), when (time), what (category)

**Step 2 — Map universal executive questions to chart types**

| Question | Chart type |
|---|---|
| Is it growing? | Bar by Year or Quarter |
| Who/what drives the most value? | Ranked bar or horizontal bar |
| What's the distribution/mix? | Donut |
| Where exactly did it peak or drop? | Line by quarter/month |
| Are we dangerously concentrated? | Stacked 100% bar |
| Many small deals or few large ones? | Horizontal bar (avg) |
| Which segments are growing vs shrinking? | Stacked absolute bar |

**This scales without per-dataset rules.** The AI maps questions to columns for any dataset. You only extend the framework when you encounter a genuinely new data shape or question type.

---

## What's Still Missing

### Decision Brief — Remaining Sprints

**Sprint 3 — Claude Haiku synthesis layer**
- Add `POST /api/decision-brief` endpoint: takes extracted signals (not raw rows), calls Claude Haiku to rewrite titles, whySurfaced, whyItMatters, and recommendations in natural, specific language
- Signal extraction stays client-side (`lib/signalExtractor.js`); only the signal JSON (not rows) is sent to the API
- UI: show a brief-specific loading state while Haiku synthesises (separate from recon loading)
- Brief summary auto-generated by Claude from all signals together
- Fallback: if API call fails, surface the deterministic brief (Sprint 2 output) rather than mock

**Sprint 4 — Evidence drawer + related charts**
- Expand each `PriorityCard` to link to a related chart from the Dashboard's recipe set
- "Explore in Dashboard" button on each card pre-navigates to Dashboard mode and highlights the relevant chart
- Copy-to-clipboard action on each priority (title + evidence bullets as plain text)
- Optional: "Export brief as PDF" button (Agency tier)

**Sprint 5 — Scoring refinement + edge cases**
- Tune concentration threshold (currently 50%) — test with survey, SaaS, HR datasets
- Add watch-level items for near-misses (e.g. 45% concentration)
- Handle datasets with no numeric primary metric (text/categorical only)
- Handle single-year datasets (no trend signal possible) with graceful messaging
- Test signal quality on: survey data, employee records, marketing analytics, SaaS accounts

### Phase 2 — Revenue & accounts

1. **Stripe integration** — no payment flow exists; pricing CTAs go to `/dashboard`. Need Stripe Checkout for Pro/Agency upgrades and a webhook to update `user_tiers.tier` in Supabase.

2. **Account/usage page** — no page for users to see their plan, AI calls used/remaining this month, shares created, or upgrade/cancel.

### Phase 3 — Unbuilt tier features

3. **PDF export** (Pro + Agency) — listed in pricing, not implemented. Approach: `html2canvas` + `jspdf` to capture the canvas, or a print stylesheet. Needs a gated "Export PDF" button.

4. **Client management dashboard** (Agency) — `/my-dashboards` page listing all shared dashboards with title, view count, date, link, delete.

5. **White-label branding** (Agency) — custom logo + brand color on shared dashboards. Needs `branding_json` column on `shared_dashboards` and settings page.

### Phase 4 — Polish

6. **Recipe user controls** — ability to add/remove individual recipe cards from the dashboard view, similar to the manual canvas add/remove.
7. **Multi-metric datasets** — recon currently picks one `primaryMetric`; datasets with Revenue + Units + Margin need a metric picker.
8. **Dashboard description field** — `shared_dashboards.description` exists in DB, never set or displayed.
9. **Narrative copy button** — one-click copy in NarrativePanel.
10. **Mobile responsiveness** — filter bar and charts need review on small screens.
11. **Empty state for `/share/[id]`** — better 404 when a shared dashboard is deleted or ID is invalid.

---

## Suggested Build Order

1. Stripe integration — without it the tier system is cosmetic
2. Account/usage page — users can't see their plan
3. PDF export — highest-value unbuilt feature listed in Pro pricing
4. Client management dashboard — Agency differentiator
5. White-label branding — Agency differentiator
6. Recipe user controls + multi-metric support
7. Polish items

---

## Key Files Reference

```
app/
  page.js                    Landing page (marketing)
  dashboard/page.js          Main dashboard (all state lives here)
  share/[id]/page.js         Public share view
  api/narrative/route.js     Claude Sonnet narrative + quota tracking
  api/recon/route.js         Claude Haiku — data profile + chart recipes (rewritten 2026-03-30)
  api/share/route.js         Create/fetch shared dashboards
  api/tier/route.js          User tier lookup

components/
  DashboardCanvas.js         Recipe mode + manual canvas with time axis
  ChartRecipeCard.js         Renders any chart recipe (bar/line/donut/stacked) — new 2026-03-30
  DecisionBriefPanel.js      Two-column brief layout (priority cards + summary sidebar) — new 2026-03-31
  PriorityCard.js            Expandable priority card (evidence, actions, questions) — new 2026-03-31
  ColumnCard.js              Single column chart card with Compare by
  InsightBoard.js            Legacy top-8 layout (kept for reference)
  CSVUpload.js               Drag-drop upload UI
  FilterBar.js               Multi-select filter dropdowns
  NarrativePanel.js          AI narrative display
  OnboardingModal.js         3-step context wizard
  AuthModal.js               Sign in / sign up
  TierGateModal.js           Upgrade prompt modal

lib/
  csvParser.js               CSV parsing, type detection, analysis, chart recipe execution (~800 lines)
  signalExtractor.js         Deterministic signal extraction (concentration/trend/disparity) — new 2026-03-31
  supabase.js                Supabase client with no-op stub for local dev
  tiers.js                   Tier config + canUseFeature() helper

supabase/
  schema.sql                 Full DB schema with RLS + triggers
```
