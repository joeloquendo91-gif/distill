"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  parseCSVFile, detectColumnType, analyzeColumn,
  getColumnValues, applyFilters, COL_TYPES,
  scoreColumnRelevance, detectAnomalies, augmentWithURLDimensions,
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
  const [viewMode, setViewMode] = useState("insight"); // "insight" | "explorer"

  // AI recon (lightweight Haiku call on upload, free tier)
  const [reconData, setReconData] = useState(null);
  const [reconLoading, setReconLoading] = useState(false);

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
  async function runRecon(headers, rows, types) {
    setReconLoading(true);
    try {
      const columnInput = headers.map((h) => ({
        name: h,
        type: types[h],
        samples: rows
          .slice(0, 20)
          .map((r) => String(r[h] ?? "").trim())
          .filter((s) => s && s.toLowerCase() !== "n/a" && s !== "-")
          .slice(0, 5),
      }));
      const res = await fetch("/api/recon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: columnInput, rowCount: rows.length }),
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

  // Build a lookup from recon data for fast per-column access
  const reconColMap = useMemo(() => {
    if (!reconData?.columns) return {};
    return Object.fromEntries(reconData.columns.map((c) => [c.name, c]));
  }, [reconData]);

  // Derived: analyzed columns (with relevance scores, anomaly flags, recon context)
  const columns = useMemo(() => {
    if (!csvData || filteredRows.length === 0) return [];
    return csvData.headers.map((header) => {
      const values = getColumnValues(filteredRows, header);
      const type = columnTypes[header] || detectColumnType(values);
      const col = analyzeColumn(header, values, type, filteredRows.length);
      const baseScore = scoreColumnRelevance(col, onboardingContext);
      const reconEntry = reconColMap[header];
      return {
        ...col,
        relevanceScore: Math.min(1, baseScore + (reconEntry?.isKPI ? 0.2 : 0)),
        anomaly: detectAnomalies(col),
        reconDescription: reconEntry?.description ?? null,
      };
    });
  }, [csvData, filteredRows, columnTypes, onboardingContext, reconColMap]);

  // Filterable columns (categorical / likert)
  const filterableColumns = useMemo(() =>
    columns.filter((c) =>
      c.type === COL_TYPES.CATEGORICAL ||
      c.type === COL_TYPES.LIKERT_TEXT ||
      (c.type === COL_TYPES.LIKERT_NUM && (c.scaleMax || 0) <= 10)
    ),
  [columns]);

  // Groupable columns for the "Compare by" feature — categorical, date, and URL-derived dimensions
  const groupableColumns = useMemo(() => {
    const base = columns
      .filter((c) => c.type === COL_TYPES.CATEGORICAL || c.type === COL_TYPES.DATE)
      .map((c) => ({ name: c.name, type: c.type }));
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
      setViewMode("insight");
      setShowOnboarding(true);
      runRecon(data.headers, data.rows, types);
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
    <div className="min-h-screen bg-[#0a0a12] text-gray-100">
      {/* Nav */}
      <nav className="bg-[#0f0f1a]/90 border-b border-white/8 px-4 sm:px-6 py-4 flex items-center justify-between gap-3 sticky top-0 z-10 backdrop-blur-sm">
        <a href="/" className="text-lg font-bold text-white shrink-0">
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
                className="flex items-center gap-1.5 px-4 py-2 bg-white/8 border border-white/12 hover:border-white/20 text-gray-300 rounded-full text-xs font-medium transition-colors disabled:opacity-50"
              >
                {sharing ? "…" : copied ? "✓ Copied!" : "↑ Share"}
                {userTier === "free" && !copied && <span className="opacity-50 ml-1">PRO</span>}
              </button>
            </>
          )}
          {user ? (
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-xs text-gray-500 hover:text-gray-300 px-2 py-2"
            >
              Sign out
            </button>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="text-xs text-gray-500 hover:text-gray-200 px-2 py-2"
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
            <h1 className="text-3xl sm:text-4xl font-bold text-center mb-3 text-white">
              Drop in your CSV.
              <br />
              <span className="text-green-400">
                Get instant insights.
              </span>
            </h1>
            <p className="text-gray-400 text-center mb-10 max-w-sm">
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
                <h1 className="text-lg font-semibold text-white">
                  {fileName.replace(/\.(csv|tsv|txt)$/i, "")}
                </h1>
                <p className="text-sm text-gray-400 mt-0.5">
                  {filteredRows.length.toLocaleString()} of {csvData.rowCount.toLocaleString()} rows
                  &nbsp;·&nbsp; {csvData.headers.length} columns
                  {activeFilterCount > 0 && (
                    <span className="text-green-400 ml-2">
                      · {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
                    </span>
                  )}
                  {columns.some((c) => c.anomaly) && (
                    <span className="text-amber-400 ml-2">
                      · ⚠ {columns.filter((c) => c.anomaly).length} anomal{columns.filter((c) => c.anomaly).length > 1 ? "ies" : "y"}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {/* View toggle */}
                <div className="flex items-center gap-1 bg-white/8 rounded-full p-1">
                  <button
                    onClick={() => setViewMode("insight")}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      viewMode === "insight"
                        ? "bg-white/15 text-white shadow-sm"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => setViewMode("explorer")}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      viewMode === "explorer"
                        ? "bg-white/15 text-white shadow-sm"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    All Columns
                  </button>
                </div>
                <button
                  onClick={() => { setCsvData(null); setNarrative(null); setShareUrl(null); setFilters({}); setOnboardingContext(null); setReconData(null); setActiveBreakdowns({}); setDerivedColumns([]); }}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  ↑ Upload new file
                </button>
              </div>
            </div>

            {/* Stats bar */}
            {columns.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: "Rows analyzed", value: filteredRows.length.toLocaleString() },
                  { label: "Columns", value: csvData.headers.length },
                  { label: "Avg completeness", value: `${Math.round(columns.reduce((s, c) => s + (c.totalCount / (c.totalRows || 1)), 0) / columns.length * 100)}%` },
                  ...(columns.filter((c) => c.anomaly).length > 0
                    ? [{ label: "Anomalies found", value: columns.filter((c) => c.anomaly).length, warn: true }]
                    : [{ label: "Data quality", value: "Clean", clean: true }]
                  ),
                ].map((s) => (
                  <div key={s.label} className="bg-[#16162a] border border-white/8 rounded-xl p-4">
                    <div className={`text-2xl font-bold tracking-tight ${s.warn ? "text-amber-400" : s.clean ? "text-green-400" : "text-white"}`}>
                      {s.value}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="mb-4 px-4 py-3 bg-red-950/40 border border-red-800/50 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Filter bar */}
            {filterableColumns.length > 0 && (
              <FilterBar
                columns={filterableColumns}
                filters={filters}
                onFilterChange={updateFilter}
                onClear={() => setFilters({})}
              />
            )}

            {/* Narrative panel */}
            {narrative && (
              <NarrativePanel narrative={narrative} onClose={() => setNarrative(null)} />
            )}

            {/* AI recon context banner */}
            {(reconLoading || reconData) && (
              <div className="mb-4 px-4 py-3 bg-green-50 border border-green-100 rounded-xl">
                {reconLoading ? (
                  <p className="text-sm text-green-600 animate-pulse">✦ Reading your data…</p>
                ) : (
                  <>
                    <p className="text-sm text-green-800">
                      <span className="font-semibold text-green-600">✦</span>{" "}
                      {reconData.dataContext}
                    </p>
                    {reconData.suggestedComparisons?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 items-center">
                        <span className="text-[11px] text-green-600">Try:</span>
                        {reconData.suggestedComparisons.map((s) => (
                          <button
                            key={s.label}
                            onClick={() =>
                              setActiveBreakdowns((prev) => ({ ...prev, [s.metric]: s.groupBy }))
                            }
                            className="text-[11px] px-2.5 py-1 bg-white border border-green-200 text-green-700 rounded-full hover:bg-green-50 transition-colors"
                          >
                            {s.label} →
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Column grid */}
            {filteredRows.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                No rows match the current filters.
                <button onClick={() => setFilters({})} className="block mx-auto mt-2 text-green-400 text-sm hover:text-green-300">
                  Clear filters
                </button>
              </div>
            ) : viewMode === "insight" ? (
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
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {columns.map((col) => (
                  <ColumnCard
                    key={col.name}
                    column={col}
                    onTypeChange={(newType) =>
                      setColumnTypes((prev) => ({ ...prev, [col.name]: newType }))
                    }
                    groupableColumns={groupableColumns}
                    activeBreakdown={activeBreakdowns[col.name] ?? null}
                    onBreakdownChange={(groupBy) =>
                      setActiveBreakdowns((prev) => ({ ...prev, [col.name]: groupBy ?? undefined }))
                    }
                    filteredRows={filteredRows}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {showOnboarding && (
        <OnboardingModal
          onComplete={(ctx) => { setOnboardingContext(ctx); setShowOnboarding(false); }}
          onSkip={() => setShowOnboarding(false)}
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
