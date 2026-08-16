/**
 * MobileStudents.jsx — Admin Mobile Student Management
 *
 * Mobile-optimized redesign of the Students page for Admin.
 * Matches the design from img1 (stats cards + list) adapted to mobile.
 *
 * API: 2 calls only — GET /students + GET /classes
 * Does NOT modify the web Students.jsx.
 */

import { useState, useEffect, useContext, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import "./MobileStudents.css";

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
    <div className="mst-stat-card">
        <div className="mst-stat-top">
            <div className="mst-stat-icon" style={{ background: iconBg }}>{icon}</div>
            <div className="mst-stat-info">
                <span className="mst-stat-label">{label}</span>
                <span className="mst-stat-value">{value}</span>
                <span className="mst-stat-sub">{sub}</span>
            </div>
        </div>
        <div className="mst-stat-spark">
            <Sparkline color={sparkColor} points={sparkPoints} />
        </div>
    </div>
);

// ── Student Row Card ──────────────────────────────────────────────────────────
const StudentCard = ({ student, onView, onCard, onCredentials }) => {
    const name  = student.User?.name || student.name || "Student";
    const classText = student.Classes?.length > 0 
        ? student.Classes.map(c => `${c.name}${c.section ? ` - ${c.section}` : ""}`).join(", ") 
        : "—";
    const roll  = student.roll_number || "—";
    const phone = student.User?.phone || student.phone || "N/A";
    const email = student.User?.email || student.email || "N/A";
    const status = student.student_status || "active";
    const initial = name.charAt(0).toUpperCase();
    const isActive = status === "active";

    return (
        <div className="mst-student-card" onClick={() => onView(student)}>
            {/* Avatar + Info */}
            <div className="mst-sc-left">
                <div className="mst-sc-avatar" style={{ background: avatarColor(name) }}>
                    {initial}
                </div>
                <div className="mst-sc-info">
                    <span className="mst-sc-name">{name}</span>
                    <span className="mst-sc-class">{classText}</span>
                    <span className="mst-sc-roll">{roll}</span>
                    <span className={`mst-sc-status ${isActive ? "active" : "inactive"}`}>
                        {isActive ? "● Active" : "● Inactive"}
                    </span>
                </div>
            </div>
            {/* Contact + Actions */}
            <div className="mst-sc-right">
                <div className="mst-sc-contact">
                    <span className="mst-sc-phone">📞 {phone}</span>
                    <span className="mst-sc-email">✉ {email !== "N/A" ? email.substring(0, 14) + (email.length > 14 ? "…" : "") : "N/A"}</span>
                </div>
                <div className="mst-sc-actions" onClick={e => e.stopPropagation()}>
                    <button className="mst-action-btn cred-btn" onClick={() => onCredentials(student)}>
                        🔑 Login
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Skeleton Row ──────────────────────────────────────────────────────────────
const SkeletonRow = () => (
    <div className="mst-student-card mst-skeleton">
        <div className="mst-sc-left">
            <div className="mst-skel-circle" />
            <div className="mst-skel-lines">
                <div className="mst-skel-line w70" />
                <div className="mst-skel-line w50" />
                <div className="mst-skel-line w40" />
            </div>
        </div>
        <div className="mst-sc-right">
            <div className="mst-skel-lines">
                <div className="mst-skel-line w60" />
                <div className="mst-skel-line w50" />
            </div>
        </div>
    </div>
);

// ── Student Detail Modal ───────────────────────────────────────────────────────
const StudentDetailModal = ({ student, onClose }) => {
    const name  = student.User?.name  || student.name  || "—";
    const email = student.User?.email || student.email || "—";
    const phone = student.User?.phone || student.phone || "—";
    const classText = student.Classes?.length > 0 
        ? student.Classes.map(c => `${c.name}${c.section ? ` - ${c.section}` : ""}`).join(", ") 
        : "—";
    const roll  = student.roll_number || "—";
    const dob   = student.date_of_birth || "—";
    const adm   = student.admission_date || "—";
    const status = student.student_status || "active";

    return (
        <div className="mst-modal-overlay" onClick={onClose}>
            <div className="mst-modal mst-detail-modal" onClick={e => e.stopPropagation()}>
                <div className="mst-modal-header">
                    <h3>Student Profile</h3>
                    <button className="mst-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="mst-detail-avatar-row">
                    <div className="mst-detail-avatar" style={{ background: avatarColor(name) }}>
                        {name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="mst-detail-name">{name}</div>
                        <span className={`mst-sc-status ${status === "active" ? "active" : "inactive"}`}>
                            ● {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                    </div>
                </div>
                <div className="mst-detail-grid">
                    {[
                        ["📚 Class",      classText],
                        ["🎫 Roll No",    roll],
                        ["📞 Phone",      phone],
                        ["✉️ Email",      email],
                        ["🎂 DOB",        dob],
                        ["📅 Admission",  adm],
                        ["👤 Gender",     student.gender || "—"],
                    ].map(([label, val]) => (
                        <div className="mst-detail-row" key={label}>
                            <span className="mst-detail-label">{label}</span>
                            <span className="mst-detail-val">{val}</span>
                        </div>
                    ))}
                </div>
                <div className="mst-modal-footer">
                    <button className="mst-btn-save" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

// ── Main Component ─────────────────────────────────────────────────────────────
export default function MobileStudents() {
    const { user } = useContext(AuthContext);
    const navigate  = useNavigate();

    // ── Data ──────────────────────────────────────────────────────────────────
    const [students, setStudents]   = useState([]);
    const [classes,  setClasses]    = useState([]);
    const [totalCount, setTotal]    = useState(0);
    const [loading, setLoading]     = useState(true);

    // ── Filters ───────────────────────────────────────────────────────────────
    const [search,      setSearch]      = useState("");
    const [classFilter, setClassFilter] = useState("all");
    const [statusFilter,setStatus]      = useState("all");
    const [showFilters, setShowFilters] = useState(false);

    // ── Modals ────────────────────────────────────────────────────────────────
    const [viewStudent,setViewSt]     = useState(null);
    const [credentialsData, setCredentialsData] = useState([]);
    const [showCredentials, setShowCredentials] = useState(false);
    const [loadingCreds, setLoadingCreds] = useState(false);

    // ── Fetch (2 calls max, parallel) ─────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: "200" });
            if (search.trim())     params.set("search",   search.trim());
            if (classFilter !== "all") params.set("class_id", classFilter);

            const [stRes, clRes] = await Promise.all([
                api.get(`/students?${params}`),
                classes.length === 0 ? api.get("/classes") : Promise.resolve(null),
            ]);

            const raw = stRes.data.data || [];
            setStudents(raw);
            setTotal(stRes.data.count || raw.length);
            if (clRes) setClasses(clRes.data.data || []);
        } catch (e) {
            console.error("MobileStudents fetch error:", e);
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, classFilter]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ── Derived stats ─────────────────────────────────────────────────────────
    const activeCount   = students.filter(s => (s.student_status || "active") === "active").length;
    const activeClasses = new Set(students.map(s => s.class_id).filter(Boolean)).size;
    const enrollRate    = activeClasses > 0 && classes.length > 0
        ? Math.round((activeClasses / classes.length) * 100)
        : 100;

    // ── Client-side status filter ─────────────────────────────────────────────
    const displayed = statusFilter === "all"
        ? students
        : students.filter(s => (s.student_status || "active") === statusFilter);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleCredentials = async (student) => {
        setLoadingCreds(true);
        try {
            const res = await api.post('/students/credentials', { student_ids: [student.id] });
            if (res.data.success) {
                setCredentialsData(res.data.data);
                setShowCredentials(true);
            }
        } catch (err) {
            console.error('Error fetching credentials:', err);
            alert('Failed to fetch credentials');
        } finally {
            setLoadingCreds(false);
        }
    };

    return (
        <div className="mst-page">
            {/* ── Page Header ─────────────────────────────────────────────── */}
            <div className="mst-page-header">
                <div>
                    <h1 className="mst-page-title">Student Management</h1>
                    <p className="mst-page-sub">Manage students and enrollments</p>
                </div>
            </div>

            {/* ── Stats Grid 2×2 ─────────────────────────────────────────── */}
            <div className="mst-stats-grid">
                <StatCard
                    icon="👥" iconBg="rgba(124,58,237,0.12)"
                    label="Total Students" value={loading ? "—" : totalCount}
                    sub="All registered students"
                    sparkColor="#7C3AED"
                    sparkPoints="0,20 12,14 24,17 36,8 48,11 60,5 72,3"
                />
                <StatCard
                    icon="✅" iconBg="rgba(5,150,105,0.12)"
                    label="Active Students" value={loading ? "—" : activeCount}
                    sub="Currently active"
                    sparkColor="#059669"
                    sparkPoints="0,18 12,10 24,14 36,6 48,9 60,4 72,2"
                />
                <StatCard
                    icon="🏫" iconBg="rgba(37,99,235,0.12)"
                    label="Active Classes" value={loading ? "—" : activeClasses}
                    sub="Classes have students"
                    sparkColor="#2563EB"
                    sparkPoints="0,22 12,16 24,18 36,10 48,13 60,7 72,5"
                />
                <StatCard
                    icon="📋" iconBg="rgba(217,119,6,0.12)"
                    label="Enrollment Rate" value={loading ? "—" : `${enrollRate}%`}
                    sub="Based on active classes"
                    sparkColor="#D97706"
                    sparkPoints="0,20 12,12 24,16 36,8 48,10 60,4 72,2"
                />
            </div>

            {/* ── Search + Filter Row ─────────────────────────────────────── */}
            <div className="mst-search-row">
                <div className="mst-search-wrap">
                    <span className="mst-search-icon">🔍</span>
                    <input
                        className="mst-search-input"
                        placeholder="Search by name, roll no., email or phone…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button className="mst-search-clear" onClick={() => setSearch("")}>✕</button>
                    )}
                </div>
                <button
                    className={`mst-filter-toggle ${showFilters ? "active" : ""}`}
                    onClick={() => setShowFilters(v => !v)}
                >
                    ⚙️ Filters
                </button>
            </div>

            {/* ── Expanded Filters ────────────────────────────────────────── */}
            {showFilters && (
                <div className="mst-filters-panel">
                    <select
                        className="mst-filter-select"
                        value={classFilter}
                        onChange={e => setClassFilter(e.target.value)}
                    >
                        <option value="all">All Classes</option>
                        {classes.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.name}{c.section ? ` · ${c.section}` : ""}
                            </option>
                        ))}
                    </select>
                    <select
                        className="mst-filter-select"
                        value={statusFilter}
                        onChange={e => setStatus(e.target.value)}
                    >
                        <option value="all">● All Status</option>
                        <option value="active">● Active</option>
                        <option value="inactive">● Inactive</option>
                        <option value="graduated">Graduated</option>
                        <option value="dropped">Dropped</option>
                    </select>
                </div>
            )}

            {/* ── List Header ─────────────────────────────────────────────── */}
            <div className="mst-list-header">
                <span className="mst-list-count">All Students ({displayed.length})</span>
            </div>

            {/* ── Student List ─────────────────────────────────────────────── */}
            <div className="mst-list">
                {loading
                    ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                    : displayed.length === 0
                        ? (
                            <div className="mst-empty">
                                <span>👤</span>
                                <p>No students found</p>
                            </div>
                        )
                        : displayed.map(s => (
                            <StudentCard
                                key={s.id}
                                student={s}
                                onView={setViewSt}
                                onCredentials={handleCredentials}
                            />
                        ))
                }
            </div>

            {/* ── Modals ──────────────────────────────────────────────────── */}
            {viewStudent && (
                <StudentDetailModal
                    student={viewStudent}
                    onClose={() => setViewSt(null)}
                />
            )}
            {showCredentials && (
                <div className="mst-modal-overlay" onClick={() => setShowCredentials(false)}>
                    <div className="mst-modal" onClick={e => e.stopPropagation()}>
                        <div className="mst-modal-header">
                            <h3>Student Credentials</h3>
                            <button className="mst-modal-close" onClick={() => setShowCredentials(false)}>✕</button>
                        </div>
                        <div className="mst-modal-body" style={{ padding: "16px" }}>
                            {credentialsData.map((cred, i) => (
                                <div key={i} style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", marginBottom: "8px" }}>
                                    <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: "600" }}>{cred.name}</p>
                                    <p style={{ margin: "0 0 4px", fontSize: "13px", color: "#475569" }}><strong>Email:</strong> {cred.email}</p>
                                    <p style={{ margin: "0", fontSize: "13px", color: "#475569" }}><strong>Password:</strong> {cred.password || "********"}</p>
                                </div>
                            ))}
                        </div>
                        <div className="mst-modal-footer">
                            <button className="mst-btn-save" onClick={() => setShowCredentials(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
            {loadingCreds && (
                <div className="mst-modal-overlay">
                    <div style={{ color: "white", fontWeight: "bold" }}>Fetching Credentials...</div>
                </div>
            )}
        </div>
    );
}
