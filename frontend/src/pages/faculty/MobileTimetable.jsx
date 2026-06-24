import { useState, useEffect, useContext, useMemo } from "react";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import "../student/StudentTimetableV2.css"; // Reuse student styles
import "./MobileMarkAttendance.css"; // Reuse banner styles

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function FacultyMobileTimetable() {
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [myTimetable, setMyTimetable] = useState([]);
    const [classTimetables, setClassTimetables] = useState({});
    const [slots, setSlots] = useState([]);
    const [selectedClass, setSelectedClass] = useState('all');
    const [viewMode, setViewMode] = useState('week');
    
    // Date Navigation State
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        if (user) {
            fetchMySchedule();
        } else {
            setLoading(false);
        }
    }, [user]);

    const fetchMySchedule = async () => {
        setLoading(true);
        try {
            const slotsRes = await api.get("/timetable/slots");
            setSlots(slotsRes.data.data || []);

            const response = await api.get(`/timetable/faculty/me`);
            const myTs = response.data.data || [];
            setMyTimetable(myTs);

            const myClassIds = [...new Set(myTs.filter(t => t.class_id).map(t => t.class_id))];
            const classRes = await Promise.all(
                myClassIds.map(id => api.get(`/timetable/class/${id}`))
            );

            const classMap = {};
            myClassIds.forEach((id, index) => {
                classMap[id] = classRes[index].data.data || [];
            });
            setClassTimetables(classMap);
        } catch (error) {
            console.error("Error fetching my schedule", error);
        } finally {
            setLoading(false);
        }
    };

    const myClasses = useMemo(() => {
        const classMap = new Map();
        myTimetable.forEach(t => {
            if (t.Class && t.Class.id) {
                if (!classMap.has(t.Class.id)) {
                    classMap.set(t.Class.id, `${t.Class.name} ${t.Class.section ? `- ${t.Class.section}` : ''}`.trim());
                }
            }
        });
        const classesArray = Array.from(classMap, ([id, name]) => ({ id, name }));
        classesArray.sort((a, b) => a.name.localeCompare(b.name));
        return classesArray;
    }, [myTimetable]);

    const uniqueTimeSlots = useMemo(() => {
        const timeSet = new Set();
        const unique = [];
        
        const relevantClassIds = selectedClass === 'all' 
            ? myClasses.map(c => c.id.toString()) 
            : [selectedClass.toString()];

        slots.forEach(slot => {
            if (!slot.start_time || !slot.end_time) return;
            if (slot.class_id && !relevantClassIds.includes(slot.class_id.toString())) {
                return;
            }
            const timeKey = `${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)}`;
            if (!timeSet.has(timeKey)) {
                timeSet.add(timeKey);
                unique.push(slot);
            }
        });
        unique.sort((a, b) => a.start_time.localeCompare(b.start_time));
        return unique;
    }, [slots, selectedClass, myClasses]);

    // ── Date Navigation Logic ──
    const getStartOfWeek = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
        return new Date(d.setDate(diff));
    };

    const handlePrevWeek = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
    const handleNextWeek = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
    const handleToday = () => setCurrentDate(new Date());

    const startOfWeek = getStartOfWeek(currentDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday

    const formatMonthDay = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dateRangeStr = `${formatMonthDay(startOfWeek)} \u2013 ${formatMonthDay(endOfWeek)}, ${endOfWeek.getFullYear()}`;

    const weekDates = DAYS_OF_WEEK.map((dayName, idx) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + idx);
        return {
            name: dayName.substring(0, 3), 
            dateStr: formatMonthDay(d)
        };
    });

    const getSubjectColorTheme = (subjectName) => {
        const name = (subjectName || '').toLowerCase();
        if (name.includes('science')) return { bg: 'tt-v2-bg-blue', text: 'tt-v2-text-blue', pill: 'tt-v2-pill-blue' };
        if (name.includes('math')) return { bg: 'tt-v2-bg-purple', text: 'tt-v2-text-purple', pill: 'tt-v2-pill-purple' };
        if (name.includes('english')) return { bg: 'tt-v2-bg-green', text: 'tt-v2-text-green', pill: 'tt-v2-pill-green' };
        if (name.includes('history') || name.includes('social')) return { bg: 'tt-v2-bg-orange', text: 'tt-v2-text-orange', pill: 'tt-v2-pill-orange' };
        return { bg: 'tt-v2-bg-blue', text: 'tt-v2-text-blue', pill: 'tt-v2-pill-blue' }; 
    };

    if (loading) {
        return <div className="tt-v2-container" style={{ padding: '3rem', textAlign: 'center' }}>Loading Schedule...</div>;
    }

    return (
        <div className="tt-v2-container">
            {/* Hero Banner */}
            <div className="mma-hero-banner" style={{ margin: "0 0 16px 0", padding: "16px" }}>
                <div className="mma-hero-left">
                    <div className="mma-hero-icon-wrapper" style={{ color: "#6366f1" }}>
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                    </div>
                    <div className="mma-hero-text">
                        <h2>My Teaching Schedule</h2>
                        <p>View your weekly class timetable.</p>
                    </div>
                </div>
                <div className="mma-hero-right">
                    <div className="mma-hero-graphic">
                        📅<span style={{ fontSize: "20px" }}>⏰</span>
                    </div>
                </div>
            </div>

            {/* Class Filter */}
            <div className="mma-filters-section" style={{ margin: "0 0 16px 0" }}>
                <div className="mma-filter-group">
                    <label style={{ textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>Class Filter</label>
                    <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                    >
                        <option value="all">All Classes</option>
                        {myClasses.map(cls => (
                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Controls Row */}
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

            {/* Timetable List View / Week View */}
            <div className="tt-v2-grid-container">
                {uniqueTimeSlots.length === 0 ? (
                    <div style={{ padding: "4rem", textAlign: "center", color: "#94a3b8" }}>
                        No time slots available for selected filter.
                    </div>
                ) : (
                    viewMode === 'week' ? (
                        <div style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
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
                                    {uniqueTimeSlots.map(slot => (
                                        <tr key={slot.id || `${slot.start_time}-${slot.end_time}`}>
                                            <td className="time-col">
                                                {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                                            </td>
                                            {DAYS_OF_WEEK.map(day => {
                                                let entry = null;

                                                if (selectedClass === 'all') {
                                                    entry = myTimetable.find(t => t.TimetableSlot?.start_time === slot.start_time && t.TimetableSlot?.end_time === slot.end_time && t.day_of_week === day);
                                                    
                                                    if (!entry) {
                                                        for (const classId in classTimetables) {
                                                            const breakEntry = classTimetables[classId]?.find(t => t.TimetableSlot?.start_time === slot.start_time && t.TimetableSlot?.end_time === slot.end_time && t.day_of_week === day && t.is_break);
                                                            if (breakEntry) {
                                                                entry = breakEntry;
                                                                break;
                                                            }
                                                        }
                                                    }
                                                } else {
                                                    entry = classTimetables[selectedClass]?.find(t => t.TimetableSlot?.start_time === slot.start_time && t.TimetableSlot?.end_time === slot.end_time && t.day_of_week === day);
                                                }

                                                if (!entry) {
                                                    return (
                                                        <td key={`${slot.start_time}-${day}`}>
                                                            <div className="tt-v2-cell-empty">-</div>
                                                        </td>
                                                    );
                                                }

                                                if (entry.is_break) {
                                                    return (
                                                        <td key={`${slot.start_time}-${day}`}>
                                                            <div className="tt-v2-cell-break">
                                                                <span className="tt-v2-break-icon">☕</span>
                                                                <span className="tt-v2-break-label">{entry.break_label || 'Break'}</span>
                                                            </div>
                                                        </td>
                                                    );
                                                }

                                                const isMySubject = myTimetable.some(myT => myT.id === entry.id);
                                                const theme = getSubjectColorTheme(entry.Subject?.name || '');
                                                const notMineStyle = (!isMySubject && selectedClass === 'all') ? { opacity: 0.7, border: '1px dashed #cbd5e1' } : {};

                                                return (
                                                    <td key={`${slot.start_time}-${day}`}>
                                                        <div className={`tt-v2-cell-card ${isMySubject || selectedClass !== 'all' ? theme.bg : ''}`} style={{ ...(isMySubject || selectedClass !== 'all' ? {} : { background: '#f8fafc'}), ...notMineStyle }}>
                                                            <div className={`tt-v2-cell-subject ${isMySubject || selectedClass !== 'all' ? theme.text : ''}`} style={{ ...(isMySubject || selectedClass !== 'all' ? {} : { color: '#475569'}) }}>
                                                                {entry.Subject?.name || 'N/A'}
                                                            </div>
                                                            <div className="tt-v2-cell-detail">
                                                                👤 {selectedClass === 'all' ? entry.Class?.name : (isMySubject ? '(Your Class)' : entry.Faculty?.User?.name || 'No Faculty')}
                                                            </div>
                                                            {entry.room_number && (
                                                                <div className="tt-v2-cell-detail">
                                                                    📍 Room {entry.room_number}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ padding: "1.5rem" }}>
                        {DAYS_OF_WEEK.map((day, idx) => {
                            const dayEntries = uniqueTimeSlots.map(slot => {
                                let entry = null;

                                if (selectedClass === 'all') {
                                    entry = myTimetable.find(t => t.TimetableSlot?.start_time === slot.start_time && t.TimetableSlot?.end_time === slot.end_time && t.day_of_week === day);
                                    
                                    if (!entry) {
                                        for (const classId in classTimetables) {
                                            const breakEntry = classTimetables[classId]?.find(t => t.TimetableSlot?.start_time === slot.start_time && t.TimetableSlot?.end_time === slot.end_time && t.day_of_week === day && t.is_break);
                                            if (breakEntry) {
                                                entry = breakEntry;
                                                break;
                                            }
                                        }
                                    }
                                } else {
                                    entry = classTimetables[selectedClass]?.find(t => t.TimetableSlot?.start_time === slot.start_time && t.TimetableSlot?.end_time === slot.end_time && t.day_of_week === day);
                                }

                                if (!entry) return null; // free slot
                                return { slot, entry };
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
                                                    <div key={`${slot.start_time}-${day}`} style={{ display: "flex", alignItems: "center", background: "linear-gradient(135deg, #FFF8E1, #FFF3CD)", border: "1.5px dashed #F59E0B", borderRadius: "12px", padding: "1rem" }}>
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
                                            const isMySubject = myTimetable.some(myT => myT.id === entry.id);
                                            const theme = getSubjectColorTheme(entry.Subject?.name || '');
                                            
                                            // Make it fade out slightly if it's not our subject
                                            const notMineStyle = (!isMySubject && selectedClass === 'all') ? { opacity: 0.7, background: '#f8fafc', border: '1px dashed #cbd5e1' } : {};

                                            return (
                                                <div key={`${slot.start_time}-${day}`} style={{ display: "flex", alignItems: "center", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1rem", boxShadow: "0 1px 2px rgba(0,0,0,0.02)", ...notMineStyle }}>
                                                    <div style={{ width: "120px", fontWeight: "600", color: "#64748b", fontSize: "0.85rem", borderRight: "1px solid #e2e8f0", marginRight: "1rem" }}>
                                                        {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                                                    </div>
                                                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                                                        <div className={`tt-v2-pill ${isMySubject || selectedClass !== 'all' ? theme.pill : ''}`} style={{ fontSize: "0.8rem", padding: "6px 14px", ...(isMySubject || selectedClass !== 'all' ? {} : { background: '#e2e8f0', color: '#475569'}) }}>
                                                            {entry.Subject?.name || 'N/A'}
                                                        </div>
                                                        <div style={{ fontSize: "0.85rem", color: "#475569", display: "flex", gap: "1.5rem", flexWrap: "wrap", fontWeight: "500" }}>
                                                            <span>👤 {
                                                                selectedClass === 'all' ? (
                                                                    entry.Class?.name
                                                                ) : (
                                                                    isMySubject ? '(Your Class)' : entry.Faculty?.User?.name || 'No Faculty'
                                                                )
                                                            }</span>
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

            {/* Legend */}
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
                </div>
            </div>
        </div>
    );
}

export default FacultyMobileTimetable;
