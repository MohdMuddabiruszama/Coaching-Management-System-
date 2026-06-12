import { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import "./StudentTimetableV2.css";
import "../admin/Students.css";

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function StudentTimetable() {
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [slots, setSlots] = useState([]);
    const [timetable, setTimetable] = useState([]);
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [viewMode, setViewMode] = useState("week"); // 'week' or 'list'

    // Enrolled subject IDs fetched from /students/me
    const [enrolledSubjectIds, setEnrolledSubjectIds] = useState(new Set());
    const [enrolledSubjectNames, setEnrolledSubjectNames] = useState([]);

    // Date Navigation State
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        fetchStudentData();
    }, []);

    useEffect(() => {
        if (selectedClass) {
            fetchStudentTimetable(selectedClass);
        } else {
            setTimetable([]);
        }
    }, [selectedClass]);

    const fetchStudentData = async () => {
        setLoading(true);
        try {
            const res = await api.get("/students/me");
            const studentData = res.data.data;

            if (studentData?.Subjects?.length > 0) {
                setEnrolledSubjectIds(new Set(studentData.Subjects.map(s => s.id)));
                setEnrolledSubjectNames(studentData.Subjects.map(s => s.name));
            }

            if (studentData && studentData.Classes && studentData.Classes.length > 0) {
                setClasses(studentData.Classes);
                setSelectedClass(studentData.Classes[0].id);
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error("Error fetching student data", error);
            setLoading(false);
        }
    };

    const fetchStudentTimetable = async (classId) => {
        setLoading(true);
        try {
            const [slotsRes, timetableRes] = await Promise.all([
                api.get(`/timetable/slots?class_id=${classId}`),
                api.get(`/timetable/class/${classId}`)
            ]);
            setSlots(slotsRes.data.data || []);
            setTimetable(timetableRes.data.data || []);
        } catch (error) {
            console.error("Error fetching timetable", error);
        } finally {
            setLoading(false);
        }
    };

    // ── Date Navigation Logic ──
    const getStartOfWeek = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        return new Date(d.setDate(diff));
    };

    const handlePrevWeek = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
    };

    const handleNextWeek = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    const startOfWeek = getStartOfWeek(currentDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday

    const formatMonthDay = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dateRangeStr = `${formatMonthDay(startOfWeek)} \u2013 ${formatMonthDay(endOfWeek)}, ${endOfWeek.getFullYear()}`;

    // Generate dates for Mon-Sat
    const weekDates = DAYS_OF_WEEK.map((dayName, idx) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + idx);
        return {
            name: dayName.substring(0, 3), // Mon, Tue, etc.
            dateStr: formatMonthDay(d)
        };
    });

    // ── Color Theme Logic ──
    const getSubjectColorTheme = (subjectName) => {
        const name = subjectName.toLowerCase();
        if (name.includes('science')) return { bg: 'tt-v2-bg-blue', text: 'tt-v2-text-blue', pill: 'tt-v2-pill-blue' };
        if (name.includes('math')) return { bg: 'tt-v2-bg-purple', text: 'tt-v2-text-purple', pill: 'tt-v2-pill-purple' };
        if (name.includes('english')) return { bg: 'tt-v2-bg-green', text: 'tt-v2-text-green', pill: 'tt-v2-pill-green' };
        if (name.includes('history') || name.includes('social')) return { bg: 'tt-v2-bg-orange', text: 'tt-v2-text-orange', pill: 'tt-v2-pill-orange' };
        return { bg: 'tt-v2-bg-blue', text: 'tt-v2-text-blue', pill: 'tt-v2-pill-blue' }; // default
    };

    if (loading) {
        return <div className="tt-v2-container" style={{ padding: '3rem', textAlign: 'center' }}>Loading Class Schedule...</div>;
    }

    // Helper to determine if a break should be shown on a specific day for this student
    // Rule: Show break ONLY if the student has an enrolled class BEFORE the break AND AFTER the break on that day.
    const shouldShowBreak = (day, currentSlot) => {
        let hasClassBefore = false;
        let hasClassAfter = false;

        for (const otherSlot of slots) {
            const otherEntry = timetable.find(t => t.slot_id === otherSlot.id && t.day_of_week === day);
            if (otherEntry && !otherEntry.is_break && enrolledSubjectIds.has(otherEntry.subject_id)) {
                if (otherSlot.start_time < currentSlot.start_time) {
                    hasClassBefore = true;
                }
                if (otherSlot.start_time > currentSlot.start_time) {
                    hasClassAfter = true;
                }
            }
            if (hasClassBefore && hasClassAfter) return true;
        }
        return false;
    };

    // Include slots that have a scheduled subject for the current class
    // OR a break, but ONLY IF the break satisfies the before/after condition for at least one day
    const activeSlots = slots.filter(slot =>
        timetable.some(t => {
            if (t.slot_id !== slot.id) return false;
            if (t.is_break) {
                return shouldShowBreak(t.day_of_week, slot);
            }
            return enrolledSubjectIds.has(t.subject_id);
        })
    );

    return (
        <div className="tt-v2-container">
            {/* ── Header ── */}
            <div className="st-header">
                <div className="st-header-top-row">
                    <div className="st-header-left">
                        <h1>My Class Timetable</h1>
                        <p>Your weekly class schedule for enrolled subjects.</p>
                    </div>
                </div>
                <div className="st-header-bottom-row">
                    <div className="st-breadcrumbs">
                        <span>Dashboard</span>
                        <span>›</span>
                        <span className="active">My Class Timetable</span>
                    </div>
                    <div className="st-header-actions">
                    </div>
                </div>
            </div>

            {/* ── Top Banner ── */}
            <div className="tt-v2-top-banner">
                <div className="tt-v2-enrolled-card">
                    <div className="tt-v2-enrolled-icon">📖</div>
                    <div>
                        <div className="tt-v2-enrolled-title">Enrolled Subjects</div>
                        <div className="tt-v2-pills">
                            {enrolledSubjectNames.length > 0 ? enrolledSubjectNames.map((name, i) => {
                                const theme = getSubjectColorTheme(name);
                                return (
                                    <div key={i} className={`tt-v2-pill ${theme.pill}`}>
                                        {name}
                                    </div>
                                );
                            }) : (
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>None</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="tt-v2-academic-card">
                    <div className="tt-v2-academic-icon">🕓</div>
                    <div>
                        <div className="tt-v2-enrolled-title">Academic Year</div>
                        <div className="tt-v2-academic-val">2025 - 2026</div>
                    </div>
                </div>
            </div>

            {classes.length > 1 && (
                <div style={{ marginBottom: "1rem" }}>
                    <select
                        style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                    >
                        {classes.map(cls => (
                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* ── Controls Row ── */}
            <div className="tt-v2-controls" style={{ position: 'relative' }}>
                <div className="tt-v2-date-nav">
                    <button className="tt-v2-btn-today" onClick={handleToday}>Today</button>
                    <button className="tt-v2-btn-arrow" onClick={handlePrevWeek}>&lt;</button>
                    <button className="tt-v2-btn-arrow" onClick={handleNextWeek}>&gt;</button>
                </div>
                <div className="tt-v2-date-range">
                    {dateRangeStr}
                </div>
                <div className="tt-v2-view-toggles">
                    <button 
                        className={`tt-v2-view-btn ${viewMode === 'week' ? 'active' : ''}`}
                        style={{ background: viewMode === 'week' ? '#6366f1' : '#fff', color: viewMode === 'week' ? '#fff' : '#64748b' }}
                        onClick={() => setViewMode('week')}
                    >
                        ▦ Week View
                    </button>
                    <button 
                        className={`tt-v2-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                        style={{ background: viewMode === 'list' ? '#6366f1' : '#fff', color: viewMode === 'list' ? '#fff' : '#64748b' }}
                        onClick={() => setViewMode('list')}
                    >
                        ☷ List View
                    </button>
                </div>
            </div>

            {/* ── Timetable Grid / List View ── */}
            <div className="tt-v2-grid-container">
                {activeSlots.length === 0 ? (
                    <div style={{ padding: "4rem", textAlign: "center", color: "#94a3b8" }}>
                        No time slots or schedules have been set up by the institute administrators.
                    </div>
                ) : (
                    viewMode === 'week' ? (
                        <table className="tt-v2-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "100px" }}>Time</th>
                                    {weekDates.map((dayObj, i) => (
                                        <th key={i}>
                                            <div>{dayObj.name}</div>
                                            <div className="date">{dayObj.dateStr}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {activeSlots.map(slot => (
                                    <tr key={slot.id}>
                                        <td className="time-col">
                                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                                        </td>
                                        {DAYS_OF_WEEK.map(day => {
                                            const entry = timetable.find(t => t.slot_id === slot.id && t.day_of_week === day);

                                            // Break period
                                            if (entry && entry.is_break) {
                                                if (shouldShowBreak(day, slot)) {
                                                    return (
                                                        <td key={`${slot.id}-${day}`}>
                                                            <div className="tt-v2-cell-break">
                                                                <span className="tt-v2-break-icon">☕</span>
                                                                <span className="tt-v2-break-label">{entry.break_label || 'Break'}</span>
                                                            </div>
                                                        </td>
                                                    );
                                                } else {
                                                    return (
                                                        <td key={`${slot.id}-${day}`}>
                                                            <div className="tt-v2-cell-empty">-</div>
                                                        </td>
                                                    );
                                                }
                                            }

                                            const isEnrolled = entry && enrolledSubjectIds.has(entry.subject_id);

                                            if (isEnrolled) {
                                                const theme = getSubjectColorTheme(entry.Subject?.name || '');
                                                return (
                                                    <td key={`${slot.id}-${day}`}>
                                                        <div className={`tt-v2-cell-card ${theme.bg}`}>
                                                            <div className={`tt-v2-cell-subject ${theme.text}`}>
                                                                {entry.Subject?.name}
                                                            </div>
                                                            <div className="tt-v2-cell-detail">
                                                                👤 {entry.Faculty?.User?.name || 'TBA'}
                                                            </div>
                                                            {entry.room_number && (
                                                                <div className="tt-v2-cell-detail">
                                                                    📍 Room {entry.room_number}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            }

                                            return (
                                                <td key={`${slot.id}-${day}`}>
                                                    <div className="tt-v2-cell-empty">-</div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{ padding: "1.5rem" }}>
                            {DAYS_OF_WEEK.map((day, idx) => {
                                const dayEntries = activeSlots.map(slot => {
                                    const entry = timetable.find(t => t.slot_id === slot.id && t.day_of_week === day);
                                    if (!entry) return null;
                                    // Include breaks and enrolled subjects conditionally
                                    if (entry.is_break) {
                                        return shouldShowBreak(day, slot) ? { slot, entry } : null;
                                    }
                                    if (enrolledSubjectIds.has(entry.subject_id)) return { slot, entry };
                                    return null;
                                }).filter(Boolean);

                                if (dayEntries.length === 0) return null;

                                return (
                                    <div key={day} style={{ marginBottom: "2rem" }}>
                                        <h3 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#0f172a", marginBottom: "1rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.5rem" }}>
                                            {day}, {weekDates[idx].dateStr}
                                        </h3>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                            {dayEntries.map(({ slot, entry }) => {
                                                if (entry.is_break) {
                                                    return (
                                                        <div key={slot.id} style={{ display: "flex", alignItems: "center", background: "linear-gradient(135deg, #FFF8E1, #FFF3CD)", border: "1.5px dashed #F59E0B", borderRadius: "12px", padding: "1rem" }}>
                                                            <div style={{ width: "120px", fontWeight: "600", color: "#64748b", fontSize: "0.85rem", borderRight: "1px solid #FDE68A", marginRight: "1rem" }}>
                                                                {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                                                            </div>
                                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                                <span style={{ fontSize: "1.1rem" }}>☕</span>
                                                                <span style={{ fontWeight: "700", color: "#92400E", fontSize: "0.9rem" }}>{entry.break_label || 'Break'}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                const theme = getSubjectColorTheme(entry.Subject?.name || '');
                                                return (
                                                    <div key={slot.id} style={{ display: "flex", alignItems: "center", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1rem", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                                                        <div style={{ width: "120px", fontWeight: "600", color: "#64748b", fontSize: "0.85rem", borderRight: "1px solid #e2e8f0", marginRight: "1rem" }}>
                                                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                                                        </div>
                                                        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                                                            <div className={`tt-v2-pill ${theme.pill}`} style={{ fontSize: "0.8rem", padding: "6px 14px" }}>
                                                                {entry.Subject?.name}
                                                            </div>
                                                            <div style={{ fontSize: "0.85rem", color: "#475569", display: "flex", gap: "1.5rem", flexWrap: "wrap", fontWeight: "500" }}>
                                                                <span>👤 {entry.Faculty?.User?.name || 'TBA'}</span>
                                                                {entry.room_number && <span>📍 Room {entry.room_number}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                )}
            </div>

            {/* ── Legend ── */}
            <div className="tt-v2-legend">
                <div className="tt-v2-legend-left">
                    <div className="tt-v2-legend-item">
                        <div className="tt-v2-dot" style={{ background: '#3b82f6' }}></div> Science
                    </div>
                    <div className="tt-v2-legend-item">
                        <div className="tt-v2-dot" style={{ background: '#a855f7' }}></div> Mathematics
                    </div>
                    <div className="tt-v2-legend-item">
                        <div className="tt-v2-dot" style={{ background: '#22c55e' }}></div> English
                    </div>
                    <div className="tt-v2-legend-item">
                        <div className="tt-v2-dot" style={{ background: '#F59E0B' }}></div> Break
                    </div>
                    <div className="tt-v2-legend-item" style={{ marginLeft: '1rem', color: '#64748b' }}>
                        👤 Teacher
                    </div>
                    <div className="tt-v2-legend-item" style={{ color: '#64748b' }}>
                        📍 Room
                    </div>
                </div>
                <div className="tt-v2-legend-right">
                    ⓘ Timetable is subject to change. Please check regularly for updates.
                </div>
            </div>

        </div>
    );
}

export default StudentTimetable;
