/**
 * ManagerAttendanceStats.jsx
 * Read-only daily attendance overview for manager mobile.
 * 1 API call: GET /api/attendance/dashboard
 * Shows: overall %, class-wise breakdown, absent student list.
 */
import { useState, useEffect, useCallback } from "react";
import api from "../../services/api";
import "./ManagerAttendanceStats.css";

function todayStr() {
    return new Date().toISOString().split("T")[0];
}

function pctClass(pct) {
    if (pct >= 75) return "high";
    if (pct >= 50) return "mid";
    return "low";
}

function ManagerAttendanceStats() {
    const [date, setDate] = useState(todayStr());
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchData = useCallback(async (d) => {
        setLoading(true);
        try {
            const res = await api.get("/attendance/dashboard", { params: { date: d } });
            const data = res.data.data || res.data;
            setSummary(data);
        } catch (e) {
            console.error("Attendance stats error:", e);
            setSummary(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(date); }, [date, fetchData]);

    const handleDateChange = (e) => {
        setDate(e.target.value);
    };

    const overall = summary?.today?.percentage ?? 0;
    const present = summary?.today?.present ?? 0;
    const total   = summary?.today?.total ?? 0;
    const absent  = summary?.today?.absent ?? 0;
    const classes = summary?.pending_classes || [];
    const absentStudents = summary?.lowAttendanceStudents || [];

    return (
        <div className="mas-page">
            <div className="mas-header">
                <h2 className="mas-title">📊 Attendance Stats</h2>
                <p className="mas-subtitle">Read-only daily overview</p>
            </div>

            {/* Date Selector */}
            <div className="mas-date-row">
                <input
                    type="date"
                    className="mas-date-input"
                    value={date}
                    max={todayStr()}
                    onChange={handleDateChange}
                />
                <button
                    className="mas-refresh-btn"
                    onClick={() => fetchData(date)}
                    aria-label="Refresh"
                >
                    🔄
                </button>
            </div>

            {/* Loading */}
            {loading && (
                <div className="mas-loading">
                    <div className="mas-spinner" />
                    Loading attendance...
                </div>
            )}

            {!loading && summary && (
                <>
                    {/* Summary Card */}
                    <div className="mas-summary-card">
                        <div className="mas-summary-stat">
                            <p className="mas-summary-num">{Math.round(overall)}%</p>
                            <p className="mas-summary-lbl">Overall Rate</p>
                        </div>
                        <div className="mas-summary-divider" />
                        <div className="mas-summary-stat">
                            <p className="mas-summary-num">{present}</p>
                            <p className="mas-summary-lbl">Present</p>
                        </div>
                        <div className="mas-summary-divider" />
                        <div className="mas-summary-stat">
                            <p className="mas-summary-num">{absent}</p>
                            <p className="mas-summary-lbl">Absent</p>
                        </div>
                    </div>

                    {/* Class Breakdown */}
                    {classes.length > 0 && (
                        <>
                            <p className="mas-section-title">Class-wise Breakdown</p>
                            <div className="mas-class-list">
                                {classes.map((c, i) => {
                                    const pct = Math.round(c.attendance_rate ?? c.rate ?? c.percentage ?? 0);
                                    const cls = pctClass(pct);
                                    return (
                                        <div key={i} className="mas-class-card">
                                            <div className="mas-class-top">
                                                <p className="mas-class-name">{c.class_name || c.name}</p>
                                                <span className={`mas-class-pct ${cls}`}>{pct}%</span>
                                            </div>
                                            <div className="mas-progress-track">
                                                <div
                                                    className={`mas-progress-fill ${cls}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <p className="mas-class-meta">
                                                {c.present ?? 0} present · {c.absent ?? 0} absent · {c.total ?? 0} total
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* Absent Students */}
                    {absentStudents.length > 0 && (
                        <div className="mas-absent-section">
                            <div className="mas-absent-header">
                                <p className="mas-absent-title">Low Attendance (&lt;75%)</p>
                                <span className="mas-absent-count">{absentStudents.length}</span>
                            </div>
                            <div className="mas-absent-list">
                                {absentStudents.slice(0, 30).map((s, i) => (
                                    <div key={i} className="mas-absent-item">
                                        <div className="mas-absent-dot" />
                                        <span className="mas-absent-name">Roll No: {s.roll_number}</span>
                                        <span className="mas-absent-class">{s.percentage}%</span>
                                    </div>
                                ))}
                                {absentStudents.length > 30 && (
                                    <p style={{ fontSize: "12px", color: "#94a3b8", margin: "6px 0 0", textAlign: "center" }}>
                                        +{absentStudents.length - 30} more. See full report on desktop.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {!loading && !summary && (
                <div className="mas-empty">
                    <span className="mas-empty-icon">📋</span>
                    No attendance data for this date.
                </div>
            )}
        </div>
    );
}

export default ManagerAttendanceStats;
