import { useState, useEffect } from "react";
import api from "../../services/api";
import "./AdminTimetable.css";

const CalendarIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
);
const ClockIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
);
const PlusIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);
const InfoIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
);
const PrinterIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
);
const ArrowLeftIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
);
const CloseIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);
const GripIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
);
const TrashIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
);
const EditIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
);

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatAMPM(timeString) {
    if (!timeString) return "";
    let [hours, minutes] = timeString.split(':');
    hours = parseInt(hours);
    let ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    let strTime = hours.toString().padStart(2, '0') + ':' + minutes + ' ' + ampm;
    return strTime;
}

function AdminTimetable() {
    const [loading, setLoading] = useState(true);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [faculty, setFaculty] = useState([]);
    const [slots, setSlots] = useState([]);
    const [timetable, setTimetable] = useState([]);

    const [selectedClass, setSelectedClass] = useState("");

    // Modal States
    const [showSlotModal, setShowSlotModal] = useState(false);
    const [showEntryModal, setShowEntryModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingEntry, setEditingEntry] = useState(null);
    const [editForm, setEditForm] = useState({
        day_of_week: "Monday",
        slot_id: "",
        subject_id: "",
        faculty_id: "",
        room_number: "",
        is_break: false,
        break_label: "Break"
    });

    // Form States
    const [slotForm, setSlotForm] = useState({ start_time: "", end_time: "" });
    const [editingSlotId, setEditingSlotId] = useState(null);
    const [entryForm, setEntryForm] = useState({
        day_of_week: "Monday",
        slot_id: "",
        subject_id: "",
        faculty_id: "",
        room_number: "",
        is_break: false,
        break_label: "Break"
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (selectedClass) {
            fetchTimetableAndSlots(selectedClass);
        } else {
            setTimetable([]);
            setSlots([]);
        }
    }, [selectedClass]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const ts = new Date().getTime();
            const [classesRes, subjectsRes, facultyRes] = await Promise.all([
                api.get(`/classes?limit=500&t=${ts}`),
                api.get(`/subjects?limit=500&t=${ts}`),
                api.get(`/faculty?limit=500&t=${ts}`)
            ]);

            setClasses(classesRes.data.data || []);
            setSubjects(subjectsRes.data.data || []);
            setFaculty(facultyRes.data.data || []);
        } catch (error) {
            console.error("Error fetching initial data", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTimetableAndSlots = async (classId) => {
        try {
            const ts = new Date().getTime();
            const [timetableRes, slotsRes] = await Promise.all([
                api.get(`/timetable/class/${classId}?t=${ts}`),
                api.get(`/timetable/slots?class_id=${classId}&t=${ts}`)
            ]);
            setTimetable(timetableRes.data.data || []);
            setSlots(slotsRes.data.data || []);
        } catch (error) {
            console.error("Error fetching class data", error);
        }
    };

    // --- SLOT LOGIC ---
    const handleSlotSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingSlotId) {
                const res = await api.put(`/timetable/slots/${editingSlotId}`, { ...slotForm });
                if (res.data.success) {
                    alert("Time Slot updated successfully!");
                    setSlots(slots.map(s => s.id === editingSlotId ? res.data.data : s));
                    setShowSlotModal(false);
                    setEditingSlotId(null);
                    setSlotForm({ start_time: "", end_time: "" });
                }
            } else {
                const res = await api.post("/timetable/slots", {
                    ...slotForm,
                    class_id: selectedClass
                });
                if (res.data.success) {
                    alert("Time Slot added successfully!");
                    setSlots([...slots, res.data.data]);
                    setShowSlotModal(false);
                    setSlotForm({ start_time: "", end_time: "" });
                }
            }
        } catch (error) {
            console.error("Error saving slot:", error);
            alert("Failed to save slot.");
        }
    };

    const handleEditSlot = (slot) => {
        setEditingSlotId(slot.id);
        setSlotForm({ start_time: slot.start_time, end_time: slot.end_time });
        setShowSlotModal(true);
    };

    const handleDeleteSlot = async (id) => {
        if (!window.confirm("Are you sure? This will delete the time slot.")) return;
        try {
            const res = await api.delete(`/timetable/slots/${id}`);
            if (res.data.success) {
                setSlots(slots.filter(s => s.id !== id));
            }
        } catch (error) {
            console.error("Error deleting slot:", error);
            alert(error.response?.data?.message || "Failed to delete slot.");
        }
    };

    // --- ENTRY LOGIC ---
    const handleEntrySubmit = async (e) => {
        e.preventDefault();
        // Validate required fields
        if (!entryForm.is_break && !entryForm.subject_id) {
            alert("Please select a Subject or mark this as a Break period.");
            return;
        }
        try {
            const payload = {
                ...entryForm,
                class_id: selectedClass
            };
            const res = await api.post("/timetable", payload);
            if (res.data.success) {
                alert(entryForm.is_break ? "Break period added!" : "Timetable entry added!");
                fetchTimetableAndSlots(selectedClass);
                setShowEntryModal(false);
                setEntryForm({ day_of_week: "Monday", slot_id: "", subject_id: "", faculty_id: "", room_number: "", is_break: false, break_label: "Break" });
            }
        } catch (error) {
            console.error("Error adding entry:", error);
            alert(error.response?.data?.message || "Failed to add timetable entry.");
        }
    };

    const handleDeleteEntry = async (id) => {
        if (!window.confirm("Delete this timetable entry?")) return;
        try {
            const res = await api.delete(`/timetable/${id}`);
            if (res.data.success) {
                setTimetable(timetable.filter(t => t.id !== id));
            }
        } catch (error) {
            console.error("Error deleting entry:", error);
            alert("Failed to delete entry.");
        }
    };

    const handleEditEntry = (entry) => {
        setEditingEntry(entry);
        setEditForm({
            day_of_week: entry.day_of_week,
            slot_id: entry.slot_id,
            subject_id: entry.subject_id || "",
            faculty_id: entry.faculty_id || "",
            room_number: entry.room_number || "",
            is_break: entry.is_break || false,
            break_label: entry.break_label || "Break"
        });
        setShowEditModal(true);
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!editForm.is_break && !editForm.subject_id) {
            alert("Please select a Subject or mark this as a Break period.");
            return;
        }
        try {
            const payload = { ...editForm, class_id: selectedClass };
            const res = await api.put(`/timetable/${editingEntry.id}`, payload);
            if (res.data.success) {
                alert("Timetable entry updated!");
                fetchTimetableAndSlots(selectedClass);
                setShowEditModal(false);
                setEditingEntry(null);
            }
        } catch (error) {
            console.error("Error updating entry:", error);
            alert(error.response?.data?.message || "Failed to update timetable entry.");
        }
    };

    if (loading) {
        return <div className="ap-timetable-wrapper">Loading Timetable...</div>;
    }

    return (
        <div className="ap-timetable-wrapper">
            <div className="ap-tt-header">
                <div className="ap-tt-title-group">
                    <div className="ap-tt-icon-bg">
                        <CalendarIcon />
                    </div>
                    <div>
                        <h1 className="ap-tt-title">Weekly Timetable</h1>
                        <p className="ap-tt-subtitle">Class schedule management</p>
                    </div>
                </div>
                <div className="ap-tt-actions">
                    <button className="ap-btn-white" onClick={() => {
                        if (!selectedClass) {
                            alert("Please select a class first to manage its time slots!");
                            return;
                        }
                        setShowSlotModal(true);
                    }}>
                        <ClockIcon /> Manage Time Slots
                    </button>
                    <button className="ap-btn-purple" onClick={() => {
                        if (!selectedClass) {
                            alert("Please select a class first!");
                            return;
                        }
                        setShowEntryModal(true);
                    }}>
                        <PlusIcon /> Assign Subject
                    </button>
                    <button className="ap-btn-white" onClick={() => window.location.href = "/admin/dashboard"}>
                        <ArrowLeftIcon /> Back to Dashboard
                    </button>
                </div>
            </div>

            <div className="ap-tt-filters">
                <div className="ap-tt-filter-left">
                    <span className="ap-tt-filter-label">Select Class Schedule</span>
                    <select
                        className="ap-tt-select"
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                    >
                        <option value="">-- Choose Class --</option>
                        {classes.map(cls => (
                            <option key={cls.id} value={cls.id}>
                                {cls.name} {cls.section ? `- ${cls.section}` : ''}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <button className="ap-btn-white" onClick={() => window.print()}>
                        <PrinterIcon /> View / Print
                    </button>
                </div>
            </div>

            {selectedClass ? (
                slots.length === 0 ? (
                    <div className="ap-tt-grid-card" style={{ padding: "3rem", textAlign: "center" }}>
                        <h3>No Time Slots Available</h3>
                        <p style={{ color: "#64748B" }}>Please create time slots first before assigning subjects to the timetable.</p>
                    </div>
                ) : (
                    <div className="ap-printable-area">
                        <div className="ap-print-only-header">
                            <h2>Class Timetable: {classes.find(c => c.id.toString() === selectedClass.toString())?.name} {classes.find(c => c.id.toString() === selectedClass.toString())?.section ? `- ${classes.find(c => c.id.toString() === selectedClass.toString())?.section}` : ''}</h2>
                        </div>
                        <div className="ap-tt-grid-card">
                            <table className="ap-tt-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "140px", textAlign: "left" }}>PERIOD / TIME</th>
                                    {DAYS_OF_WEEK.map(day => (
                                        <th key={day}>{day}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {slots.map((slot, idx) => (
                                    <tr key={slot.id}>
                                        <td>
                                            <div className="ap-tt-time-col" style={{ position: "relative" }}>
                                                <div className="ap-tt-period-name">Period {idx + 1}</div>
                                                <div className="ap-tt-time-range">
                                                    <ClockIcon />
                                                    {formatAMPM(slot.start_time)} - {formatAMPM(slot.end_time)}
                                                </div>
                                                <div className="ap-tt-action-btns slot-action-btns">
                                                    <button className="ap-tt-edit-btn" onClick={() => handleEditSlot(slot)} title="Edit Period">
                                                        <EditIcon />
                                                    </button>
                                                    <button className="ap-tt-delete-btn" onClick={() => handleDeleteSlot(slot.id)} title="Remove Period">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                        {DAYS_OF_WEEK.map(day => {
                                            const entry = timetable.find(t => t.slot_id === slot.id && t.day_of_week === day);

                                            let themeClass = "tt-theme-6";
                                            if (entry && entry.Subject?.name) {
                                                const name = entry.Subject.name.toLowerCase();
                                                if (name.includes('english')) themeClass = 'tt-theme-0';
                                                else if (name.includes('math')) themeClass = 'tt-theme-1';
                                                else if (name.includes('science') || name.includes('bio') || name.includes('evs')) themeClass = 'tt-theme-2';
                                                else if (name.includes('physics') || name.includes('computer') || name.includes('it')) themeClass = 'tt-theme-3';
                                                else if (name.includes('chem') || name.includes('history') || name.includes('social')) themeClass = 'tt-theme-4';
                                                else if (name.includes('hindi') || name.includes('geography')) themeClass = 'tt-theme-5';
                                                else themeClass = `tt-theme-${(entry.subject_id || 0) % 6}`;
                                            }

                                            return (
                                                <td key={`${slot.id}-${day}`}>
                                                    {entry ? (
                                                        entry.is_break ? (
                                                            <div className="ap-tt-cell tt-break-cell">
                                                                <div className="ap-tt-subject tt-break-label">
                                                                    ☕ {entry.break_label || 'Break'}
                                                                </div>
                                                                <div className="ap-tt-action-btns">
                                                                    <button
                                                                        className="ap-tt-edit-btn"
                                                                        onClick={() => handleEditEntry(entry)}
                                                                        title="Edit Break"
                                                                    >
                                                                        <EditIcon />
                                                                    </button>
                                                                    <button
                                                                        className="ap-tt-delete-btn"
                                                                        onClick={() => handleDeleteEntry(entry.id)}
                                                                        title="Remove Break"
                                                                    >
                                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                        <div className={`ap-tt-cell ${themeClass}`}>
                                                            <div className="ap-tt-subject">{entry.Subject?.name}</div>
                                                            <div className="ap-tt-faculty">
                                                                {entry.Faculty?.User?.name}
                                                            </div>
                                                            {entry.room_number && (
                                                                <div className="ap-tt-room">
                                                                    <div className="ap-tt-room-icon"></div>
                                                                    Room {entry.room_number}
                                                                </div>
                                                            )}
                                                            <div className="ap-tt-action-btns">
                                                                <button
                                                                    className="ap-tt-edit-btn"
                                                                    onClick={() => handleEditEntry(entry)}
                                                                    title="Edit Entry"
                                                                >
                                                                    <EditIcon />
                                                                </button>
                                                                <button
                                                                    className="ap-tt-delete-btn"
                                                                    onClick={() => handleDeleteEntry(entry.id)}
                                                                    title="Remove Entry"
                                                                >
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                        )
                                                    ) : (
                                                        <div className="ap-tt-cell-empty">
                                                            <CalendarIcon />
                                                            No Class
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="ap-tt-footer-info">
                            <InfoIcon />
                            <span>Timetable is effective from {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                    </div>
                    </div>
                )
            ) : (
                <div className="card" style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
                    Select a class from the dropdown above to view or construct its timetable.
                </div>
            )}

            {/* Time Slot Modal */}
            {showSlotModal && (
                <div className="tt-modal-overlay">
                    <div className="tt-modal-content">
                        <div className="tt-modal-header">
                            <div className="tt-modal-header-left">
                                <div className="tt-modal-icon">
                                    <ClockIcon />
                                </div>
                                <div>
                                    <h2 className="tt-modal-title">Manage Time Slots</h2>
                                    <p className="tt-modal-subtitle">Create, edit and manage class time slots</p>
                                </div>
                            </div>
                            <button className="tt-modal-close" onClick={() => { setShowSlotModal(false); setEditingSlotId(null); setSlotForm({ start_time: "", end_time: "" }); }}>
                                <CloseIcon />
                            </button>
                        </div>

                        <div className="tt-modal-body">
                            <div>
                                <div className="tt-section-title">Existing Time Slots</div>
                                {slots.length === 0 ? <p style={{color: '#64748B', fontSize: '0.9rem'}}>No slots defined yet.</p> : (
                                    <div className="tt-slot-list">
                                        {slots.map(s => (
                                            <div key={s.id} className="tt-slot-item">
                                                <div className="tt-slot-item-left">
                                                    <GripIcon />
                                                    {formatAMPM(s.start_time)} - {formatAMPM(s.end_time)}
                                                </div>
                                                <button className="tt-btn-delete-slot" onClick={() => handleDeleteSlot(s.id)}>
                                                    <TrashIcon />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <form id="slotForm" onSubmit={handleSlotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="tt-section-title">Add New Time Slot</div>
                                <div className="tt-form-group">
                                    <label className="tt-form-label">Start Time <span>*</span></label>
                                    <input type="time" className="tt-input" value={slotForm.start_time} onChange={(e) => setSlotForm({ ...slotForm, start_time: e.target.value })} required />
                                </div>
                                <div className="tt-form-group">
                                    <label className="tt-form-label">End Time <span>*</span></label>
                                    <input type="time" className="tt-input" value={slotForm.end_time} onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })} required />
                                </div>
                            </form>
                        </div>
                        <div className="tt-modal-footer">
                            <button type="button" className="ap-btn-white" onClick={() => { setShowSlotModal(false); setEditingSlotId(null); setSlotForm({ start_time: "", end_time: "" }); }}>Cancel</button>
                            <button type="submit" form="slotForm" className="ap-btn-purple">{editingSlotId ? "Update Time Slot" : "Add Time Slot"}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Entry Assignment Modal */}
            {showEntryModal && (
                <div className="tt-modal-overlay">
                    <div className="tt-modal-content">
                        <div className="tt-modal-header">
                            <div className="tt-modal-header-left">
                                <div className="tt-modal-icon">
                                    <CalendarIcon />
                                </div>
                                <div>
                                    <h2 className="tt-modal-title">Assign Subject to Timetable</h2>
                                    <p className="tt-modal-subtitle">Assign a subject, faculty and room to the selected time slot</p>
                                </div>
                            </div>
                            <button className="tt-modal-close" onClick={() => setShowEntryModal(false)}>
                                <CloseIcon />
                            </button>
                        </div>

                        <div className="tt-modal-body">
                            <form id="entryForm" onSubmit={handleEntrySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="tt-form-group">
                                    <label className="tt-form-label">Day of Week <span>*</span></label>
                                    <select className="tt-input" value={entryForm.day_of_week} onChange={(e) => setEntryForm({ ...entryForm, day_of_week: e.target.value })} required>
                                        {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div className="tt-form-group">
                                    <label className="tt-form-label">Time Slot <span>*</span></label>
                                    <select className="tt-input" value={entryForm.slot_id} onChange={(e) => setEntryForm({ ...entryForm, slot_id: e.target.value })} required>
                                        <option value="">-- Choose Time --</option>
                                        {slots.map(s => <option key={s.id} value={s.id}>{formatAMPM(s.start_time)} - {formatAMPM(s.end_time)}</option>)}
                                    </select>
                                </div>

                                {/* Break Toggle */}
                                <div className="tt-break-toggle-row">
                                    <label className="tt-break-toggle-label">
                                        <input
                                            type="checkbox"
                                            checked={entryForm.is_break}
                                            onChange={(e) => setEntryForm({ ...entryForm, is_break: e.target.checked, subject_id: '', faculty_id: '', room_number: '' })}
                                            className="tt-break-checkbox"
                                        />
                                        <span className="tt-break-toggle-text">☕ Mark as Break Period</span>
                                    </label>
                                    <span className="tt-break-toggle-hint">e.g. Lunch Break, Recess</span>
                                </div>

                                {entryForm.is_break ? (
                                    <div className="tt-form-group">
                                        <label className="tt-form-label">Break Label</label>
                                        <input
                                            type="text"
                                            className="tt-input"
                                            placeholder="e.g. Lunch Break, Recess, Short Break"
                                            value={entryForm.break_label}
                                            onChange={(e) => setEntryForm({ ...entryForm, break_label: e.target.value })}
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <div className="tt-form-group">
                                            <label className="tt-form-label">Subject <span>*</span></label>
                                            <select className="tt-input" value={entryForm.subject_id} onChange={(e) => {
                                                const subjectId = e.target.value;
                                                const selectedSubject = subjects.find(s => s.id.toString() === subjectId);
                                                let autoFacultyId = entryForm.faculty_id;
                                                if (selectedSubject && selectedSubject.faculty_id) {
                                                    autoFacultyId = selectedSubject.faculty_id;
                                                }
                                                setEntryForm({ ...entryForm, subject_id: subjectId, faculty_id: autoFacultyId });
                                            }} required>
                                                <option value="">-- Select Subject --</option>
                                                {subjects.filter(sub => sub.class_id && sub.class_id.toString() === selectedClass.toString()).map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="tt-form-group">
                                            <label className="tt-form-label">Faculty <span>*</span></label>
                                            <select className="tt-input" value={entryForm.faculty_id} onChange={(e) => setEntryForm({ ...entryForm, faculty_id: e.target.value })} required>
                                                <option value="">-- Select Faculty --</option>
                                                {faculty.map(f => <option key={f.id} value={f.id}>{f.User?.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="tt-form-group">
                                            <label className="tt-form-label">Room Number (Optional)</label>
                                            <input type="text" className="tt-input" placeholder="e.g. 101" value={entryForm.room_number} onChange={(e) => setEntryForm({ ...entryForm, room_number: e.target.value })} />
                                        </div>
                                    </>
                                )}
                            </form>
                        </div>
                        
                        <div className="tt-modal-footer">
                            <button type="button" className="ap-btn-white" onClick={() => setShowEntryModal(false)}>Cancel</button>
                            <button type="submit" form="entryForm" className={entryForm.is_break ? "ap-btn-break" : "ap-btn-purple"}>
                                {entryForm.is_break ? '☕ Add Break' : <><PlusIcon /> Assign Class</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Entry Modal */}
            {showEditModal && editingEntry && (
                <div className="tt-modal-overlay">
                    <div className="tt-modal-content">
                        <div className="tt-modal-header">
                            <div className="tt-modal-header-left">
                                <div className="tt-modal-icon tt-modal-icon-edit">
                                    <EditIcon />
                                </div>
                                <div>
                                    <h2 className="tt-modal-title">Edit Timetable Entry</h2>
                                    <p className="tt-modal-subtitle">Update subject, faculty, or room for this slot</p>
                                </div>
                            </div>
                            <button className="tt-modal-close" onClick={() => { setShowEditModal(false); setEditingEntry(null); }}>
                                <CloseIcon />
                            </button>
                        </div>

                        <div className="tt-modal-body">
                            <form id="editEntryForm" onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="tt-form-group">
                                    <label className="tt-form-label">Day of Week <span>*</span></label>
                                    <select className="tt-input" value={editForm.day_of_week} onChange={(e) => setEditForm({ ...editForm, day_of_week: e.target.value })} required>
                                        {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div className="tt-form-group">
                                    <label className="tt-form-label">Time Slot <span>*</span></label>
                                    <select className="tt-input" value={editForm.slot_id} onChange={(e) => setEditForm({ ...editForm, slot_id: e.target.value })} required>
                                        <option value="">-- Choose Time --</option>
                                        {slots.map(s => <option key={s.id} value={s.id}>{formatAMPM(s.start_time)} - {formatAMPM(s.end_time)}</option>)}
                                    </select>
                                </div>

                                {/* Break Toggle */}
                                <div className="tt-break-toggle-row">
                                    <label className="tt-break-toggle-label">
                                        <input
                                            type="checkbox"
                                            checked={editForm.is_break}
                                            onChange={(e) => setEditForm({ ...editForm, is_break: e.target.checked, subject_id: '', faculty_id: '', room_number: '' })}
                                            className="tt-break-checkbox"
                                        />
                                        <span className="tt-break-toggle-text">☕ Mark as Break Period</span>
                                    </label>
                                    <span className="tt-break-toggle-hint">e.g. Lunch Break, Recess</span>
                                </div>

                                {editForm.is_break ? (
                                    <div className="tt-form-group">
                                        <label className="tt-form-label">Break Label</label>
                                        <input
                                            type="text"
                                            className="tt-input"
                                            placeholder="e.g. Lunch Break, Recess, Short Break"
                                            value={editForm.break_label}
                                            onChange={(e) => setEditForm({ ...editForm, break_label: e.target.value })}
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <div className="tt-form-group">
                                            <label className="tt-form-label">Subject <span>*</span></label>
                                            <select className="tt-input" value={editForm.subject_id} onChange={(e) => {
                                                const subjectId = e.target.value;
                                                const selectedSubject = subjects.find(s => s.id.toString() === subjectId);
                                                let autoFacultyId = editForm.faculty_id;
                                                if (selectedSubject && selectedSubject.faculty_id) {
                                                    autoFacultyId = selectedSubject.faculty_id;
                                                }
                                                setEditForm({ ...editForm, subject_id: subjectId, faculty_id: autoFacultyId });
                                            }} required>
                                                <option value="">-- Select Subject --</option>
                                                {subjects.filter(sub => sub.class_id && sub.class_id.toString() === selectedClass.toString()).map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="tt-form-group">
                                            <label className="tt-form-label">Faculty <span>*</span></label>
                                            <select className="tt-input" value={editForm.faculty_id} onChange={(e) => setEditForm({ ...editForm, faculty_id: e.target.value })} required>
                                                <option value="">-- Select Faculty --</option>
                                                {faculty.map(f => <option key={f.id} value={f.id}>{f.User?.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="tt-form-group">
                                            <label className="tt-form-label">Room Number (Optional)</label>
                                            <input type="text" className="tt-input" placeholder="e.g. 101" value={editForm.room_number} onChange={(e) => setEditForm({ ...editForm, room_number: e.target.value })} />
                                        </div>
                                    </>
                                )}
                            </form>
                        </div>

                        <div className="tt-modal-footer">
                            <button type="button" className="ap-btn-white" onClick={() => { setShowEditModal(false); setEditingEntry(null); }}>Cancel</button>
                            <button type="submit" form="editEntryForm" className="ap-btn-edit-save">
                                <EditIcon /> Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminTimetable;
