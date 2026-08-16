/**
 * MobileFaculty.jsx — Admin Mobile Faculty Management
 *
 * Mobile-optimized redesign of the Faculty page for Admin.
 * Matches the design from img1 (stats cards + list) adapted to mobile.
 *
 * API: /faculty, /classes, /subjects
 */

import { useState, useEffect, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import "./MobileFaculty.css";

// ── Avatar colours ─────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
    "#7C3AED", "#2563EB", "#D97706", "#059669",
    "#DC2626", "#0891B2", "#7C3AED", "#D946EF",
];
const avatarColor = (name) => AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];

// ── Tiny sparkline SVG (decorative) ───────────────────────────────────────────
const Sparkline = ({ color = "#7C3AED", points = "0,20 15,12 30,15 45,5 60,8 75,3" }) => (
    <svg width="76" height="24" viewBox="0 0 76 24" fill="none" style={{ flexShrink: 0 }}>
        <polyline
            points={points}
            stroke={color}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon, iconBg, label, value, sub, sparkColor, sparkPoints }) => (
    <div className="mfac-stat-card">
        <div className="mfac-stat-top">
            <div className="mfac-stat-icon" style={{ background: iconBg }}>{icon}</div>
            <div className="mfac-stat-info">
                <span className="mfac-stat-label">{label}</span>
                <span className="mfac-stat-value">{value}</span>
                <span className="mfac-stat-sub">{sub}</span>
            </div>
        </div>
        <div className="mfac-stat-spark">
            <Sparkline color={sparkColor} points={sparkPoints} />
        </div>
    </div>
);

