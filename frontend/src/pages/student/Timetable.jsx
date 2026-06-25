import { useState, useEffect, useContext, useMemo, useCallback } from "react";
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
    const [viewMode, setViewMode] = useState(window.innerWidth <= 768 ? "list" : "week");
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    // Enrolled subject IDs fetched from /students/me
    const [enrolledSubjectIds, setEnrolledSubjectIds] = useState(new Set());
    const [enrolledSubjectNames, setEnrolledSubjectNames] = useState([]);

    // Date Navigation State
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);


        fetchStudentData();

        return () => window.removeEventListener('resize', handleResize);
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

    // ── Pre-compute Timetable Map for O(1) Lookups ──
    // Create a dictionary: "slotId-dayOfWeek" -> entry
    const timetableMap = useMemo(() => {
        const map = new Map();
        timetable.forEach(t => {
            map.set(`${t.slot_id}-${t.day_of_week}`, t);
        });
        return map;
    }, [timetable]);

    // Pre-calculate enrolled days per slot to fast-track break condition
    const daySubjectBoundaries = useMemo(() => {
        const boundaries = {};
        DAYS_OF_WEEK.forEach(day => {
            let firstSubjectSlotTime = null;
            let lastSubjectSlotTime = null;

            slots.forEach(slot => {
                const entry = timetableMap.get(`${slot.id}-${day}`);
                if (entry && !entry.is_break && enrolledSubjectIds.has(entry.subject_id)) {
                    if (!firstSubjectSlotTime || slot.start_time < firstSubjectSlotTime) firstSubjectSlotTime = slot.start_time;
                    if (!lastSubjectSlotTime || slot.start_time > lastSubjectSlotTime) lastSubjectSlotTime = slot.start_time;
                }
            });
            boundaries[day] = { first: firstSubjectSlotTime, last: lastSubjectSlotTime };
        });
        return boundaries;
    }, [slots, timetableMap, enrolledSubjectIds]);

    const shouldShowBreak = useCallback((day, currentSlot) => {
        const bounds = daySubjectBoundaries[day];
        if (!bounds || !bounds.first || !bounds.last) return false;
        return currentSlot.start_time > bounds.first && currentSlot.start_time < bounds.last;
    }, [daySubjectBoundaries]);

    const activeSlots = useMemo(() => {
        return slots.filter(slot => {
            return DAYS_OF_WEEK.some(day => {
                const t = timetableMap.get(`${slot.id}-${day}`);
                if (!t) return false;
                if (t.is_break) return shouldShowBreak(day, slot);
                return enrolledSubjectIds.has(t.subject_id);
            });
        });
    }, [slots, timetableMap, shouldShowBreak, enrolledSubjectIds]);

    if (loading) {
        return <div className="tt-v2-container" style={{ padding: '3rem', textAlign: 'center' }}>Loading Class Schedule...</div>;
    }

    return (
        <div className="tt-v2-container">
            {/* ── Header ── */}
            {!isMobile && (
                <div className="tt-v2-header" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: '1.5rem', justifyContent: 'space-between' }}>
                    <div className="tt-v2-header-left" style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', textAlign: 'left' }}>
                        {/* Calendar Icon */}
                        <div className="tt-v2-header-icon" style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '10px', fontSize: '1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', margin: 0 }}>
                            📅
                        </div>
                        
                        {/* Titles */}
                        <div className="tt-v2-header-titles" style={{ flex: 1 }}>
                            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>My Class Timetable</h1>
                            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>Your weekly class schedule for enrolled subjects.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Mobile Hero Banner ── */}
            {isMobile && (
                <div className="tt-v2-hero-banner">
                    <div className="tt-v2-hero-left">
                        <div className="tt-v2-hero-icon-wrapper">
                            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                        </div>
                        <div className="tt-v2-hero-text">
                            <h2>My Timetable</h2>
                            <p>Your weekly class schedule</p>
                        </div>
                    </div>
                    <div className="tt-v2-hero-right">
                        <div className="tt-v2-hero-graphic">
                            📅<span>✨</span>
                        </div>
                    </div>
                </div>
            )}

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
                                            const entry = timetableMap.get(`${slot.id}-${day}`);

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
                                    const entry = timetableMap.get(`${slot.id}-${day}`);
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
