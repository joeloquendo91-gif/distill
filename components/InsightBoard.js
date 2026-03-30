"use client";
import { generateInsightSentence } from "@/lib/csvParser";
import ColumnCard from "@/components/ColumnCard";

export default function InsightBoard({
  columns,
  onTypeChange,
  groupableColumns = [],
  activeBreakdowns = {},
  onBreakdownChange,
  filteredRows = [],
}) {
  const topColumns = [...columns]
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 8);

  const anomalyColumns = columns.filter((c) => c.anomaly);

  return (
    <div>
      {/* Anomaly banner */}
      {anomalyColumns.length > 0 && (
        <div className="mb-5 px-4 py-3 bg-amber-950/30 border border-amber-700/30 rounded-xl">
          <p className="text-amber-400 text-sm font-semibold mb-1.5">
            ⚠ {anomalyColumns.length} anomal{anomalyColumns.length > 1 ? "ies" : "y"} detected
          </p>
          <ul className="space-y-1">
            {anomalyColumns.map((c) => (
              <li key={c.name} className="text-amber-300/80 text-xs leading-relaxed">
                <span className="font-medium">{c.name}:</span> {c.anomaly.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Top insight cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {topColumns.map((col) => (
          <div key={col.name} className="flex flex-col gap-2">
            {/* AI insight sentence */}
            <p className="text-sm text-gray-200 leading-relaxed px-1">
              <span className="text-green-400 font-semibold">✦</span>{" "}
              {generateInsightSentence(col)}
              {col.anomaly && (
                <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-950/50 text-amber-400 rounded text-[10px] font-medium border border-amber-700/40 align-middle">
                  ⚠ anomaly
                </span>
              )}
            </p>
            <ColumnCard
              column={col}
              onTypeChange={(newType) => onTypeChange(col.name, newType)}
              groupableColumns={groupableColumns}
              activeBreakdown={activeBreakdowns[col.name] ?? null}
              onBreakdownChange={(groupBy) => onBreakdownChange?.(col.name, groupBy)}
              filteredRows={filteredRows}
            />
          </div>
        ))}
      </div>

      {columns.length > 8 && (
        <p className="text-center text-xs text-gray-400 mt-6">
          Showing top 8 of {columns.length} columns by relevance · Switch to Explorer to see all
        </p>
      )}
    </div>
  );
}
