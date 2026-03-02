"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  parseCSVFile, detectColumnType, analyzeColumn,
  getColumnValues, applyFilters, COL_TYPES,
} from "@/lib/csvParser";
import { TIERS } from "@/lib/tiers";
import { supabase } from "@/lib/supabase";
import CSVUpload from "@/components/CSVUpload";
import ColumnCard from "@/components/ColumnCard";
import FilterBar from "@/components/FilterBar";
import NarrativePanel from "@/components/NarrativePanel";
import TierGateModal from "@/components/TierGateModal";
import AuthModal from "@/components/AuthModal";

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

  // Auth / tier
  const [user, setUser] = useState(null);
  const [userTier, setUserTier] = useState("free");
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
      else setUserTier("free");
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchTier(userId) {
    const { data } = await supabase
      .from("user_tiers")
      .select("tier")
      .eq("user_id", userId)
      .single();
    if (data?.tier) setUserTier(data.tier);
  }

  const tierConfig = TIERS[userTier] || TIERS.free;

  // Derived: filtered rows
  const filteredRows = useMemo(() => {
    if (!csvData) return [];
    return applyFilters(csvData.rows, filters);
  }, [csvData, filters]);

  // Derived: analyzed columns
  const columns = useMemo(() => {
    if (!csvData || filteredRows.length === 0) return [];
    return csvData.headers.map((header) => {
      const values = getColumnValues(filteredRows, header);
      const type = columnTypes[header] || detectColumnType(values);
      return analyzeColumn(header, values, type, filteredRows.length);
    });
  }, [csvData, filteredRows, columnTypes]);

  // Filterable columns (categorical / likert)
  const filterableColumns = useMemo(() =>
    columns.filter((c) =>
      c.type === COL_TYPES.CATEGORICAL ||
      c.type === COL_TYPES.LIKERT_TEXT ||
      (c.type === COL_TYPES.LIKERT_NUM && (c.scaleMax || 0) <= 10)
    ),
  [columns]);

  async function handleUpload(file) {
    setError(null);
    setLoading(true);
    setNarrative(null);
    setShareUrl(null);
    setFilters({});
    setCsvData(null);

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

      setColumnTypes(types);
      setCsvData(data);
      setFileName(file.name);
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
    <div className="min-h-screen bg-[#0a0a12] text-slate-100">
      {/* Nav */}
      <nav className="border-b border-white/5 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <a href="/" className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent shrink-0">
          Distill
        </a>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {csvData && (
            <>
              <button
                onClick={generateNarrative}
                disabled={narrativeLoading}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
              >
                {narrativeLoading ? (
                  <><span className="animate-spin inline-block">⟳</span> Generating…</>
                ) : (
                  <><span>✦</span> AI Narrative
                    {userTier === "free" && <span className="opacity-50 ml-1">PRO</span>}
                  </>
                )}
              </button>
              <button
                onClick={shareDashboard}
                disabled={sharing}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
              >
                {sharing ? "…" : copied ? "✓ Copied!" : "↑ Share"}
                {userTier === "free" && !copied && <span className="opacity-50">PRO</span>}
              </button>
            </>
          )}
          {user ? (
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-xs text-slate-500 hover:text-slate-300 px-2 py-2"
            >
              Sign out
            </button>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="text-xs text-slate-400 hover:text-white px-2 py-2"
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
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Get instant insights.
              </span>
            </h1>
            <p className="text-slate-500 text-center mb-10 max-w-sm">
              Every column auto-charted. No setup, no formulas.
              {!user && " Free for up to 1,000 rows."}
            </p>
            <CSVUpload onUpload={handleUpload} loading={loading} loadingMessage={loadingMsg} />
            {error && <p className="mt-4 text-red-400 text-sm text-center">{error}</p>}
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
                <p className="text-sm text-slate-500 mt-0.5">
                  {filteredRows.length.toLocaleString()} of {csvData.rowCount.toLocaleString()} rows
                  &nbsp;·&nbsp; {csvData.headers.length} columns
                  {activeFilterCount > 0 && (
                    <span className="text-indigo-400 ml-2">
                      · {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => { setCsvData(null); setNarrative(null); setShareUrl(null); setFilters({}); }}
                className="text-xs text-slate-500 hover:text-slate-300 shrink-0"
              >
                ↑ Upload new file
              </button>
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
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

            {/* Column grid */}
            {filteredRows.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                No rows match the current filters.
                <button onClick={() => setFilters({})} className="block mx-auto mt-2 text-indigo-400 text-sm hover:text-indigo-300">
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {columns.map((col) => (
                  <ColumnCard
                    key={col.name}
                    column={col}
                    onTypeChange={(newType) =>
                      setColumnTypes((prev) => ({ ...prev, [col.name]: newType }))
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Modals */}
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
