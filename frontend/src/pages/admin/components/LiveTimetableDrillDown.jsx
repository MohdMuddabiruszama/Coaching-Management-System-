import { useState, useEffect } from "react";
import api from "../../../services/api";
import { format12Hour } from "../../../utils/timeFormat";
import "./LiveTimetableDrillDown.css";

function LiveTimetableDrillDown({ periodId, date, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // For manual mark
    const [studentRows, setStudentRows] = useState([]);

    const fetchDrillDown = async () => {
        try {
            const res = await api.get(`/live-timetable/${periodId}?date=${date}`);
            if (res.data.success) {
                setData(res.data);
                // Initialize local state for bulk editing
                setStudentRows(res.data.students || []);
            }
        } catch (err) {
            console.error("Failed to load drill down", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDrillDown();
    }, [periodId, date]);

    const handleStatusChange = (studentId, newStatus) => {
        setStudentRows(rows => rows.map(r => {
            if (r.student_id === studentId) {
                const now = new Date();
                const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                return {
                    ...r,
                    status: newStatus,
                    time_in: newStatus === 'present' && !r.time_in ? timeStr : r.time_in
                };
            }
            return r;
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = studentRows.map(r => ({
                student_id: r.student_id,
                time_in: r.time_in,
                time_out: r.time_out,
                status: r.status,
                remarks: r.remarks
            }));
            const res = await api.post(`/live-timetable/${periodId}/bulk-mark`, {
                date,
                students: payload
            });
            if (res.data.success) {
                onClose(); // Automatically close and refresh board
            }
        } catch (err) {
            console.error("Failed to save attendance", err);
            alert("Failed to save. Check console for details.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="ltd-overlay">
                <div className="ltd-modal loading">
                    <div className="spinner"></div>
                    <p>Loading class details...</p>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const { entry, faculty, summary, is_live, period_state } = data;

    return (
        <div className="ltd-overlay">
            <div className="ltd-modal">
                <div className="ltd-header">
                    <div className="ltd-header-left">
                        <span className={`lt-badge ${period_state}`}>
                            {is_live && <span className="lt-pulse"></span>}
                            {period_state.toUpperCase()}
                        </span>
                        <h2>{entry.subject?.name}</h2>
                        <span className="ltd-class-name">{entry.class}</span>
                    </div>
                    <button className="ltd-close" onClick={onClose}>✕</button>
                </div>

                <div className="ltd-body">
                    <div className="ltd-meta-bar">
                        <div className="ltd-meta-item">
                            <label>Time</label>
                            <span>{entry.start_time} - {entry.end_time}</span>
                        </div>
                        <div className="ltd-meta-item">
                            <label>Room</label>
                            <span>{entry.room || 'N/A'}</span>
                        </div>
                        <div className="ltd-meta-item">
                            <label>Faculty</label>
                            <span>
                                {faculty?.name} 
                                {faculty?.status === 'present' ? ' (In)' : ' (Not Marked)'}
                            </span>
                        </div>
                        <div className="ltd-meta-item">
                            <label>Students</label>
                            <span>{summary.present} / {summary.total} Present</span>
                        </div>
                    </div>

                    <div className="ltd-table-wrapper">
                        <table className="ltd-table">
                            <thead>
                                <tr>
                                    <th>Roll No</th>
                                    <th>Student Name</th>
                                    <th>Time In</th>
                                    <th>Time Out</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {studentRows.map(student => (
                                    <tr key={student.student_id}>
                                        <td>{student.roll_number || '-'}</td>
                                        <td>
                                            <div className="ltd-student-name">
                                                <div className="ltd-avatar">
                                                    {student.profile_image ? (
                                                        <img src={student.profile_image} alt="" />
                                                    ) : (
                                                        student.name.charAt(0)
                                                    )}
                                                </div>
                                                {student.name}
                                            </div>
                                        </td>
                                        <td>{student.time_in ? format12Hour(student.time_in) : '--:--'}</td>
                                        <td>{student.time_out || '--:--'}</td>
                                        <td>
                                            <select 
                                                value={student.status} 
                                                onChange={(e) => handleStatusChange(student.student_id, e.target.value)}
                                                className={`ltd-status-select ${student.status}`}
                                            >
                                                <option value="present">Present</option>
                                                <option value="absent">Absent</option>
                                                <option value="late">Late</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                                {studentRows.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="ltd-empty">No students found in this class.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="ltd-footer">
                    <button className="ltd-btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="ltd-btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default LiveTimetableDrillDown;
