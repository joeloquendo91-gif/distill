"use client";
import { useState } from "react";
import { COL_TYPES, generateInsightSentence } from "@/lib/csvParser";
import ColumnCard from "@/components/ColumnCard";

const TYPE_LABELS = {
  [COL_TYPES.CATEGORICAL]:  "Categorical",
  [COL_TYPES.NUMERIC]:      "Numeric",
  [COL_TYPES.DATE]:         "Date",
  [COL_TYPES.LIKERT_NUM]:   "Likert (scale)",
  [COL_TYPES.LIKERT_TEXT]:  "Likert (text)",
  [COL_TYPES.TEXT]:         "Free text",
  [COL_TYPES.MULTI_SELECT]: "Multi-select",
};

const NUMERIC_TYPES = new Set([COL_TYPES.NUMERIC, COL_TYPES.LIKERT_NUM]);

export default function DashboardCanvas({
  columns,
  filteredRows,
  groupableColumns,
  activeBreakdowns,
  onBreakdownChange,
  onTypeChange,
  anomalyColumns = [],
}) {
  // Initialise to top 4 chartable columns by relevance score.
  // The parent passes key={fileName} so this resets on every new file upload.
  const [visibleColNames, setVisibleColNames] = useState(() =>
    columns
      .filter((c) => c.type !== COL_TYPES.TEXT && c.chartData?.length > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 4)
      .map((c) => c.name)
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [globalTimeAxis, setGlobalTimeAxis] = useState(null);

  const dateColumns = groupableColumns.filter((c) => c.type === COL_TYPES.DATE);
  const categoricalGroupables = groupableColumns.filter((c) => c.type === COL_TYPES.CATEGORICAL);

  // Columns currently on the canvas (preserve order)
  const visibleColumns = visibleColNames
    .map((n) => columns.find((c) => c.name === n))
    .filter(Boolean);

  // Columns available to add (not on canvas, not free-text)
  const hiddenColumns = columns.filter(
    (c) => !visibleColNames.includes(c.name) && c.type !== COL_TYPES.TEXT
  );

  function removeChart(colName) {
    setVisibleColNames((prev) => prev.filter((n) => n !== colName));
  }

  function addChart(colName) {
    setVisibleColNames((prev) => [...prev, colName]);
    setPickerOpen(false);
  }

  // Global time axis applies to numeric/likert columns that don't have an explicit per-card breakdown
  function effectiveBreakdown(col) {
    const explicit = activeBreakdowns[col.name];
    if (explicit) return explicit;
    if (globalTimeAxis && NUMERIC_TYPES.has(col.type)) return globalTimeAxis;
    return null;
  }

  // When globalTimeAxis is active, numeric cards only show categorical "Compare by" options
  // (time is already handled globally). User can still override per-card if needed.
  function effectiveGroupableColumns(col) {
    if (globalTimeAxis && NUMERIC_TYPES.has(col.type)) {
      // Show categorical options for additional slicing, plus date options so the user can override
      return groupableColumns;
    }
    return groupableColumns;
  }

  return (
    <div>
      {/* Canvas toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Global time axis */}
        {dateColumns.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 shrink-0">View over time:</span>
            <select
              value={globalTimeAxis || ""}
              onChange={(e) => setGlobalTimeAxis(e.target.value || null)}
              className="text-xs text-gray-700 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer hover:border-gray-300 transition-colors"
            >
              <option value="">— off —</option>
              {dateColumns.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
            {globalTimeAxis && (
              <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-medium">
                active
              </span>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {visibleColNames.length === 0 && (
            <span className="text-xs text-gray-400">No charts — add one below</span>
          )}
          {hiddenColumns.length > 0 && (
            <button
              onClick={() => setPickerOpen((o) => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-900 rounded-lg text-xs font-medium transition-colors"
            >
              {pickerOpen ? "✕ Close" : "+ Add chart"}
            </button>
          )}
        </div>
      </div>

      {/* Column picker */}
      {pickerOpen && hiddenColumns.length > 0 && (
        <div className="mb-5 p-4 bg-white border border-gray-200 rounded-xl">
          <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider">Add a chart</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {hiddenColumns.map((col) => (
              <button
                key={col.name}
                onClick={() => addChart(col.name)}
                className="text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors group"
              >
                <span className="text-sm font-medium text-gray-900 truncate block leading-tight">
                  {col.name}
                </span>
                <span className="text-[10px] text-gray-400 group-hover:text-indigo-500 mt-0.5 block">
                  {TYPE_LABELS[col.type] || col.type}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Anomaly banner */}
      {anomalyColumns.length > 0 && (
        <div className="mb-5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-amber-800 text-sm font-semibold mb-1.5">
            ⚠ {anomalyColumns.length} anomal{anomalyColumns.length > 1 ? "ies" : "y"} detected
          </p>
          <ul className="space-y-1">
            {anomalyColumns.map((c) => (
              <li key={c.name} className="text-amber-700 text-xs leading-relaxed">
                <span className="font-medium">{c.name}:</span> {c.anomaly.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Chart grid — 2 columns for wider, more readable charts */}
      {visibleColumns.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {visibleColumns.map((col) => (
            <div key={col.name} className="relative group">
              {/* AI insight sentence */}
              <p className="text-xs text-gray-500 leading-relaxed px-1 mb-1.5">
                <span className="text-green-500 font-semibold">✦</span>{" "}
                {generateInsightSentence(col)}
                {col.anomaly && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium border border-amber-200 align-middle">
                    ⚠ anomaly
                  </span>
                )}
              </p>

              {/* Remove button */}
              <button
                onClick={() => removeChart(col.name)}
                title="Remove chart"
                className="absolute top-6 right-1 z-10 w-5 h-5 flex items-center justify-center rounded-full text-gray-300 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all text-xs"
              >
                ✕
              </button>

              <ColumnCard
                column={col}
                onTypeChange={(newType) => onTypeChange(col.name, newType)}
                groupableColumns={effectiveGroupableColumns(col)}
                activeBreakdown={effectiveBreakdown(col)}
                onBreakdownChange={(groupBy) => onBreakdownChange?.(col.name, groupBy)}
                filteredRows={filteredRows}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400 text-sm">
          No charts on the canvas.{" "}
          <button
            onClick={() => setPickerOpen(true)}
            className="text-green-600 hover:text-green-700"
          >
            Add a chart →
          </button>
        </div>
      )}

      {columns.length > visibleColNames.length && hiddenColumns.length > 0 && (
        <p className="text-center text-xs text-gray-400 mt-6">
          {hiddenColumns.length} more column{hiddenColumns.length > 1 ? "s" : ""} available · use "+ Add chart" to explore
        </p>
      )}
    </div>
  );
}
