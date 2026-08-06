/**
 * SystemLogs.jsx — Super Admin System Logs
 * ──────────────────────────────────────────
 * • Two tabs: Audit Logs & Slow Request Logs
 * • Stats header (total, 24h, errors, critical — fetched in one parallel call)
 * • Filters: search, role, level, entity type, date range — debounced
 * • Pagination — 50 rows/page, server-side
 * • JSON diff drawer for old_value / new_value inspection
 * • CSV export
 * • Fully responsive: mobile / tablet / laptop / PC
 */

import { useState, useEffect, useCallback } from "react";
import api from "../../services/api";
import "./SystemLogs.css";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: true,
  });
};

const levelFromStatus = (code) => {
  if (!code) return "info";
  if (code >= 500) return "error";
  if (code >= 400) return "warn";
  return "info";
};

const levelFromDuration = (ms) => {
  if (!ms) return "info";
  if (ms >= 3000) return "error";
  if (ms >= 1000) return "warn";
  return "info";
};

const LEVEL_LABELS = { error: "ERROR", warn: "WARN", info: "INFO" };
const ENTITY_TYPES = [
  "Student","Fee","Exam","Institute","Faculty","User",
  "Subscription","Salary","Attendance","Announcement","Assignment",
];

const useDebounce = (value, delay) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div className={`sl-stat-card ${accent ? `sl-stat-${accent}` : ""}`}>
      <div className="sl-stat-icon">{icon}</div>
      <div className="sl-stat-body">
        <div className="sl-stat-value">{value ?? "—"}</div>
        <div className="sl-stat-label">{label}</div>
        {sub && <div className="sl-stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

function LevelBadge({ level }) {
  return <span className={`sl-badge sl-badge-${level}`}>{LEVEL_LABELS[level] || level}</span>;
}

function JsonDrawer({ row, onClose }) {
  if (!row) return null;
  return (
    <div className="sl-drawer-overlay" onClick={onClose}>
      <div className="sl-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="sl-drawer-header">
          <h3>Log Detail</h3>
          <button className="sl-drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="sl-drawer-body">
          <div className="sl-drawer-meta">
            <span><strong>Action:</strong> {row.action || row.path || "—"}</span>
            {row.entity_type && (
              <span><strong>Entity:</strong> {row.entity_type} {row.entity_id ? `#${row.entity_id}` : ""}</span>
            )}
            <span><strong>User:</strong> {row.user_name || row.user_id || "—"} ({row.user_role || "—"})</span>
            <span><strong>IP:</strong> {row.ip_address || "—"}</span>
            <span><strong>Time:</strong> {fmt(row.createdAt)}</span>
          </div>
          {row.remarks && (
            <div className="sl-drawer-remarks">
              <strong>Remarks:</strong> {row.remarks}
            </div>
          )}
          {row.old_value && (
            <div className="sl-drawer-section">
              <div className="sl-drawer-section-label sl-old">⬅ Old Value</div>
              <pre>{JSON.stringify(row.old_value, null, 2)}</pre>
            </div>
          )}
          {row.new_value && (
            <div className="sl-drawer-section">
              <div className="sl-drawer-section-label sl-new">➡ New Value</div>
              <pre>{JSON.stringify(row.new_value, null, 2)}</pre>
            </div>
          )}
          {row.metadata && Object.keys(row.metadata || {}).length > 0 && (
            <div className="sl-drawer-section">
              <div className="sl-drawer-section-label">📦 Metadata</div>
              <pre>{JSON.stringify(row.metadata, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SystemLogs() {
  const [activeTab, setActiveTab]     = useState("audit");
  const [logs, setLogs]               = useState([]);
  const [stats, setStats]             = useState(null);
  const [loading, setLoading]         = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError]             = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);

  // Pagination
  const [page, setPage]   = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const LIMIT = 50;

  // Filters
  const [search, setSearch]         = useState("");
  const [role, setRole]             = useState("");
  const [level, setLevel]           = useState("");
  const [entityType, setEntityType] = useState("");
  
  // Month wise filter (Defaults to current month)
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filtersOpen, setFiltersOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 350);

  // Compute start/end dates based on selected month
  const computedStartDate = filterMonth ? new Date(filterMonth.split('-')[0], parseInt(filterMonth.split('-')[1]) - 1, 1).toISOString().split('T')[0] : "";
  const computedEndDate   = filterMonth ? new Date(filterMonth.split('-')[0], parseInt(filterMonth.split('-')[1]), 0).toISOString().split('T')[0] : "";

  // ── Fetch stats ────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = {};
      if (computedStartDate) params.start_date = computedStartDate;
      if (computedEndDate)   params.end_date = computedEndDate;
      
      const r = await api.get("/superadmin/system-logs/stats", { params });
      setStats(r.data.stats);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [computedStartDate, computedEndDate]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ── Fetch logs ─────────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        type:  activeTab,
        page,
        limit: LIMIT,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(role        && { role }),
        ...(level       && { level }),
        ...(entityType  && { entity_type: entityType }),
        ...(computedStartDate   && { start_date: computedStartDate }),
        ...(computedEndDate     && { end_date: computedEndDate }),
      };
      const { data } = await api.get("/superadmin/system-logs", { params });
      setLogs(data.data || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to load logs.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, debouncedSearch, role, level, entityType, computedStartDate, computedEndDate]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleRefresh = () => {
    fetchStats();
    fetchLogs();
  };

  // Reset page to 1 when filters change
  useEffect(() => { setPage(1); }, [activeTab, debouncedSearch, role, level, entityType, filterMonth]);

  // ── CSV Export ─────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!logs.length) return;
    const headers = activeTab === "audit"
      ? ["ID","Action","Entity","EntityID","User","Role","IP","StatusCode","Time","Remarks"]
      : ["ID","Method","Path","StatusCode","Duration_ms","UserID","Role","IP","Time"];
    const rows = logs.map(r =>
      activeTab === "audit"
        ? [r.id,r.action,r.entity_type,r.entity_id,r.user_name||r.user_id,r.user_role,r.ip_address,r.status_code,r.createdAt,r.remarks]
        : [r.id,r.method,r.path,r.status_code,r.duration_ms,r.user_id,r.user_role,r.ip_address,r.createdAt]
    );
    const csv = [headers, ...rows].map(r => r.map(v => `"${v ?? ""}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `system-logs-${activeTab}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearch(""); setRole(""); setLevel("");
    setEntityType(""); setFilterMonth("");
  };

  const hasActiveFilter = search || role || level || entityType || filterMonth;

  return (
    <div className="sl-page">
      {/* Page Header */}
      <div className="sl-header">
        <div className="sl-header-left">
          <h1 className="sl-title">📋 System Logs</h1>
          <p className="sl-subtitle">Full audit trail &amp; performance monitoring</p>
        </div>
        <div className="sl-header-right">
          <button className="sl-btn sl-btn-ghost" onClick={handleRefresh}>🔄 Refresh</button>
          <button className="sl-btn sl-btn-secondary" onClick={handleExport} disabled={!logs.length}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="sl-stats-row">
        {statsLoading
          ? Array.from({length:5}).map((_,i) => <div key={i} className="sl-stat-card sl-stat-skeleton"/>)
          : <>
              <StatCard icon="📝" label="Total Audit Logs"  value={stats?.totalAuditLogs?.toLocaleString()}   accent="blue"/>
              <StatCard icon="⚡" label="Last 24 Hours"      value={stats?.auditLast24h?.toLocaleString()}     sub="new events" accent="purple"/>
              <StatCard icon="🐢" label="Slow Requests"      value={stats?.totalSlowRequests?.toLocaleString()} accent="orange"/>
              <StatCard icon="🔴" label="Errors (5xx)"       value={stats?.errorCount?.toLocaleString()}       accent="red"/>
              <StatCard icon="⚠️" label="Critical (7d)"      value={stats?.criticalActions?.toLocaleString()}  sub="delete/suspend" accent="yellow"/>
            </>
        }
      </div>

      {/* Tabs */}
      <div className="sl-tabs">
        <button className={`sl-tab ${activeTab==="audit"?"active":""}`} onClick={()=>setActiveTab("audit")}>
          📝 Audit Logs
          {stats && <span className="sl-tab-badge">{stats.totalAuditLogs?.toLocaleString()}</span>}
        </button>
        <button className={`sl-tab ${activeTab==="slow"?"active":""}`} onClick={()=>setActiveTab("slow")}>
          🐢 Slow Requests
          {stats && <span className="sl-tab-badge">{stats.totalSlowRequests?.toLocaleString()}</span>}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="sl-filters-bar">
        <div className="sl-search-wrap">
          <span className="sl-search-icon">🔍</span>
          <input
            className="sl-search"
            placeholder={activeTab==="audit" ? "Search action, entity, user, path…" : "Search path…"}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="sl-search-clear" onClick={()=>setSearch("")}>✕</button>}
        </div>
        
        {/* Month Picker */}
        <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto'}}>
          <label style={{fontSize: '0.9rem', color: '#6b7280', fontWeight: '500'}}>Month:</label>
          <input 
            type="month" 
            className="sl-search" 
            style={{padding: '0.5rem', width: 'auto'}}
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
          />
        </div>

        <button className={`sl-btn sl-btn-ghost${filtersOpen?" active":""}`} onClick={()=>setFiltersOpen(v=>!v)}>
          🔧 Filters {hasActiveFilter && <span className="sl-filter-dot"/>}
        </button>
        {hasActiveFilter && (
          <button className="sl-btn sl-btn-ghost sl-btn-clear" onClick={clearFilters}>✕ Clear</button>
        )}
      </div>

      {/* Advanced Filters Panel */}
      {filtersOpen && (
        <div className="sl-filters-panel">
          <div className="sl-filter-group">
            <label>Role</label>
            <select value={role} onChange={e=>setRole(e.target.value)}>
              <option value="">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="faculty">Faculty</option>
              <option value="student">Student</option>
              <option value="parent">Parent</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <div className="sl-filter-group">
            <label>Level</label>
            <select value={level} onChange={e=>setLevel(e.target.value)}>
              <option value="">All Levels</option>
              <option value="error">Error (5xx)</option>
              <option value="warn">Warning (4xx)</option>
              <option value="info">Info (2xx)</option>
            </select>
          </div>
          {activeTab==="audit" && (
            <div className="sl-filter-group">
              <label>Entity Type</label>
              <select value={entityType} onChange={e=>setEntityType(e.target.value)}>
                <option value="">All Entities</option>
                {ENTITY_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Result Bar */}
      <div className="sl-result-bar">
        <span className="sl-result-count">
          {loading ? "Loading…" : `${total.toLocaleString()} result${total!==1?"s":""}`}
        </span>
        <span className="sl-page-info">Page {page} of {pages}</span>
      </div>

      {/* Error */}
      {error && (
        <div className="sl-error">
          ⚠️ {error}
          <button onClick={fetchLogs}>Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="sl-table-wrap">
        {loading ? (
          <div className="sl-loading">
            <div className="sl-spinner"/>
            <span>Loading logs…</span>
          </div>
        ) : logs.length===0 ? (
          <div className="sl-empty">
            <div className="sl-empty-icon">📭</div>
            <div className="sl-empty-text">No logs found</div>
            <div className="sl-empty-sub">Try adjusting your filters</div>
          </div>
        ) : activeTab==="audit" ? (
          <AuditTable logs={logs} onSelect={setSelectedRow}/>
        ) : (
          <SlowTable logs={logs} onSelect={setSelectedRow}/>
        )}
      </div>

      {/* Pagination */}
      {pages>1 && (
        <div className="sl-pagination">
          <button className="sl-page-btn" disabled={page<=1} onClick={()=>setPage(1)}>«</button>
          <button className="sl-page-btn" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>‹</button>
          {Array.from({length:Math.min(pages,7)},(_,i)=>{
            let p;
            if(pages<=7) p=i+1;
            else if(page<=4) p=i+1;
            else if(page>=pages-3) p=pages-6+i;
            else p=page-3+i;
            return (
              <button key={p} className={`sl-page-btn${p===page?" active":""}`} onClick={()=>setPage(p)}>{p}</button>
            );
          })}
          <button className="sl-page-btn" disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>›</button>
          <button className="sl-page-btn" disabled={page>=pages} onClick={()=>setPage(pages)}>»</button>
        </div>
      )}

      {/* JSON Diff Drawer */}
      {selectedRow && <JsonDrawer row={selectedRow} onClose={()=>setSelectedRow(null)}/>}
    </div>
  );
}

// ── Audit Log Table ────────────────────────────────────────────────────────────

function AuditTable({ logs, onSelect }) {
  return (
    <table className="sl-table">
      <thead>
        <tr>
          <th>Level</th>
          <th>Action</th>
          <th>Entity</th>
          <th>User</th>
          <th>Role</th>
          <th>IP</th>
          <th>Time</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {logs.map(row => {
          const lv = levelFromStatus(row.status_code);
          return (
            <tr key={row.id} className={`sl-tr sl-tr-${lv}`} onClick={()=>onSelect(row)}>
              <td><LevelBadge level={lv}/></td>
              <td className="sl-cell-action">
                <span className="sl-action-text" title={row.action||row.path}>{row.action||row.path||"—"}</span>
              </td>
              <td>
                {row.entity_type
                  ? <span className="sl-entity">{row.entity_type} <span className="sl-entity-id">#{row.entity_id}</span></span>
                  : "—"}
              </td>
              <td>{row.user_name||(row.user_id?`#${row.user_id}`:"System")}</td>
              <td><span className="sl-role-badge">{row.user_role||"—"}</span></td>
              <td className="sl-cell-mono">{row.ip_address||"—"}</td>
              <td className="sl-cell-time">{fmt(row.createdAt)}</td>
              <td>
                <button className="sl-view-btn" onClick={e=>{e.stopPropagation();onSelect(row);}}>👁</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Slow Request Table ─────────────────────────────────────────────────────────

function SlowTable({ logs, onSelect }) {
  return (
    <table className="sl-table">
      <thead>
        <tr>
          <th>Level</th>
          <th>Method</th>
          <th>Path</th>
          <th>Status</th>
          <th>Duration</th>
          <th>User</th>
          <th>Role</th>
          <th>Time</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {logs.map(row => {
          const lv = levelFromDuration(row.duration_ms);
          return (
            <tr key={row.id} className={`sl-tr sl-tr-${lv}`} onClick={()=>onSelect(row)}>
              <td><LevelBadge level={lv}/></td>
              <td>
                <span className={`sl-method sl-method-${(row.method||"GET").toLowerCase()}`}>{row.method||"—"}</span>
              </td>
              <td className="sl-cell-path" title={row.path}>{row.path||"—"}</td>
              <td>
                <span className={`sl-status sl-status-${levelFromStatus(row.status_code)}`}>{row.status_code||"—"}</span>
              </td>
              <td>
                <span className={`sl-duration sl-duration-${lv}`}>
                  {row.duration_ms!=null?`${row.duration_ms}ms`:"—"}
                </span>
              </td>
              <td>{row.user_id?`#${row.user_id}`:"System"}</td>
              <td><span className="sl-role-badge">{row.user_role||"—"}</span></td>
              <td className="sl-cell-time">{fmt(row.createdAt)}</td>
              <td>
                <button className="sl-view-btn" onClick={e=>{e.stopPropagation();onSelect(row);}}>👁</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
