// Inbox Signal Dashboard — Recruiting OS
// Run this as a Claude artifact in Claude.ai (requires Gmail MCP connector enabled)
// See plans/phase-5-inbox-dashboard.md for setup instructions

// TODO: This is the placeholder. The actual dashboard artifact lives in Claude.ai.
// To use:
// 1. Open claude.ai → new chat
// 2. Paste this file's contents and say: "Run this React component as an artifact"
// 3. Or add this file to your Claude "Recruiting OS" project

import { useState, useCallback } from "react";

const STATUS_COLORS = {
  REPLY:      { bg: "bg-green-100",  text: "text-green-800",  label: "Reply" },
  INTERVIEW:  { bg: "bg-blue-100",   text: "text-blue-800",   label: "Interview" },
  OFFER:      { bg: "bg-purple-100", text: "text-purple-800", label: "Offer" },
  REJECTED:   { bg: "bg-red-100",    text: "text-red-800",    label: "Rejected" },
  WAITING:    { bg: "bg-yellow-100", text: "text-yellow-800", label: "Waiting" },
  GHOSTED:    { bg: "bg-gray-100",   text: "text-gray-600",   label: "Ghosted" },
  FOLLOW_UP:  { bg: "bg-orange-100", text: "text-orange-800", label: "Follow Up" },
};

const URGENCY_COLORS = {
  HIGH: "text-red-600 font-semibold",
  MED:  "text-yellow-600",
  LOW:  "text-gray-400",
};

export default function InboxSignalDashboard() {
  const [threads, setThreads]         = useState([]);
  const [loading, setLoading]         = useState(false);
  const [filter, setFilter]           = useState("ALL");
  const [search, setSearch]           = useState("");
  const [expanded, setExpanded]       = useState(null);
  const [lastScanned, setLastScanned] = useState(null);

  const scanInbox = useCallback(async () => {
    setLoading(true);
    // In Claude.ai artifact mode, this triggers Claude to:
    // 1. Read Gmail via MCP (last 45 days, recruiting-related threads)
    // 2. Classify each thread using the prompts in prompts/email-classification.md
    // 3. Extract structured data using prompts/email-extraction.md
    // 4. Return JSON array of thread objects
    // The actual API call is handled by Claude's artifact runtime.
    // Placeholder: replace with real MCP call in Claude.ai environment.
    setLastScanned(new Date().toLocaleTimeString());
    setLoading(false);
  }, []);

  const filtered = threads.filter(t => {
    const matchesFilter = filter === "ALL" || t.status === filter;
    const q = search.toLowerCase();
    const matchesSearch = !q || [t.company, t.contact, t.role].some(f => f?.toLowerCase().includes(q));
    return matchesFilter && matchesSearch;
  });

  const signalScore = threads.length
    ? Math.round((threads.filter(t => ["REPLY","INTERVIEW","OFFER"].includes(t.status)).length / threads.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      {/* Header */}
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inbox Signal</h1>
            <p className="text-sm text-gray-500">
              {lastScanned ? `Last scanned: ${lastScanned}` : "Not scanned yet"}
            </p>
          </div>
          <button
            onClick={scanInbox}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Scanning..." : "Scan Inbox"}
          </button>
        </div>

        {/* Signal Bar */}
        {threads.length > 0 && (
          <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Pipeline Health</span>
              <span className="text-sm font-bold text-gray-900">{signalScore}%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${signalScore > 60 ? "bg-green-500" : signalScore > 30 ? "bg-yellow-500" : "bg-red-500"}`}
                style={{ width: `${signalScore}%` }}
              />
            </div>
            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              {Object.entries(
                threads.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {})
              ).map(([status, count]) => (
                <span key={status}>{STATUS_COLORS[status]?.label || status}: {count}</span>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {["ALL", ...Object.keys(STATUS_COLORS)].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filter === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
              }`}
            >
              {s === "ALL" ? "All" : STATUS_COLORS[s]?.label}
            </button>
          ))}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by company, name, role..."
            className="ml-auto px-3 py-1 border border-gray-200 rounded-full text-xs focus:outline-none focus:border-blue-400"
          />
        </div>

        {/* Thread Cards */}
        {filtered.length === 0 && !loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            {threads.length === 0 ? 'Click "Scan Inbox" to load your recruiting threads.' : "No threads match this filter."}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(thread => {
              const statusStyle = STATUS_COLORS[thread.status] || STATUS_COLORS.WAITING;
              const isExpanded = expanded === thread.id;
              return (
                <div key={thread.id} className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 truncate">{thread.company}</span>
                          {thread.role && <span className="text-sm text-gray-500">· {thread.role}</span>}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                            {statusStyle.label}
                          </span>
                          <span className={`text-xs ${URGENCY_COLORS[thread.urgency] || ""}`}>
                            {thread.urgency}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">{thread.contact}</p>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{thread.summary}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-400">{thread.daysSince}d ago</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <p className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded flex-1">
                        → {thread.nextAction}
                      </p>
                      {thread.followUpDraft && (
                        <button
                          onClick={() => setExpanded(isExpanded ? null : thread.id)}
                          className="text-xs text-gray-500 hover:text-gray-700 shrink-0"
                        >
                          {isExpanded ? "Hide draft ↑" : "View draft ↓"}
                        </button>
                      )}
                    </div>

                    {isExpanded && thread.followUpDraft && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg border text-sm text-gray-700 whitespace-pre-wrap">
                        {thread.followUpDraft}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
