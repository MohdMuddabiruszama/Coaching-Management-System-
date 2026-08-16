import { useAdminDashboard } from "../../hooks/useMobileDashboard";
import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "./MobileDashboard.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatCurrency = (amount) => {
    if (!amount || isNaN(amount)) return "₹0";
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(amount);
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const KPICard = ({ title, displayValue, percentage = 0, icon, colorClass, subLabel = "", dimmed = false }) => (
    <div className={`mad-card${dimmed ? " mad-card-dimmed" : ""}`}>
        <div className="mad-card-top">
            <div className={`mad-card-icon icon-${colorClass}`}>{icon}</div>
            <div className="mad-card-info">
                <span className="mad-card-title">{title}</span>
                <span className={`mad-card-value${dimmed ? " dimmed-value" : ""}`}>{displayValue}</span>
            </div>
        </div>
        <div className="mad-card-progress-wrapper">
            <div className="mad-progress-track">
                <div
                    className={`mad-progress-fill fill-${colorClass}`}
                    style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                />
            </div>
            <div className="mad-progress-labels">
                <span className="label-left">{subLabel}</span>
                <span className="label-right">{dimmed ? "N/A" : `${percentage}%`}</span>
            </div>
        </div>
    </div>
);

const QuickAction = ({ icon, label, onClick }) => (
    <button className="mad-quick-btn" onClick={onClick} type="button">
        <div className="mad-quick-icon-circle">{icon}</div>
        <span className="mad-quick-label">{label}</span>
    </button>
);

// ─── Skeleton card shown during loading ───────────────────────────────────────
const SkeletonCard = () => (
    <div className="mad-card mad-skeleton-card">
        <div className="mad-skeleton-icon" />
        <div className="mad-skeleton-lines">
            <div className="mad-skeleton-line short" />
            <div className="mad-skeleton-line" />
        </div>
        <div className="mad-skeleton-bar" />
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MobileDashboard() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const { data: response, isLoading, isError, refetch, isFetching } = useAdminDashboard({
        retry: 2,
        retryDelay: 1500,
        staleTime: 3 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const fullName = user?.name?.split(" ")[0] || "Admin";
    const metrics  = response?.data?.metrics;

    // ── Always build 8 KPI cards — use fallback zeros when API is down ──────────
    const buildCards = (m) => [
        {
            title: "Total Admins",
            displayValue: m ? `${m.admins?.active ?? 0} / ${m.admins?.limit ?? 5}` : "-- / --",
            percentage: m?.admins?.percentage ?? 0,
            icon: "👑",
            colorClass: "purple",
            subLabel: "Capacity",
        },
        {
            title: "Total Managers",
            displayValue: m ? `${m.managers?.active ?? 0} / ${m.managers?.limit ?? 5}` : "-- / --",
            percentage: m?.managers?.percentage ?? 0,
            icon: "👔",
            colorClass: "blue",
            subLabel: "Capacity",
        },
        {
            title: "Total Students",
            displayValue: m ? `${m.students?.active ?? m.totalStudents ?? 0} / ${m.students?.limit ?? 9999}` : "-- / --",
            percentage: m?.students?.percentage ?? 0,
            icon: "🎓",
            colorClass: "yellow",
            subLabel: "Enrolled",
        },
        {
            title: "Total Faculty",
            displayValue: m ? `${m.faculty?.active ?? m.totalFaculty ?? 0} / ${m.faculty?.limit ?? 999}` : "-- / --",
            percentage: m?.faculty?.percentage ?? 0,
            icon: "👨‍🏫",
            colorClass: "orange",
            subLabel: "Capacity",
        },
        {
            title: "Total Classes",
            displayValue: m ? `${m.classes?.active ?? 0} / ${m.classes?.limit ?? 50}` : "-- / --",
            percentage: m?.classes?.percentage ?? 0,
            icon: "🏫",
            colorClass: "red",
            subLabel: "Active",
        },
        {
            title: "Active Students",
            displayValue: m ? `${m.activeStudents?.count ?? 0}` : "--",
            percentage: m?.students?.percentage ?? 0,
            icon: "⚡",
            colorClass: "green",
            subLabel: "Live",
        },
        {
            title: "Total Due Fees",
            displayValue: m ? formatCurrency(m.dueFees ?? m.pendingFeesAmount ?? 0) : "--",
            percentage: (m?.dueFees ?? m?.pendingFeesAmount ?? 0) > 0 ? 75 : 0,
            icon: "⚠️",
            colorClass: "red",
            subLabel: "Pending",
        },
        {
            title: "Discount Given",
            displayValue: m ? formatCurrency(m.discountGiven ?? 0) : "--",
            percentage: (m?.discountGiven ?? 0) > 0 ? 100 : 0,
            icon: "🏷️",
            colorClass: "purple",
            subLabel: "Total",
        },
    ];

    // Always 8 cards — when API fails, shows "--" placeholders instead of blank
    const kpiCards = buildCards(metrics);

    return (
        <div className="mad-container">
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="mad-header-area">
                <div className="mad-header-text">
                    <h2 className="mad-greeting">
                        Good {getTimeOfDay()},<br />
                        {fullName} 👋
                    </h2>
                    <p className="mad-greeting-sub">
                        {isError
                            ? "Unable to reach server. Showing offline view."
                            : "Here's your institute overview."}
                    </p>
                </div>
                <button
                    className={`mad-date-btn ${isFetching ? "mad-btn-spinning" : ""}`}
                    onClick={() => refetch()}
                    type="button"
                    title="Refresh"
                >
                    <span>{isFetching ? "⏳" : "🔄"}</span>
                    {isFetching ? "..." : "Refresh"}
                </button>
            </div>

            {/* ── Error Banner (non-blocking) ─────────────────────────────────── */}
            {isError && !isLoading && (
                <div className="mad-error-banner">
                    <span>⚠️ Could not load live data.</span>
                    <button onClick={() => refetch()} type="button">Retry</button>
                </div>
            )}

            {/* ── KPI Grid — always renders 8 cards ─────────────────────────── */}
            <div className="mad-kpi-grid">
                {isLoading
                    ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
                    : kpiCards.map((card) => (
                        <KPICard
                            key={card.title}
                            {...card}
                            dimmed={isError && !metrics}
                        />
                      ))}
            </div>

            {/* ── Quick Actions ───────────────────────────────────────────────── */}
            <div>
                <div className="mad-section-header">
                    <h3 className="mad-section-title">Quick Actions</h3>
                </div>
                <div className="mad-quick-actions-grid">
                    <QuickAction icon="👥" label="Students"  onClick={() => navigate("/admin/students")} />
                    <QuickAction icon="👨‍🏫" label="Faculty"   onClick={() => navigate("/admin/faculty")} />
                    <QuickAction icon="📚" label="Classes"   onClick={() => navigate("/admin/classes")} />
                    <QuickAction icon="👨‍👩‍👦" label="Parents"   onClick={() => navigate("/admin/parents")} />
                    <QuickAction icon="📅" label="Timetable" onClick={() => navigate("/admin/timetable")} />
                    <QuickAction icon="💰" label="Fees"      onClick={() => navigate("/admin/fees")} />
                    <QuickAction icon="📢" label="Announce"  onClick={() => navigate("/admin/announcements")} />
                </div>
            </div>
        </div>
    );
}

// Helper: Time-of-day greeting
function getTimeOfDay() {
    const h = new Date().getHours();
    if (h < 12) return "morning";
    if (h < 17) return "afternoon";
    return "evening";
}
