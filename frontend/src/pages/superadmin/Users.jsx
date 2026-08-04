/**
 * Super Admin — Users Management
 * ────────────────────────────────────────────────────────────────
 * • Paginated, server-side filtered list of ALL platform users
 * • Search by name / email / phone
 * • Filter by role, status
 * • Sort by any column
 * • Click stat cards to quick-filter
 * • View detail modal
 * • Block / Unblock user
 * • Delete user (soft)
 * • Fully responsive (mobile → desktop)
 * • Dark mode aware
 */

import { useState, useEffect, useCallback, useRef } from "react";
import api from "../../services/api";
import "./Users.css";

// ─── Constants ────────────────────────────────────────────────
const PAGE_LIMIT = 20;
const DEBOUNCE_MS = 450;

const ROLE_LABELS = {
    admin: "Admin",
    manager: "Manager",
    faculty: "Faculty",
    student: "Student",
    parent: "Parent",
};

const ROLE_ICONS = {
    admin: "🛡️",
    manager: "👔",
    faculty: "👨‍🏫",
    student: "🎓",
    parent: "👪",
};

// ─── Helpers ──────────────────────────────────────────────────
function getInitials(name) {
    if (!name) return "?";
    return name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
}

function formatDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

// ─── Component ────────────────────────────────────────────────
export default function Users() {
    // ── Data state ──────────────────────────────────────────────
    const [users, setUsers] = useState([]);
    const [summary, setSummary] = useState({ total: 0, active: 0, blocked: 0, byRole: {} });
    const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
    const [loading, setLoading] = useState(true);

    // ── Filter state ─────────────────────────────────────────────
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState("createdAt");
    const [sortOrder, setSortOrder] = useState("DESC");

    // ── UI state ─────────────────────────────────────────────────
    const [actionLoading, setActionLoading] = useState(null); // user id being actioned
    const [toasts, setToasts] = useState([]);
    const [detailUser, setDetailUser] = useState(null);
    const [confirmModal, setConfirmModal] = useState(null);

    const searchTimer = useRef(null);

    // ── Debounce search ──────────────────────────────────────────
    useEffect(() => {
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, DEBOUNCE_MS);
        return () => clearTimeout(searchTimer.current);
    }, [search]);

    // ── Fetch users ──────────────────────────────────────────────
    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                page,
                limit: PAGE_LIMIT,
                search: debouncedSearch || undefined,
                role: roleFilter !== "all" ? roleFilter : undefined,
                status: statusFilter !== "all" ? statusFilter : undefined,
                sortBy,
                sortOrder,
            };
            // Remove undefined keys
            Object.keys(params).forEach((k) => params[k] === undefined && delete params[k]);

            const { data } = await api.get("/superadmin/users", { params });
            if (data.success) {
                setUsers(data.users);
                setSummary(data.summary);
                setPagination(data.pagination);
            }
        } catch (err) {
            showToast("Failed to load users: " + (err.response?.data?.error || err.message), "error");
        } finally {
            setLoading(false);
        }
    }, [page, debouncedSearch, roleFilter, statusFilter, sortBy, sortOrder]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    // ── Toast helper ─────────────────────────────────────────────
    const showToast = (msg, type = "success") => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, msg, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
    };

    // ── Sort handler ─────────────────────────────────────────────
    const handleSort = (col) => {
        if (sortBy === col) {
            setSortOrder((o) => (o === "ASC" ? "DESC" : "ASC"));
        } else {
            setSortBy(col);
            setSortOrder("ASC");
        }
        setPage(1);
    };

    const SortIcon = ({ col }) => {
        if (sortBy !== col) return <span className="usr-sort-icon">↕</span>;
        return <span className={`usr-sort-icon ${sortOrder.toLowerCase()}`}>{sortOrder === "ASC" ? "↑" : "↓"}</span>;
    };

    // ── Block / Unblock ──────────────────────────────────────────
    const handleToggleStatus = async (user) => {
        const newStatus = user.status === "active" ? "blocked" : "active";
        const label = newStatus === "blocked" ? "block" : "unblock";
        setConfirmModal({
            type: newStatus === "blocked" ? "warning" : "success",
            icon: newStatus === "blocked" ? "🚫" : "✅",
            title: `${label.charAt(0).toUpperCase() + label.slice(1)} User`,
            body: `Are you sure you want to ${label} "${user.name || user.email}"? ${
                newStatus === "blocked"
                    ? "They will not be able to log in."
                    : "They will regain full access."
            }`,
            onConfirm: async () => {
                setConfirmModal(null);
                setActionLoading(user.id);
                try {
                    await api.put(`/superadmin/users/${user.id}/status`, { status: newStatus });
                    showToast(`User ${label}ed successfully`, "success");
                    fetchUsers();
                } catch (err) {
                    showToast(err.response?.data?.error || "Action failed", "error");
                } finally {
                    setActionLoading(null);
                }
            },
        });
    };

    // ── Delete ───────────────────────────────────────────────────
    const handleDelete = (user) => {
        setConfirmModal({
            type: "danger",
            icon: "🗑️",
            title: "Delete User",
            body: `Permanently remove "${user.name || user.email}"? This is a soft-delete and can be recovered via DB tools.`,
            onConfirm: async () => {
                setConfirmModal(null);
                setActionLoading(user.id);
                try {
                    await api.delete(`/superadmin/users/${user.id}`);
                    showToast("User deleted successfully", "success");
                    fetchUsers();
                } catch (err) {
                    showToast(err.response?.data?.error || "Delete failed", "error");
                } finally {
                    setActionLoading(null);
                }
            },
        });
    };

    // ── Stat card quick-filter ────────────────────────────────────
    const handleStatFilter = (type, value) => {
        if (type === "status") {
            setStatusFilter((prev) => (prev === value ? "all" : value));
        } else if (type === "role") {
            setRoleFilter((prev) => (prev === value ? "all" : value));
        } else {
            setStatusFilter("all");
            setRoleFilter("all");
        }
        setPage(1);
    };

    // ── Pagination helpers ────────────────────────────────────────
    const pageRange = () => {
        const total = pagination.totalPages;
        const cur = pagination.page;
        if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
        const pages = [];
        if (cur > 3) pages.push(1, "...");
        for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) pages.push(i);
        if (cur < total - 2) pages.push("...", total);
        return pages;
    };

    // ─────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────
    return (
        <div className="usr-page">

            {/* ── Toast Container ── */}
            <div className="usr-toast-container">
                {toasts.map((t) => (
                    <div key={t.id} className={`usr-toast ${t.type}`}>
                        <span>{t.type === "success" ? "✅" : "❌"}</span>
                        {t.msg}
                    </div>
                ))}
            </div>

            {/* ── Page Header ── */}
            <div className="usr-header">
                <div>
                    <h1 className="usr-title">👥 Users Management</h1>
                    <p className="usr-subtitle">
                        Manage all platform users — admins, faculty, students, parents and managers
                    </p>
                </div>
                <div className="usr-header-right">
                    <button className="usr-btn usr-btn-ghost" onClick={fetchUsers} title="Refresh">
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {/* ── Summary Stat Cards ── */}
            <div className="usr-stats-grid">
                <div
                    className={`usr-stat-card ${statusFilter === "all" && roleFilter === "all" ? "active-filter" : ""}`}
                    onClick={() => handleStatFilter("all")}
                    title="Show all users"
                >
                    <div className="usr-stat-icon purple">👥</div>
                    <div className="usr-stat-info">
                        <div className="usr-stat-value">{summary.total.toLocaleString()}</div>
                        <div className="usr-stat-label">Total Users</div>
                    </div>
                </div>
                <div
                    className={`usr-stat-card ${statusFilter === "active" ? "active-filter" : ""}`}
                    onClick={() => handleStatFilter("status", "active")}
                    title="Filter active users"
                >
                    <div className="usr-stat-icon green">✅</div>
                    <div className="usr-stat-info">
                        <div className="usr-stat-value">{summary.active.toLocaleString()}</div>
                        <div className="usr-stat-label">Active</div>
                    </div>
                </div>
                <div
                    className={`usr-stat-card ${statusFilter === "blocked" ? "active-filter" : ""}`}
                    onClick={() => handleStatFilter("status", "blocked")}
                    title="Filter blocked users"
                >
                    <div className="usr-stat-icon red">🚫</div>
                    <div className="usr-stat-info">
                        <div className="usr-stat-value">{summary.blocked.toLocaleString()}</div>
                        <div className="usr-stat-label">Blocked</div>
                    </div>
                </div>
                {["admin", "faculty", "student", "parent", "manager"].map((role) => {
                    const colorMap = { admin: "blue", faculty: "teal", student: "purple", parent: "pink", manager: "orange" };
                    return (
                        <div
                            key={role}
                            className={`usr-stat-card ${roleFilter === role ? "active-filter" : ""}`}
                            onClick={() => handleStatFilter("role", role)}
                            title={`Filter ${ROLE_LABELS[role]}s`}
                        >
                            <div className={`usr-stat-icon ${colorMap[role]}`}>{ROLE_ICONS[role]}</div>
                            <div className="usr-stat-info">
                                <div className="usr-stat-value">
                                    {(summary.byRole?.[role] || 0).toLocaleString()}
                                </div>
                                <div className="usr-stat-label">{ROLE_LABELS[role]}s</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Toolbar ── */}
            <div className="usr-toolbar">
                <div className="usr-search-wrap">
                    <span className="usr-search-icon">🔍</span>
                    <input
                        type="text"
                        className="usr-search-input"
                        placeholder="Search name, email, phone…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <select
                    className="usr-select"
                    value={roleFilter}
                    onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                >
                    <option value="all">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="faculty">Faculty</option>
                    <option value="student">Student</option>
                    <option value="parent">Parent</option>
                </select>

                <select
                    className="usr-select"
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="blocked">Blocked</option>
                </select>

                <div className="usr-toolbar-spacer" />
                {!loading && (
                    <span className="usr-results-count">
                        {pagination.total.toLocaleString()} result{pagination.total !== 1 ? "s" : ""}
                    </span>
                )}
            </div>

            {/* ── Table ── */}
            <div className="usr-table-wrap">
                {loading ? (
                    <div className="usr-loading">
                        <div className="usr-spinner" />
                        Loading users…
                    </div>
                ) : users.length === 0 ? (
                    <div className="usr-empty">
                        <span className="usr-empty-icon">👤</span>
                        <span className="usr-empty-msg">No users found</span>
                        <span className="usr-empty-sub">Try adjusting your search or filters</span>
                    </div>
                ) : (
                    <table className="usr-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort("name")}>
                                    User <SortIcon col="name" />
                                </th>
                                <th onClick={() => handleSort("role")}>
                                    Role <SortIcon col="role" />
                                </th>
                                <th onClick={() => handleSort("status")}>
                                    Status <SortIcon col="status" />
                                </th>
                                <th>Institute</th>
                                <th>Phone</th>
                                <th onClick={() => handleSort("createdAt")}>
                                    Joined <SortIcon col="createdAt" />
                                </th>
                                <th style={{ textAlign: "right" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id}>
                                    {/* User cell */}
                                    <td>
                                        <div className="usr-user-cell">
                                            <div className={`usr-avatar ${user.role}`}>
                                                {getInitials(user.name)}
                                            </div>
                                            <div>
                                                <div className="usr-user-name" title={user.name}>
                                                    {user.name || "—"}
                                                </div>
                                                <div className="usr-user-email" title={user.email}>
                                                    {user.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Role */}
                                    <td>
                                        <span className={`usr-role-badge ${user.role}`}>
                                            {ROLE_ICONS[user.role]} {ROLE_LABELS[user.role] || user.role}
                                        </span>
                                    </td>

                                    {/* Status */}
                                    <td>
                                        <span className={`usr-status-badge ${user.status || "active"}`}>
                                            <span className={`usr-dot ${user.status || "active"}`} />
                                            {user.status === "blocked" ? "Blocked" : "Active"}
                                        </span>
                                    </td>

                                    {/* Institute */}
                                    <td>
                                        <span className="usr-institute-tag" title={user.Institute?.name || "—"}>
                                            {user.Institute?.name || <em style={{ color: "#94a3b8" }}>Platform</em>}
                                        </span>
                                    </td>

                                    {/* Phone */}
                                    <td>
                                        <span className="usr-date-cell">{user.phone || "—"}</span>
                                    </td>

                                    {/* Joined */}
                                    <td>
                                        <span className="usr-date-cell">{formatDate(user.createdAt)}</span>
                                    </td>

                                    {/* Actions */}
                                    <td>
                                        <div className="usr-actions-cell" style={{ justifyContent: "flex-end" }}>
                                            <button
                                                className="usr-action-btn view"
                                                title="View Details"
                                                onClick={() => setDetailUser(user)}
                                            >
                                                👁️
                                            </button>
                                            <button
                                                className={`usr-action-btn ${user.status === "blocked" ? "unblock" : "block"}`}
                                                title={user.status === "blocked" ? "Unblock User" : "Block User"}
                                                onClick={() => handleToggleStatus(user)}
                                                disabled={actionLoading === user.id}
                                            >
                                                {actionLoading === user.id
                                                    ? "⏳"
                                                    : user.status === "blocked"
                                                    ? "✅"
                                                    : "🚫"}
                                            </button>
                                            <button
                                                className="usr-action-btn delete"
                                                title="Delete User"
                                                onClick={() => handleDelete(user)}
                                                disabled={actionLoading === user.id}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── Pagination ── */}
            {!loading && pagination.totalPages > 1 && (
                <div className="usr-pagination">
                    <span className="usr-page-info">
                        Showing {Math.min((page - 1) * PAGE_LIMIT + 1, pagination.total)}–
                        {Math.min(page * PAGE_LIMIT, pagination.total)} of {pagination.total.toLocaleString()} users
                    </span>
                    <div className="usr-page-btns">
                        <button
                            className="usr-page-btn"
                            onClick={() => setPage((p) => p - 1)}
                            disabled={page <= 1}
                        >
                            ←
                        </button>
                        {pageRange().map((p, i) =>
                            p === "..." ? (
                                <span key={`dots-${i}`} className="usr-page-btn" style={{ cursor: "default" }}>
                                    …
                                </span>
                            ) : (
                                <button
                                    key={p}
                                    className={`usr-page-btn ${page === p ? "active" : ""}`}
                                    onClick={() => setPage(p)}
                                >
                                    {p}
                                </button>
                            )
                        )}
                        <button
                            className="usr-page-btn"
                            onClick={() => setPage((p) => p + 1)}
                            disabled={page >= pagination.totalPages}
                        >
                            →
                        </button>
                    </div>
                </div>
            )}

            {/* ── User Detail Modal ── */}
            {detailUser && (
                <div className="usr-modal-overlay" onClick={() => setDetailUser(null)}>
                    <div className="usr-modal" onClick={(e) => e.stopPropagation()}>
                        <div className={`usr-detail-avatar ${detailUser.role}`}>
                            {getInitials(detailUser.name)}
                        </div>

                        <div className="usr-detail-grid">
                            <div className="usr-detail-item">
                                <label>Full Name</label>
                                <span>{detailUser.name || "—"}</span>
                            </div>
                            <div className="usr-detail-item">
                                <label>Email</label>
                                <span>{detailUser.email || "—"}</span>
                            </div>
                            <div className="usr-detail-item">
                                <label>Phone</label>
                                <span>{detailUser.phone || "—"}</span>
                            </div>
                            <div className="usr-detail-item">
                                <label>Role</label>
                                <span>
                                    <span className={`usr-role-badge ${detailUser.role}`}>
                                        {ROLE_ICONS[detailUser.role]} {ROLE_LABELS[detailUser.role] || detailUser.role}
                                    </span>
                                </span>
                            </div>
                            <div className="usr-detail-item">
                                <label>Status</label>
                                <span>
                                    <span className={`usr-status-badge ${detailUser.status || "active"}`}>
                                        <span className={`usr-dot ${detailUser.status || "active"}`} />
                                        {detailUser.status === "blocked" ? "Blocked" : "Active"}
                                    </span>
                                </span>
                            </div>
                            <div className="usr-detail-item">
                                <label>Institute</label>
                                <span>{detailUser.Institute?.name || "Platform"}</span>
                            </div>
                            <div className="usr-detail-item">
                                <label>Joined</label>
                                <span>{formatDate(detailUser.createdAt)}</span>
                            </div>
                            <div className="usr-detail-item">
                                <label>Last Updated</label>
                                <span>{formatDate(detailUser.updatedAt)}</span>
                            </div>
                            {detailUser.role === "manager" && detailUser.manager_type && (
                                <div className="usr-detail-item">
                                    <label>Manager Type</label>
                                    <span>{detailUser.manager_type_label || detailUser.manager_type}</span>
                                </div>
                            )}
                            {detailUser.credentials_sent_at && (
                                <div className="usr-detail-item">
                                    <label>Credentials Sent</label>
                                    <span>{formatDate(detailUser.credentials_sent_at)}</span>
                                </div>
                            )}
                        </div>

                        <div className="usr-modal-actions">
                            <button
                                className={`usr-btn ${detailUser.status === "blocked" ? "usr-btn-success" : "usr-btn-danger"}`}
                                onClick={() => { setDetailUser(null); handleToggleStatus(detailUser); }}
                            >
                                {detailUser.status === "blocked" ? "✅ Unblock" : "🚫 Block"}
                            </button>
                            <button className="usr-btn usr-btn-ghost" onClick={() => setDetailUser(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Confirm Modal ── */}
            {confirmModal && (
                <div className="usr-modal-overlay" onClick={() => setConfirmModal(null)}>
                    <div className="usr-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="usr-modal-header">
                            <div className={`usr-modal-icon-wrap ${confirmModal.type}`}>
                                {confirmModal.icon}
                            </div>
                            <h3 className="usr-modal-title">{confirmModal.title}</h3>
                        </div>
                        <p className="usr-modal-body">{confirmModal.body}</p>
                        <div className="usr-modal-actions">
                            <button
                                className={`usr-btn ${
                                    confirmModal.type === "danger"
                                        ? "usr-btn-danger"
                                        : confirmModal.type === "warning"
                                        ? "usr-btn-danger"
                                        : "usr-btn-success"
                                }`}
                                onClick={confirmModal.onConfirm}
                            >
                                Confirm
                            </button>
                            <button className="usr-btn usr-btn-ghost" onClick={() => setConfirmModal(null)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
