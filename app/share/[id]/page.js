import ColumnCard from "@/components/ColumnCard";
import NarrativePanel from "@/components/NarrativePanel";

async function getDashboard(id) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/share?id=${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function SharePage({ params }) {
  const { id } = await params;
  const dashboard = await getDashboard(id);

  if (!dashboard) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center text-slate-400">
        <div className="text-center">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-lg font-medium text-white mb-2">Dashboard not found</p>
          <p className="text-sm mb-6">This link may have expired or been removed.</p>
          <a href="/" className="text-indigo-400 hover:text-indigo-300 text-sm">
            ← Go to Distill
          </a>
        </div>
      </div>
    );
  }

  const { title, summary_json, narrative, view_count, created_at } = dashboard;
  const { columns = [], rowCount, totalRows } = summary_json || {};
  const createdDate = new Date(created_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#0a0a12] text-slate-100">
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <a href="/" className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
          Distill
        </a>
        <span className="text-xs text-slate-500">Shared dashboard</span>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">{title}</h1>
          <p className="text-sm text-slate-500">
            {rowCount?.toLocaleString()} rows
            {totalRows && rowCount !== totalRows && ` of ${totalRows.toLocaleString()}`}
            &nbsp;·&nbsp; {columns.length} columns
            &nbsp;·&nbsp; Shared {createdDate}
            {view_count > 1 && <span> · {view_count.toLocaleString()} views</span>}
          </p>
        </div>

        {/* Narrative */}
        {narrative && (
          <NarrativePanel narrative={narrative} onClose={null} />
        )}

        {/* Column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {columns.map((col) => (
            <ColumnCard key={col.name} column={col} />
          ))}
        </div>

        {columns.length === 0 && (
          <div className="text-center py-20 text-slate-500">No data in this dashboard.</div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-white/5 text-center">
          <p className="text-xs text-slate-600">
            Made with{" "}
            <a href="/" className="text-indigo-400 hover:text-indigo-300">Distill</a>
            {" "}— Turn any CSV into insights in seconds.
          </p>
        </div>
      </main>
    </div>
  );
}
