import { useState, useEffect, useContext, useMemo } from "react";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import "../admin/Dashboard.css";

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const CLASS_COLORS = [
    { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9', dot: '#8b5cf6' }, // Purple
    { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', dot: '#3b82f6' }, // Blue
    { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', dot: '#22c55e' }, // Green
    { bg: '#fffbeb', border: '#fef08a', text: '#b45309', dot: '#eab308' }, // Yellow
    { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', dot: '#ef4444' }, // Red
];

const getWeekDates = () => {
    const dates = [];
    const today = new Date();
    const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay(); // 1 = Mon, 7 = Sun
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + 1);
    for (let i = 0; i < 6; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }));
    }
    return dates;
};

function FacultySchedule() {
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [myTimetable, setMyTimetable] = useState([]);
    const [classTimetables, setClassTimetables] = useState({});
    const [slots, setSlots] = useState([]);
    const [selectedClass, setSelectedClass] = useState('all');
    const [weekDates] = useState(getWeekDates());

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
                    classMap.set(t.Class.id, t.Class.name);
                }
            }
        });
        const classesArray = Array.from(classMap, ([id, name]) => ({ id, name }));
        classesArray.sort((a, b) => a.name.localeCompare(b.name));
        return classesArray;
    }, [myTimetable]);

    const getClassStyle = (className) => {
        const idx = myClasses.findIndex(c => c.name === className);
        if (idx === -1) return CLASS_COLORS[0];
        return CLASS_COLORS[idx % CLASS_COLORS.length];
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
                <div style={{ textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'pulse 2s infinite' }}>📅</div>
                    <p style={{ fontWeight: '500' }}>Loading Schedule...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '1.5rem 2rem', background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', background: '#f5f3ff', color: '#6d28d9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a', fontWeight: '700' }}>My Teaching Schedule</h2>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', marginTop: '0.2rem' }}>View your weekly class timetable. Your subjects are highlighted.</p>
                    </div>
                </div>
            </div>

            {/* Filter Bar & Legend */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Class Filter</label>
                        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={{ padding: '0.6rem 2.5rem 0.6rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 0.75rem center/16px', appearance: 'none', fontWeight: '500', color: '#334155', minWidth: '160px' }}>
                            <option value="all">All Classes</option>
                            {myClasses.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', background: '#f8fafc', padding: '0.75rem 1.25rem', borderRadius: '30px' }}>
                    {myClasses.map(c => {
                        const style = getClassStyle(c.name);
                        return (
                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: '#334155' }}>
                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: style.dot }}></div>
                                {c.name}
                            </div>
                        );
                    })}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#cbd5e1' }}></div>
                        Free Slot
                    </div>
                </div>
            </div>

            {/* Timetable Grid */}
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'center' }}>
                        <thead>
                            <tr>
                                <th style={{ padding: '1.5rem 1rem', color: '#64748b', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #f1f5f9', width: '120px' }}>TIME</th>
                                {DAYS_OF_WEEK.map((day, idx) => (
                                    <th key={day} style={{ padding: '1.5rem 1rem', borderBottom: '1px solid #f1f5f9', minWidth: '150px' }}>
                                        <div style={{ color: '#0f172a', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{DAY_SHORT[idx]}</div>
                                        <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '500', marginTop: '0.2rem' }}>{weekDates[idx]}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {slots.map((slot, idx) => {
                                // Simple mock for Lunch Break if there's a big gap or specific slot pattern. Let's assume period 5 is lunch.
                                const isLunch = idx === 4; 
                                if (isLunch) {
                                    return (
                                        <tr key="lunch">
                                            <td style={{ padding: '1.5rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: '#1e293b', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                                                {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                                            </td>
                                            <td colSpan={6} style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                                                <div style={{ background: '#fffbeb', color: '#b45309', borderRadius: '8px', padding: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                                                    Lunch Break
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }

                                return (
                                    <tr key={slot.id}>
                                        <td style={{ padding: '1.5rem 1rem', fontSize: '0.85rem', fontWeight: '600', color: '#1e293b', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                                        </td>
                                        
                                        {DAYS_OF_WEEK.map(day => {
                                            const entry = selectedClass === 'all' 
                                                ? myTimetable.find(t => t.slot_id === slot.id && t.day_of_week === day)
                                                : classTimetables[selectedClass]?.find(t => t.slot_id === slot.id && t.day_of_week === day);
                                            
                                            if (entry) {
                                                const isMySubject = myTimetable.some(myT => myT.id === entry.id);
                                                const style = selectedClass === 'all' || isMySubject 
                                                    ? getClassStyle(entry.Class?.name) 
                                                    : { bg: '#f8fafc', border: '#e2e8f0', text: '#475569', dot: '#94a3b8' };

                                                return (
                                                    <td key={`${slot.id}-${day}`} style={{ padding: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                                                        <div style={{ background: style.bg, border: `1px solid ${style.border}`, borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-start', textAlign: 'left', minHeight: '80px', transition: 'transform 0.2s', cursor: 'pointer' }} className="timetable-card">
                                                            <strong style={{ color: style.text, fontSize: '0.95rem' }}>{entry.Subject?.name || 'N/A'}</strong>
                                                            <div style={{ color: isMySubject || selectedClass === 'all' ? '#475569' : '#64748b', fontSize: '0.8rem', fontWeight: isMySubject ? '700' : '500' }}>
                                                                {selectedClass === 'all' ? (
                                                                    entry.Class?.name
                                                                ) : (
                                                                    isMySubject ? '(Your Class)' : entry.Faculty?.User?.name || 'No Faculty'
                                                                )}
                                                            </div>
                                                            {entry.room_number && (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: style.text, fontSize: '0.75rem', fontWeight: '600', marginTop: 'auto', paddingTop: '0.5rem' }}>
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                                                    Room {entry.room_number}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            } else {
                                                return (
                                                    <td key={`${slot.id}-${day}`} style={{ padding: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                                                        <div style={{ border: '1.5px dashed #e2e8f0', borderRadius: '10px', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#94a3b8', minHeight: '80px', fontSize: '0.85rem', fontWeight: '600' }}>
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>
                                                            Free
                                                        </div>
                                                    </td>
                                                );
                                            }
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <style>{`
                .timetable-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                }
            `}</style>
        </div>
    );
}

export default FacultySchedule;
