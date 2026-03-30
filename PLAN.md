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
| `POST /api/recon` | Lightweight Haiku call on upload — column context + suggestions |
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
- High-cardinality columns (>80% unique) classified as TEXT instead of categorical — no more useless "Other" bar charts

#### Dashboard Canvas (Looker Studio-style)
- Starts with top 4 KPI columns by relevance score
- 2-column layout — wider cards, more readable charts
- Hover to reveal **×** remove button per card
- **"+ Add chart"** picker — shows all remaining columns grouped by type
- View toggle: **Dashboard** (curated canvas) ↔ **All Columns** (full grid)

#### Global time axis
- "View over time" selector at canvas toolbar — picks any date column
- When active, all numeric/Likert cards switch to time series (area chart) automatically
- Stays pinned as you add/remove charts or change filters
- Per-card "Compare by" still works for categorical slicing on top

#### Compare by (cross-column breakdown)
- On any numeric/Likert card — a "Compare by" dropdown at card bottom
- Three optgroups: **Group by** (categorical), **URL breakdowns** (derived), **Over time** (date)
- Month/Quarter/Year labels sort chronologically and render as area charts
- Actual date columns use `computeTimeSeriesBreakdown` — aggregates by day/month/year based on span
- Chart area replaces the default histogram when a breakdown is active; **✕** to clear

#### URL dimension extraction
- Automatically detects URL columns (>70% of values start with `http://`)
- Extracts 3 derived grouping columns per URL column — no charts, only appear in "Compare by":
  - `page / subdomain` — `app`, `www`, `go`, `(root domain)`
  - `page / section` — first path segment (`/users/`, `/blog/`, `(homepage)`)
  - `page / depth` — `Homepage`, `1 level`, `2 levels`, `3+ levels`
- Works automatically with Search Console, analytics, and any URL-heavy dataset

#### AI recon (on upload)
- Single Haiku call fires automatically after upload — non-blocking, free tier
- Returns: one-sentence data context, column descriptions, up to 3 suggested comparisons
- Context sentence shown in green banner above canvas
- Suggestion chips (e.g. "Revenue by Stage →") pre-set the breakdown on the target card with one click
- KPI columns flagged by AI get a +0.2 relevance boost — surface at top of canvas
- Column descriptions shown as subtitles below column names on cards

#### AI narrative
- Claude Sonnet generates 250–350 word executive summary (Pro/Agency)
- Context-aware: uses onboarding data (data type, goal, audience)
- Rate-limited by tier with monthly reset

#### Charts (all fixed)
- Numeric histogram: X-axis hidden (range shown in footer), no label overlap
- Date area chart: tick interval limited to ~5 labels regardless of data length
- Date/time series charts: 16px horizontal margin — no clipping at ends
- Likert text: colors inverted (Strongly Agree = green, not red)
- Likert numeric: colors based on actual scale position, not array index
- Type badge on each card is now a `<select>` — users can correct misdetections

#### Auth & tiers
- Supabase email/password auth
- Free / Pro / Agency tiers with feature gates
- `NEXT_PUBLIC_DEV_TIER=agency` in `.env.local` bypasses all tier checks locally
- Supabase stub client — app starts cleanly when Supabase isn't configured

#### Sharing
- Unique public URLs, only aggregated data stored (never raw CSV)
- View counter, tier-gated share limits

---

## What's Still Missing

### Phase 2 — Revenue & accounts

1. **Stripe integration** — no payment flow exists; pricing CTAs go to `/dashboard`. Need Stripe Checkout for Pro/Agency upgrades and a webhook to update `user_tiers.tier` in Supabase.

2. **Account/usage page** — no page for users to see their plan, AI calls used/remaining this month, shares created, or upgrade/cancel.

### Phase 3 — Unbuilt tier features

3. **PDF export** (Pro + Agency) — listed in pricing, not implemented. Approach: `html2canvas` + `jspdf` to capture the canvas, or a print stylesheet. Needs a gated "Export PDF" button.

4. **Client management dashboard** (Agency) — `/my-dashboards` page listing all shared dashboards with title, view count, date, link, delete. Also where to set/edit the `description` field (in DB schema, unused in UI).

5. **White-label branding** (Agency) — custom logo + brand color on shared dashboards. Needs `branding_json` column on `shared_dashboards` and settings page.

### Phase 4 — Polish

6. **Dashboard description field** — `shared_dashboards.description` exists in DB, never set or displayed.
7. **Narrative copy button** — one-click copy in NarrativePanel.
8. **Mobile responsiveness** — filter bar and charts need review on small screens.
9. **Empty state for `/share/[id]`** — better 404 when a shared dashboard is deleted or ID is invalid.

---

## Suggested Build Order

1. Stripe integration — without it the tier system is cosmetic
2. Account/usage page — users can't see their plan
3. PDF export — highest-value unbuilt feature listed in Pro pricing
4. Client management dashboard — Agency differentiator
5. White-label branding — Agency differentiator
6. Polish items

---

## Key Files Reference

```
app/
  page.js                    Landing page (marketing)
  dashboard/page.js          Main dashboard (all state lives here)
  share/[id]/page.js         Public share view
  api/narrative/route.js     Claude Sonnet narrative + quota tracking
  api/recon/route.js         Claude Haiku data recon (on upload)
  api/share/route.js         Create/fetch shared dashboards
  api/tier/route.js          User tier lookup

components/
  DashboardCanvas.js         Curated canvas with add/remove + global time axis
  ColumnCard.js              Single column chart card with Compare by
  InsightBoard.js            Legacy top-8 layout (kept for reference)
  CSVUpload.js               Drag-drop upload UI
  FilterBar.js               Multi-select filter dropdowns
  NarrativePanel.js          AI narrative display
  OnboardingModal.js         3-step context wizard
  AuthModal.js               Sign in / sign up
  TierGateModal.js           Upgrade prompt modal

lib/
  csvParser.js               CSV parsing, type detection, analysis, URL augmentation (550+ lines)
  supabase.js                Supabase client with no-op stub for local dev
  tiers.js                   Tier config + canUseFeature() helper

supabase/
  schema.sql                 Full DB schema with RLS + triggers
```
