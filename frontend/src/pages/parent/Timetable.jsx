import { useState, useEffect, useContext } from "react";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import ThemeSelector from "../../components/ThemeSelector";
import * as parentService from "../../services/parent.service";
import { format12Hour } from "../../utils/timeFormat";
import "../admin/Dashboard.css"; // Reuse dashboard UI
import "./Dashboard.css"; // Parent custom styles

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ParentTimetable() {
    const { user, logout } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [slots, setSlots] = useState([]);
    const [timetable, setTimetable] = useState([]);

    const [students, setStudents] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState("");
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState("");

    // ── Enrolled subject IDs fetched from selected student ──
    const [enrolledSubjectIds, setEnrolledSubjectIds] = useState(new Set());
    const [enrolledSubjectNames, setEnrolledSubjectNames] = useState([]);

    useEffect(() => {
        fetchStudents();
    }, []);

    useEffect(() => {
        if (selectedStudentId) {
            const stu = students.find(s => s.id === parseInt(selectedStudentId));
            
            // ── Store enrolled subject IDs as a Set for O(1) lookup ──
            if (stu && stu.Subjects && stu.Subjects.length > 0) {
                setEnrolledSubjectIds(new Set(stu.Subjects.map(s => s.id)));
                setEnrolledSubjectNames(stu.Subjects.map(s => s.name));
            } else {
                setEnrolledSubjectIds(new Set());
                setEnrolledSubjectNames([]);
            }

            if (stu && stu.Classes && stu.Classes.length > 0) {
                setClasses(stu.Classes);
                setSelectedClass(stu.Classes[0].id);
            } else {
                setClasses([]);
                setSelectedClass("");
                setTimetable([]);
            }
        }
    }, [selectedStudentId, students]);

    useEffect(() => {
        if (selectedClass) {
            fetchStudentTimetable(selectedClass);
        } else {
            setTimetable([]);
        }
    }, [selectedClass]);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const res = await parentService.getParentDashboard();
            const loadedStudents = res.data.students || [];
            if (loadedStudents.length > 0) {
                setStudents(loadedStudents);
                setSelectedStudentId(loadedStudents[0].id.toString());
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error("Error fetching students", error);
            setLoading(false);
        }
    };

    const fetchStudentTimetable = async (classId) => {
        setLoading(true);
        try {
            const [slotsRes, timetableRes] = await Promise.all([
                api.get("/timetable/slots"),
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

    if (loading && students.length === 0) {
        return <div className="parent-dashboard-container">Loading Timetable...</div>;
    }

    return (
        <div className="parent-dashboard-container">
            <header className="dashboard-header">
                <div>
                    <h1>📅 Master Timetable</h1>
                    <p>View the weekly class schedule for your children.</p>
                </div>
                <div className="dashboard-header-right" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <ThemeSelector />
                    <button onClick={logout} className="btn-logout">Logout</button>
                    <button className="btn btn-secondary" onClick={() => window.location.href = "/parent/dashboard"}>
                        ← Back to Dashboard
                    </button>
                </div>
            </header>

            <div className="dashboard-content">
                {students.length > 0 && (
                    <div className="filter-container" style={{ marginBottom: "2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                            <div>
                                <span className="filter-label" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>Select Student:</span>
                                <select
                                    className="form-select"
                                    style={{ minWidth: "250px", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border-color)" }}
                                    value={selectedStudentId}
                                    onChange={(e) => setSelectedStudentId(e.target.value)}
                                >
                                    {students.map(stu => (
                                        <option key={stu.id} value={stu.id}>{stu.User?.name} ({stu.roll_number})</option>
                                    ))}
                                </select>
                            </div>
                            {classes.length > 0 && (
                                <div>
                                    <span className="filter-label" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>Select Class:</span>
                                    <select
                                        className="form-select"
                                        style={{ minWidth: "250px", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border-color)" }}
                                        value={selectedClass}
                                        onChange={(e) => setSelectedClass(e.target.value)}
                                    >
                                        {classes.map(cls => (
                                            <option key={cls.id} value={cls.id}>{cls.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                        
                        {/* ── Enrolled Subjects Info Banner ── */}
                        {enrolledSubjectNames.length > 0 && (
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '8px',
                                alignItems: 'center',
                                padding: '0.85rem 1.2rem',
                                background: 'var(--bg-card, #f8fafc)',
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)',
                            }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '4px' }}>
                                    📚 Enrolled subjects:
                                </span>
                                {enrolledSubjectNames.map((name, i) => (
                                    <span key={i} style={{
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        padding: '3px 10px',
                                        borderRadius: '999px',
                                        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                        color: '#fff',
                                        letterSpacing: '0.02em'
                                    }}>
                                        {name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {students.length === 0 ? (
                    <div className="dashboard-card" style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
                        No students linked to your account.
                    </div>
                ) : classes.length === 0 ? (
                    <div className="dashboard-card" style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
                        Selected student is not enrolled in any classes.
                    </div>
                ) : slots.length === 0 ? (
                    <div className="dashboard-card" style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
                        No time slots or schedules have been set up by the institute administrators.
                    </div>
                ) : (
                    <div className="dashboard-card" style={{ overflowX: "auto" }}>
                        <table className="table timetable-table mobile-keep" style={{ minWidth: "800px", width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr>
                                    <th style={{ width: "120px", padding: "1rem", borderBottom: "2px solid var(--border-color)" }}></th>
                                    {DAYS_OF_WEEK.map(day => (
                                        <th key={day} style={{ textAlign: "center", background: 'var(--bg-light, #f8fafc)', padding: "1rem", borderBottom: "2px solid var(--border-color)" }}>{day}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {slots.map((slot, idx) => (
                                    <tr key={slot.id}>
                                        <td className="time-slot-label" style={{ padding: "1rem", borderBottom: "1px solid var(--border-color)" }}>
                                            <strong style={{ display: "block", color: "var(--text-primary)" }}>Period {idx + 1}</strong>
                                            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{format12Hour(slot.start_time)} - {format12Hour(slot.end_time)}</span>
                                        </td>
                                        {DAYS_OF_WEEK.map(day => {
                                            const entry = timetable.find(t => t.slot_id === slot.id && t.day_of_week === day);

                                            // ── Only show entry if the student is enrolled in that subject ──
                                            const isEnrolled = entry && enrolledSubjectIds.has(entry.subject_id);

                                            let colorClass = "pill-color-0";
                                            if (isEnrolled) {
                                                colorClass = `pill-color-${entry.subject_id % 7}`;
                                            }

                                            return (
                                                <td key={`${slot.id}-${day}`} style={{ padding: "1rem", borderBottom: "1px solid var(--border-color)", textAlign: "center" }}>
                                                    {isEnrolled ? (
                                                        <div className={`timetable-pill ${colorClass}`} style={{ padding: "0.75rem", borderRadius: "8px", background: "var(--bg-hover, #f1f5f9)" }}>
                                                            <strong style={{ display: "block", color: "var(--text-primary)" }}>{entry.Subject?.name}</strong>
                                                            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                                                                👤 {entry.Faculty?.User?.name}
                                                            </div>
                                                            {entry.room_number && (
                                                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "3px", fontWeight: 500 }}>
                                                                    🚪 Room {entry.room_number}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="timetable-pill" style={{ backgroundColor: 'transparent', border: '1px dashed var(--border-color)', color: 'var(--text-muted)', padding: "0.75rem", borderRadius: "8px", height: "100%" }}>
                                                            -
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ParentTimetable;
