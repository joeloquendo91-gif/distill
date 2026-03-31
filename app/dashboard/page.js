"use client";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  parseCSVFile, detectColumnType, analyzeColumn,
  getColumnValues, applyFilters, COL_TYPES,
  scoreColumnRelevance, detectAnomalies, augmentWithURLDimensions,
  computeKPIs,
} from "@/lib/csvParser";
import { TIERS } from "@/lib/tiers";
import { supabase } from "@/lib/supabase";
import CSVUpload from "@/components/CSVUpload";
import ColumnCard from "@/components/ColumnCard";
import FilterBar from "@/components/FilterBar";
import NarrativePanel from "@/components/NarrativePanel";
import TierGateModal from "@/components/TierGateModal";
import AuthModal from "@/components/AuthModal";
import OnboardingModal from "@/components/OnboardingModal";
import InsightBoard from "@/components/InsightBoard";
import DashboardCanvas from "@/components/DashboardCanvas";
import DecisionBriefPanel from "@/components/DecisionBriefPanel";
import { extractSignals } from "@/lib/signalExtractor";

// Set NEXT_PUBLIC_DEV_TIER=agency in .env.local to bypass tier checks during development
const DEV_TIER = process.env.NEXT_PUBLIC_DEV_TIER;

export default function Dashboard() {
  // Data
  const [csvData, setCsvData] = useState(null);
  const [columnTypes, setColumnTypes] = useState({});
  const [filters, setFilters] = useState({});
  const [fileName, setFileName] = useState("");

  // UI
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Narrative
  const [narrative, setNarrative] = useState(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);

  // Share
  const [shareUrl, setShareUrl] = useState(null);
  const [sharing, setSharing] = useState(false);

  // Onboarding / view
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingContext, setOnboardingContext] = useState(null);
  // Holds parsed CSV data until onboarding completes so recon runs with context
  const pendingReconRef = useRef(null);

  // AI recon (lightweight Haiku call on upload, free tier)
  const [reconData, setReconData] = useState(null);
  const [reconLoading, setReconLoading] = useState(false);

  // View mode — decision brief is the default after upload
  const [activeMode, setActiveMode] = useState("decision");

  // Breakdown state — lifted so suggestion chips can pre-set any card's groupBy
  const [activeBreakdowns, setActiveBreakdowns] = useState({});

  // Derived columns extracted from URL columns (subdomain, section, depth)
  const [derivedColumns, setDerivedColumns] = useState([]);

  // Auth / tier
  const [user, setUser] = useState(null);
  const [userTier, setUserTier] = useState(DEV_TIER || "free");
  const [showTierGate, setShowTierGate] = useState(false);
  const [tierGateFeature, setTierGateFeature] = useState("");
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setUser(session.user); fetchTier(session.user.id); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchTier(session.user.id);
      else setUserTier(DEV_TIER || "free");
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchTier(userId) {
    if (DEV_TIER) return; // local override active — skip DB lookup
    const { data } = await supabase
      .from("user_tiers")
      .select("tier")
      .eq("user_id", userId)
      .single();
    if (data?.tier) setUserTier(data.tier);
  }

  const tierConfig = TIERS[userTier] || TIERS.free;

  // Recon: run once after upload, non-blocking, graceful failure
  async function runRecon(headers, rows, types, context = null) {
    setReconLoading(true);
    try {
      // Spread sample indices across the full dataset so date ranges and
      // value distributions are representative, not just the first rows.
      const sampleIndices = Array.from({ length: 20 }, (_, i) =>
        Math.min(Math.floor((i / 19) * (rows.length - 1)), rows.length - 1)
      );
      const columnInput = headers.map((h) => ({
        name: h,
        type: types[h],
        uniqueCount: new Set(
          rows.map((r) => String(r[h] ?? "").trim()).filter(Boolean)
        ).size,
        samples: sampleIndices
          .map((i) => String(rows[i][h] ?? "").trim())
          .filter((s) => s && s.toLowerCase() !== "n/a" && s !== "-")
          .slice(0, 5),
      }));
      const res = await fetch("/api/recon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: columnInput, rowCount: rows.length, userContext: context }),
      });
      if (res.ok) {
        const data = await res.json();
        if (!data.error) setReconData(data);
      }
    } catch {
      // Recon failure is non-critical — dashboard works fine without it
    } finally {
      setReconLoading(false);
    }
  }

  // Derived: filtered rows
  const filteredRows = useMemo(() => {
    if (!csvData) return [];
    return applyFilters(csvData.rows, filters);
  }, [csvData, filters]);

  // Derived: analyzed columns (with relevance scores and anomaly flags)
  const columns = useMemo(() => {
    if (!csvData || filteredRows.length === 0) return [];
    return csvData.headers.map((header) => {
      const values = getColumnValues(filteredRows, header);
      const type = columnTypes[header] || detectColumnType(values);
      const col = analyzeColumn(header, values, type, filteredRows.length);
      return {
        ...col,
        relevanceScore: scoreColumnRelevance(col, onboardingContext),
        anomaly: detectAnomalies(col),
      };
    });
  }, [csvData, filteredRows, columnTypes, onboardingContext]);

  // Business KPIs — computed from recon dataProfile against live filtered rows
  const kpis = useMemo(
    () => (reconData?.dataProfile ? computeKPIs(filteredRows, reconData.dataProfile) : null),
    [filteredRows, reconData]
  );

  // Decision Brief — deterministic signal extraction over the full dataset.
  // Uses csvData.rows (not filteredRows) so filters don't collapse the brief.
  const liveBrief = useMemo(
    () =>
      csvData && reconData?.dataProfile
        ? extractSignals(csvData.rows, reconData.dataProfile)
        : null,
    [csvData, reconData]
  );

  // Filterable columns (categorical / likert)
  // Sub-year time columns (Month, Quarter) are excluded from filters — filtering by
  // "Q1" without a year context mixes data across all years and is misleading.
  const SUB_YEAR_PATTERN = /\b(month|quarter|week|day)\b/i;
  const filterableColumns = useMemo(() =>
    columns.filter((c) => {
      if (SUB_YEAR_PATTERN.test(c.name)) return false;
      return (
        c.type === COL_TYPES.CATEGORICAL ||
        c.type === COL_TYPES.LIKERT_TEXT
      );
    }),
  [columns]);

  // Groupable columns for the "Compare by" feature — categorical, date, and URL-derived dimensions.
  // Year-like categoricals (all values are 4-digit years) are promoted to DATE so they appear in
  // the "View over time" selector and sort chronologically in breakdown charts.
  const groupableColumns = useMemo(() => {
    const base = columns
      .filter((c) => c.type === COL_TYPES.CATEGORICAL || c.type === COL_TYPES.DATE)
      .map((c) => {
        const isYearLike =
          c.type === COL_TYPES.CATEGORICAL &&
          c.chartData?.length > 0 &&
          c.chartData.filter((d) => d.label !== "Other").every((d) =>
            /^\d{4}$/.test(String(d.fullLabel || d.label).trim())
          );
        return { name: c.name, type: isYearLike ? COL_TYPES.DATE : c.type };
      });
    return [...base, ...derivedColumns];
  }, [columns, derivedColumns]);

  async function handleUpload(file) {
    setError(null);
    setLoading(true);
    setNarrative(null);
    setShareUrl(null);
    setFilters({});
    setCsvData(null);
    setReconData(null);
    setActiveBreakdowns({});
    setDerivedColumns([]);
    setActiveMode("decision");

    try {
      setLoadingMsg("Parsing CSV…");
      const data = await parseCSVFile(file);

      if (data.rowCount > tierConfig.rowLimit) {
        setLoading(false);
        setTierGateFeature(`datasets over ${tierConfig.rowLimit.toLocaleString()} rows`);
        setShowTierGate(true);
        return;
      }

      setLoadingMsg("Detecting column types…");
      const types = {};
      data.headers.forEach((h) => {
        types[h] = detectColumnType(getColumnValues(data.rows, h));
      });

      // Augment rows with URL-derived dimensions (subdomain, section, depth)
      const derived = augmentWithURLDimensions(data.rows, data.headers);
      setDerivedColumns(derived);

      setColumnTypes(types);
      setCsvData(data);
      setFileName(file.name);
      setOnboardingContext(null);
      // Store parsed data — recon fires after onboarding so context is available
      pendingReconRef.current = { headers: data.headers, rows: data.rows, types };
      setShowOnboarding(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  }

  const updateFilter = useCallback((colName, values) => {
    setFilters((prev) => {
      if (!values || values.length === 0) {
        const next = { ...prev };
        delete next[colName];
        return next;
      }
      return { ...prev, [colName]: values };
    });
  }, []);

  async function generateNarrative() {
    if (!user) { setShowAuth(true); return; }
    if (userTier === "free") { setTierGateFeature("AI Narrative"); setShowTierGate(true); return; }

    setNarrativeLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const columnSummaries = columns.map((c) => ({
        name: c.name,
        type: c.type,
        count: c.totalCount,
        missing: c.emptyCount,
        stats: c.stats || null,
        avg: c.avg ?? null,
        uniqueValues: c.uniqueCount || null,
        topValues: c.chartData?.slice(0, 5).map((d) => `${d.label}: ${d.count}`) || [],
      }));

      const res = await fetch("/api/narrative", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          fileName,
          rowCount: filteredRows.length,
          totalRows: csvData.rowCount,
          columnSummaries,
          onboardingContext,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setNarrative(data.narrative);
    } catch (err) {
      setError("Narrative generation failed: " + err.message);
    } finally {
      setNarrativeLoading(false);
    }
  }

  async function shareDashboard() {
    if (!user) { setShowAuth(true); return; }
    if (userTier === "free") { setTierGateFeature("shareable dashboards"); setShowTierGate(true); return; }

    setSharing(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const safeColumns = columns.map(({ sampleResponses: _r, ...col }) => col);

      const res = await fetch("/api/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: fileName.replace(/\.(csv|tsv|txt)$/i, ""),
          columns: safeColumns,
          rowCount: filteredRows.length,
          totalRows: csvData.rowCount,
          narrative,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const url = `${window.location.origin}/share/${data.id}`;
      setShareUrl(url);
      navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      setError("Share failed: " + err.message);
    } finally {
      setSharing(false);
    }
  }

  const activeFilterCount = Object.keys(filters).length;

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between gap-3 sticky top-0 z-10">
        <a href="/" className="text-lg font-bold text-gray-900 shrink-0">
          Distill
        </a>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {csvData && (
            <>
              <button
                onClick={generateNarrative}
                disabled={narrativeLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full text-xs font-medium transition-colors disabled:opacity-50"
              >
                {narrativeLoading ? (
                  <><span className="animate-spin inline-block">⟳</span> Generating…</>
                ) : (
                  <><span>✦</span> AI Narrative
                    {userTier === "free" && <span className="opacity-60 ml-1">PRO</span>}
                  </>
                )}
              </button>
              <button
                onClick={shareDashboard}
                disabled={sharing}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 border border-gray-200 hover:border-gray-300 text-gray-600 rounded-full text-xs font-medium transition-colors disabled:opacity-50"
              >
                {sharing ? "…" : copied ? "✓ Copied!" : "↑ Share"}
                {userTier === "free" && !copied && <span className="opacity-50 ml-1">PRO</span>}
              </button>
            </>
          )}
          {user ? (
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-2"
            >
              Sign out
            </button>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="text-xs text-gray-400 hover:text-gray-700 px-2 py-2"
            >
              Sign in
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {!csvData ? (
          /* Upload view */
          <div className="flex flex-col items-center justify-center min-h-[65vh]">
            <h1 className="text-3xl sm:text-4xl font-bold text-center mb-3 text-gray-900">
              Drop in your CSV.
              <br />
              <span className="text-green-400">
                Get instant insights.
              </span>
            </h1>
            <p className="text-gray-500 text-center mb-10 max-w-sm">
              Every column auto-charted. No setup, no formulas.
              {!user && " Free for up to 1,000 rows."}
            </p>
            <CSVUpload onUpload={handleUpload} loading={loading} loadingMessage={loadingMsg} />
            {error && <p className="mt-4 text-red-500 text-sm text-center">{error}</p>}
          </div>
        ) : (
          /* Explore view */
          <>
            {/* Dashboard header */}
            <div className="mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  {fileName.replace(/\.(csv|tsv|txt)$/i, "")}
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {filteredRows.length.toLocaleString()} of {csvData.rowCount.toLocaleString()} rows
                  &nbsp;·&nbsp; {csvData.headers.length} columns
                  {activeFilterCount > 0 && (
                    <span className="text-green-600 ml-2">
                      · {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
                    </span>
                  )}
                  {columns.some((c) => c.anomaly) && (
                    <span className="text-amber-600 ml-2">
                      · ⚠ {columns.filter((c) => c.anomaly).length} anomal{columns.filter((c) => c.anomaly).length > 1 ? "ies" : "y"}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => { setCsvData(null); setNarrative(null); setShareUrl(null); setFilters({}); setOnboardingContext(null); setReconData(null); setActiveBreakdowns({}); setDerivedColumns([]); }}
                  className="text-xs text-gray-400 hover:text-gray-700"
                >
                  ↑ Upload new file
                </button>
              </div>
            </div>

            {/* KPI tiles — business metrics when recon has a data profile, else technical stats */}
            {columns.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {kpis ? (() => {
                  function fmtKpi(n) {
                    if (n == null) return "—";
                    if (n >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
                    if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
                    if (n >= 1000) return "$" + (n / 1000).toFixed(1) + "K";
                    return n.toLocaleString();
                  }
                  const tiles = [
                    {
                      label: `Total ${kpis.metric}`,
                      value: fmtKpi(kpis.total),
                    },
                    kpis.yoy
                      ? {
                          label: `${kpis.yoy.year} vs prior year`,
                          value: (kpis.yoy.positive ? "+" : "") + kpis.yoy.pct + "%",
                          positive: kpis.yoy.positive,
                          delta: true,
                        }
                      : { label: "Rows analyzed", value: filteredRows.length.toLocaleString() },
                    kpis.topEntity
                      ? {
                          label: `Top ${kpis.topEntity.dim}`,
                          value: kpis.topEntity.name.split(" ")[0],
                          sub: fmtKpi(kpis.topEntity.value),
                        }
                      : { label: "Columns", value: csvData.headers.length },
                    columns.filter((c) => c.anomaly).length > 0
                      ? { label: "Anomalies found", value: columns.filter((c) => c.anomaly).length, warn: true }
                      : { label: "Data quality", value: "Clean", clean: true },
                  ];
                  return tiles.map((s) => (
                    <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4">
                      <div className={`text-2xl font-bold tracking-tight truncate ${s.warn ? "text-amber-600" : s.clean ? "text-green-600" : s.delta ? (s.positive ? "text-green-600" : "text-red-500") : "text-gray-900"}`}>
                        {s.value}
                      </div>
                      {s.sub && <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>}
                      <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                    </div>
                  ));
                })() : [
                  { label: "Rows analyzed", value: filteredRows.length.toLocaleString() },
                  { label: "Columns", value: csvData.headers.length },
                  { label: "Avg completeness", value: `${Math.round(columns.reduce((s, c) => s + (c.totalCount / (c.totalRows || 1)), 0) / columns.length * 100)}%` },
                  ...(columns.filter((c) => c.anomaly).length > 0
                    ? [{ label: "Anomalies found", value: columns.filter((c) => c.anomaly).length, warn: true }]
                    : [{ label: "Data quality", value: "Clean", clean: true }]
                  ),
                ].map((s) => (
                  <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4">
                    <div className={`text-2xl font-bold tracking-tight ${s.warn ? "text-amber-600" : s.clean ? "text-green-600" : "text-gray-900"}`}>
                      {s.value}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* Narrative panel */}
            {narrative && (
              <NarrativePanel narrative={narrative} onClose={() => setNarrative(null)} />
            )}

            {/* Loading skeleton — shown while recon is running */}
            {reconLoading ? (
              <div>
                <div className="w-full h-0.5 bg-gray-100 rounded-full overflow-hidden mb-6">
                  <div className="h-full bg-green-400 rounded-full animate-[recon-progress_3.5s_ease-out_forwards]" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {[
                    { label: "Analysing growth trends…" },
                    { label: "Identifying top performers…" },
                    { label: "Mapping geographic distribution…" },
                    { label: "Detecting concentration risk…" },
                  ].map(({ label }) => (
                    <div key={label} className="bg-white border border-gray-100 rounded-2xl p-5">
                      <div className="mb-4 space-y-2">
                        <div className="h-2.5 bg-gray-100 rounded-full animate-pulse" style={{ width: "35%" }} />
                        <div className="h-4 bg-gray-100 rounded-full animate-pulse" style={{ width: "60%" }} />
                      </div>
                      <div className="flex items-end gap-2 h-[120px] px-2">
                        {[0.45, 0.8, 0.6, 0.95, 0.7, 0.5].map((h, i) => (
                          <div key={i} className="flex-1 bg-gray-100 rounded-t animate-pulse"
                            style={{ height: `${h * 100}%`, animationDelay: `${i * 80}ms` }} />
                        ))}
                      </div>
                      <p className="text-[10px] text-green-500 mt-3 animate-pulse">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* Mode tabs */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
                  <button
                    onClick={() => setActiveMode("decision")}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      activeMode === "decision"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    ✦ Decision Brief
                  </button>
                  <button
                    onClick={() => setActiveMode("dashboard")}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      activeMode === "dashboard"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Dashboard
                  </button>
                </div>

                {activeMode === "decision" ? (
                  <DecisionBriefPanel
                    brief={liveBrief}
                    dataProfile={reconData?.dataProfile ?? null}
                    dataContext={reconData?.dataContext ?? null}
                  />
                ) : (
                  <>
                    {/* AI recon context banner — dashboard mode only */}
                    {reconData && (
                      <div className="mb-4 px-4 py-3 bg-green-50 border border-green-100 rounded-xl">
                        <p className="text-sm text-green-800">
                          <span className="font-semibold text-green-600">✦</span>{" "}
                          {reconData.dataContext}
                        </p>
                        {reconData.dataProfile && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                            {reconData.dataProfile.grain && (
                              <span className="text-[11px] text-green-700">
                                <span className="text-green-500 font-medium">Each row:</span> {reconData.dataProfile.grain}
                              </span>
                            )}
                            {reconData.dataProfile.primaryMetric && (
                              <span className="text-[11px] text-green-700">
                                <span className="text-green-500 font-medium">Primary metric:</span> {reconData.dataProfile.primaryMetric}
                              </span>
                            )}
                            {(() => {
                              const d = reconData.dataProfile.dimensions;
                              const allDims = [...(d?.who ?? []), ...(d?.where ?? []), ...(d?.when ?? []), ...(d?.what ?? [])].filter(Boolean);
                              return allDims.length > 0 ? (
                                <span className="text-[11px] text-green-700">
                                  <span className="text-green-500 font-medium">Dimensions:</span> {allDims.join(", ")}
                                </span>
                              ) : null;
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Filter bar — dashboard mode only */}
                    {filterableColumns.length > 0 && (
                      <FilterBar
                        columns={filterableColumns}
                        filters={filters}
                        onFilterChange={updateFilter}
                        onClear={() => setFilters({})}
                      />
                    )}

                    {filteredRows.length === 0 ? (
                      <div className="text-center py-20 text-gray-500">
                        No rows match the current filters.
                        <button onClick={() => setFilters({})} className="block mx-auto mt-2 text-green-600 text-sm hover:text-green-700">
                          Clear filters
                        </button>
                      </div>
                    ) : (
                      <DashboardCanvas
                        key={fileName}
                        columns={columns}
                        filteredRows={filteredRows}
                        groupableColumns={groupableColumns}
                        activeBreakdowns={activeBreakdowns}
                        onBreakdownChange={(colName, groupBy) =>
                          setActiveBreakdowns((prev) => ({ ...prev, [colName]: groupBy ?? undefined }))
                        }
                        onTypeChange={(name, newType) =>
                          setColumnTypes((prev) => ({ ...prev, [name]: newType }))
                        }
                        anomalyColumns={columns.filter((c) => c.anomaly)}
                        chartRecipes={reconData?.chartRecipes ?? []}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {showOnboarding && (
        <OnboardingModal
          onComplete={(ctx) => {
            setOnboardingContext(ctx);
            setShowOnboarding(false);
            const p = pendingReconRef.current;
            if (p) { runRecon(p.headers, p.rows, p.types, ctx); pendingReconRef.current = null; }
          }}
          onSkip={() => {
            setShowOnboarding(false);
            const p = pendingReconRef.current;
            if (p) { runRecon(p.headers, p.rows, p.types, null); pendingReconRef.current = null; }
          }}
        />
      )}
      {showTierGate && (
        <TierGateModal
          feature={tierGateFeature}
          currentTier={userTier}
          onClose={() => setShowTierGate(false)}
          onSignIn={!user ? () => { setShowTierGate(false); setShowAuth(true); } : undefined}
        />
      )}
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={(u) => { setUser(u); setShowAuth(false); fetchTier(u.id); }}
        />
      )}
    </div>
  );
}