// ── Faculty Row Card ──────────────────────────────────────────────────────────
const FacultyCard = ({ faculty, onView }) => {
    const name  = faculty.User?.name || faculty.name || "Faculty";
    const phone = faculty.User?.phone || faculty.phone || "N/A";
    const email = faculty.User?.email || faculty.email || "N/A";
    const status = faculty.User?.status || "active";
    const designation = faculty.designation || "Faculty";
    
    // Format subjects like the web app
    const teachingText = faculty.Subjects?.length > 0
        ? faculty.Subjects.map(s => s.name).join(', ')
        : "N/A";

    const initial = name.charAt(0).toUpperCase();
    const isActive = status === "active";

    return (
        <div className="mfac-card" onClick={() => onView(faculty)}>
            <div className="mfac-sc-left">
                <div className="mfac-sc-avatar" style={{ background: avatarColor(name), color: "#fff" }}>
                    {initial}
                </div>
                <div className="mfac-sc-info">
                    <span className="mfac-sc-name">{name}</span>
                    <span className="mfac-sc-email">{email}</span>
                    <div className="mfac-sc-designation">{designation}</div>
                </div>
            </div>
            <div className="mfac-sc-right">
                <span className="mfac-sc-phone">📞 {phone}</span>
                <span className={`mfac-sc-status ${isActive ? "active" : "inactive"}`}>
                    {isActive ? "● Active" : "● Inactive"}
                </span>
                <div className="mfac-sc-actions">
                    <button className="mfac-action-btn view-btn" onClick={(e) => { e.stopPropagation(); onView(faculty); }}>
                        👁 View
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Skeleton Row ──────────────────────────────────────────────────────────────
const SkeletonRow = () => (
    <div className="mfac-card mfac-skeleton">
        <div className="mfac-sc-left">
            <div className="mfac-skel-circle" />
            <div className="mfac-skel-lines">
                <div className="mfac-skel-line w70" />
                <div className="mfac-skel-line w50" />
                <div className="mfac-skel-line w40" />
            </div>
        </div>
        <div className="mfac-sc-right">
            <div className="mfac-skel-lines" style={{ alignItems: 'flex-end' }}>
                <div className="mfac-skel-line w60" />
                <div className="mfac-skel-line w50" />
            </div>
        </div>
    </div>
);

// ── Faculty Detail Modal ───────────────────────────────────────────────────────
const FacultyDetailModal = ({ faculty, onClose }) => {
    const name  = faculty.User?.name  || faculty.name  || "—";
    const email = faculty.User?.email || faculty.email || "—";
    const phone = faculty.User?.phone || faculty.phone || "—";
    const designation = faculty.designation || "—";
    const joinDate = faculty.join_date ? new Date(faculty.join_date).toLocaleDateString() : "—";
    const status = faculty.User?.status || "active";
    const address = faculty.address || "—";
    const teachingText = faculty.Subjects?.length > 0 ? faculty.Subjects.map(s => s.name).join(', ') : "—";
    const uniqueClasses = [];
    if (faculty.Subjects?.length > 0) {
        faculty.Subjects.forEach(s => {
            if (s.Class) {
                const classStr = `${s.Class.name}${s.Class.section ? `-${s.Class.section}` : ''}`;
                if (!uniqueClasses.includes(classStr)) {
                    uniqueClasses.push(classStr);
                }
            }
        });
    }
    const classesText = uniqueClasses.length > 0 ? uniqueClasses.join(', ') : "—";

    return (
        <div className="mfac-modal-overlay" onClick={onClose}>
            <div className="mfac-modal mfac-detail-modal" onClick={e => e.stopPropagation()}>
                <div className="mfac-modal-header">
                    <h3>Faculty Profile</h3>
                    <button className="mfac-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="mfac-detail-avatar-row">
                    <div className="mfac-detail-avatar" style={{ background: avatarColor(name), color: "#fff" }}>
                        {name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="mfac-detail-name">{name}</div>
                        <span className={`mfac-sc-status ${status === "active" ? "active" : "inactive"}`}>
                            ● {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                    </div>
                </div>
                <div className="mfac-detail-grid">
                    {[
                        ["📚 Subjects", teachingText],
                        ["🏫 Classes", classesText],
                        ["💼 Designation", designation],
                        ["📞 Phone", phone],
                        ["✉️ Email", email],
                        ["📅 Join Date", joinDate],
                        ["🏠 Address", address],
                    ].map(([label, val]) => (
                        <div className="mfac-detail-row" key={label}>
                            <span className="mfac-detail-label">{label}</span>
                            <span className="mfac-detail-val">{val}</span>
                        </div>
                    ))}
                </div>
                <div className="mfac-modal-footer">
                    <button className="mfac-btn-save" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

// ── Main Component ─────────────────────────────────────────────────────────────
export default function MobileFaculty() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    // ── Data ──────────────────────────────────────────────────────────────────
    const [faculty, setFaculty] = useState([]);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);

    // ── Filters ───────────────────────────────────────────────────────────────
    const [search, setSearch] = useState("");
    const [subjectFilter, setSubjectFilter] = useState("all");
    const [designationFilter, setDesignationFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [showFilters, setShowFilters] = useState(false);

    // ── Modals ────────────────────────────────────────────────────────────────
    const [viewFaculty, setViewFaculty] = useState(null);

    // ── Fetch ─────────────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: "200" });
            if (search.trim()) params.set("search", search.trim());
            if (subjectFilter !== "all") params.set("subject_id", subjectFilter);
            if (statusFilter !== "all") params.set("status", statusFilter);
            // Designation is usually filtered client-side if not explicitly supported in API, but let's try server-side or just client-side below.

            const [fRes, clRes, subRes] = await Promise.all([
                api.get(`/faculty?${params}`),
                classes.length === 0 ? api.get("/classes") : Promise.resolve(null),
                subjects.length === 0 ? api.get("/subjects") : Promise.resolve(null),
            ]);

            const raw = fRes.data.data || [];
            setFaculty(raw);
            setTotalCount(fRes.data.count || raw.length);
            if (clRes) setClasses(clRes.data.data || []);
            if (subRes) setSubjects(subRes.data.data || []);
        } catch (e) {
            console.error("MobileFaculty fetch error:", e);
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, subjectFilter, statusFilter]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ── Derived stats ─────────────────────────────────────────────────────────
    const activeCount = faculty.filter(f => (f.User?.status || "active") === "active").length;
    const totalClasses = classes.length;
    const totalSubjects = subjects.length;
    
    // Get unique designations for filter
    const uniqueDesignations = [...new Set(faculty.map(f => f.designation).filter(Boolean))];

    // ── Client-side designation filter ─────────────────────────────────────────────
    const displayed = designationFilter === "all"
        ? faculty
        : faculty.filter(f => f.designation === designationFilter);

    return (
        <div className="mfac-page">
            {/* ── Page Header ─────────────────────────────────────────────── */}
            <div className="mfac-page-header">
                <div>
                    <h1 className="mfac-page-title">Faculty Management</h1>
                    <p className="mfac-page-sub">Manage faculty members and their information</p>
                </div>
            </div>

            {/* ── Stats Grid 2×2 ─────────────────────────────────────────── */}
            <div className="mfac-stats-grid">
                <StatCard
                    icon="👥" iconBg="rgba(124,58,237,0.12)"
                    label="Total Faculty" value={loading ? "—" : totalCount}
                    sub="All faculty members"
                    sparkColor="#7C3AED"
                    sparkPoints="0,20 12,14 24,17 36,8 48,11 60,5 72,3"
                />
                <StatCard
                    icon="✅" iconBg="rgba(5,150,105,0.12)"
                    label="Active Faculty" value={loading ? "—" : activeCount}
                    sub="Currently active"
                    sparkColor="#059669"
                    sparkPoints="0,18 12,10 24,14 36,6 48,9 60,4 72,2"
                />
                <StatCard
                    icon="📚" iconBg="rgba(37,99,235,0.12)"
                    label="Total Subjects" value={loading ? "—" : totalSubjects}
                    sub="Across all departments"
                    sparkColor="#2563EB"
                    sparkPoints="0,22 12,16 24,18 36,10 48,13 60,7 72,5"
                />
                <StatCard
                    icon="🏫" iconBg="rgba(217,119,6,0.12)"
                    label="Total Classes" value={loading ? "—" : totalClasses}
                    sub="Academic classes"
                    sparkColor="#D97706"
                    sparkPoints="0,20 12,12 24,16 36,8 48,10 60,4 72,2"
                />
            </div>

            {/* ── Search + Filter Row ─────────────────────────────────────── */}
            <div className="mfac-search-row">
                <div className="mfac-search-wrap">
                    <span className="mfac-search-icon">🔍</span>
                    <input
                        className="mfac-search-input"
                        placeholder="Search by name, email or designation..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button className="mfac-search-clear" onClick={() => setSearch("")}>✕</button>
                    )}
                </div>
                <button
                    className={`mfac-filter-toggle ${showFilters ? "active" : ""}`}
                    onClick={() => setShowFilters(v => !v)}
                >
                    ⚙️ Filters
                </button>
            </div>

            {/* ── Expanded Filters ────────────────────────────────────────── */}
            {showFilters && (
                <div className="mfac-filters-panel">
                    <select className="mfac-filter-select" value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
                        <option value="all">All Subjects</option>
                        {subjects.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                    <select className="mfac-filter-select" value={designationFilter} onChange={e => setDesignationFilter(e.target.value)}>
                        <option value="all">All Designations</option>
                        {uniqueDesignations.map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                    <select className="mfac-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="blocked">Blocked</option>
                    </select>
                </div>
            )}

            {/* ── List Header ─────────────────────────────────────────────── */}
            <div className="mfac-list-header">
                <span className="mfac-list-count">All Faculty ({displayed.length})</span>
            </div>

            {/* ── Faculty List ─────────────────────────────────────────────── */}
            <div className="mfac-list">
                {loading
                    ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                    : displayed.length === 0
                        ? (
                            <div className="mfac-empty">
                                <span>👥</span>
                                <p>No faculty found</p>
                            </div>
                        )
                        : displayed.map(f => (
                            <FacultyCard
                                key={f.id}
                                faculty={f}
                                onView={setViewFaculty}
                            />
                        ))
                }
            </div>

            {/* ── Modals ──────────────────────────────────────────────────── */}
            {viewFaculty && (
                <FacultyDetailModal
                    faculty={viewFaculty}
                    onClose={() => setViewFaculty(null)}
                />
            )}
        </div>
    );
}
