import { useState, useEffect, useRef } from "react";
import api from "../../services/api";
import "./LiveTimetable.css";
import DrillDownModal from "./components/LiveTimetableDrillDown"; // Will create this

function LiveTimetable() {
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
    
    const [periods, setPeriods] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);
    
    const [selectedPeriodId, setSelectedPeriodId] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Fetch classes for dropdown
    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const res = await api.get("/live-timetable/classes");
                if (res.data.success) {
                    setClasses(res.data.data);
                    if (res.data.data.length > 0) {
                        setSelectedClass(res.data.data[0].id.toString());
                    }
                }
            } catch (err) {
                console.error("Failed to load classes", err);
            }
        };
        fetchClasses();
    }, []);

    const fetchLiveBoard = async (isBackground = false) => {
        if (!selectedClass || !selectedDate) return;
        if (!isBackground) setLoading(true);
        try {
            const res = await api.get(`/live-timetable?class_id=${selectedClass}&date=${selectedDate}`);
            if (res.data.success) {
                setPeriods(res.data.data || []);
            }
        } catch (err) {
            console.error("Failed to fetch live board", err);
        } finally {
            if (!isBackground) {
                setLoading(false);
                setInitialLoad(false);
            }
        }
    };

    // Load data when class/date changes
    useEffect(() => {
        fetchLiveBoard(false);
    }, [selectedClass, selectedDate]);

    // Polling every 30 seconds for live updates
    useEffect(() => {
        if (!selectedClass || !selectedDate) return;
        // Only poll if the date is today
        const today = new Date().toISOString().split('T')[0];
        if (selectedDate !== today) return;

        const intervalId = setInterval(() => {
            fetchLiveBoard(true); // background fetch
        }, 30000);

        return () => clearInterval(intervalId);
    }, [selectedClass, selectedDate]);

    const handlePeriodClick = (periodId, isBreak) => {
        if (isBreak) return;
        setSelectedPeriodId(periodId);
        setIsModalOpen(true);
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return "--:--";
        const [h, m] = timeStr.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        return `${h12}:${m} ${ampm}`;
    };

    const getStatusBadge = (state) => {
        if (state === 'live') {
            return (
                <div className="lt-badge live">
                    <span className="lt-pulse"></span> LIVE NOW
                </div>
            );
        }
        if (state === 'ended') {
            return <div className="lt-badge ended">ENDED</div>;
        }
        return <div className="lt-badge upcoming">UPCOMING</div>;
    };

    return (
        <div className="lt-wrapper">
            <div className="lt-header">
                <div className="lt-title-group">
                    <div className="lt-icon-bg">⏱️</div>
                    <div>
                        <h1 className="lt-title">Live Timetable</h1>
                        <p className="lt-subtitle">Real-time attendance & period tracking</p>
                    </div>
                </div>
                <div className="lt-controls">
                    <div className="lt-control-group">
                        <label>Date</label>
                        <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={(e) => setSelectedDate(e.target.value)}
                            max={new Date().toISOString().split('T')[0]} // Max today
                        />
                    </div>
                    <div className="lt-control-group">
                        <label>Class</label>
                        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                            <option value="">Select Class...</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.name} {c.section}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="lt-board">
                {loading && initialLoad ? (
                    <div className="lt-loading">Loading live board...</div>
                ) : periods.length === 0 ? (
                    <div className="lt-empty">
                        <h3>No classes scheduled</h3>
                        <p>No timetable found for the selected class and date.</p>
                    </div>
                ) : (
                    <div className="lt-timeline">
                        {periods.map(p => (
                            <div 
                                key={p.id} 
                                className={`lt-period-card ${p.is_break ? 'break' : ''} ${p.period_state} ${!p.is_break ? 'clickable' : ''}`}
                                onClick={() => handlePeriodClick(p.id, p.is_break)}
                            >
                                <div className="lt-time-col">
                                    <span className="lt-time">{formatTime(p.start_time)}</span>
                                    <span className="lt-time-sep">to</span>
                                    <span className="lt-time">{formatTime(p.end_time)}</span>
                                </div>
                                <div className="lt-details-col">
                                    {p.is_break ? (
                                        <div className="lt-break-label">☕ {p.break_label || 'Break'}</div>
                                    ) : (
                                        <>
                                            <div className="lt-subject-row">
                                                <h3 className="lt-subject">{p.subject?.name}</h3>
                                                {getStatusBadge(p.period_state)}
                                            </div>
                                            <div className="lt-meta-row">
                                                <div className="lt-meta-item">
                                                    <span className="icon">👨‍🏫</span>
                                                    {p.faculty?.name}
                                                    {p.faculty?.faculty_state === 'present' && <span className="status-dot present" title="Faculty Present"></span>}
                                                </div>
                                                {p.room && (
                                                    <div className="lt-meta-item">
                                                        <span className="icon">🚪</span>
                                                        {p.room}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="lt-stats-row">
                                                <div className="lt-stat-box">
                                                    <div className="lt-stat-val">{p.students_present} <span>/ {p.students_total}</span></div>
                                                    <div className="lt-stat-label">Present</div>
                                                </div>
                                                <div className="lt-stat-box">
                                                    <div className="lt-stat-val">{p.students_total - p.students_marked}</div>
                                                    <div className="lt-stat-label">Unmarked</div>
                                                </div>
                                                {/* Progress bar */}
                                                <div className="lt-progress-bg">
                                                    <div 
                                                        className="lt-progress-fill" 
                                                        style={{ width: `${p.students_total > 0 ? (p.students_present / p.students_total) * 100 : 0}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {!p.is_break && (
                                    <div className="lt-action-col">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="9 18 15 12 9 6"></polyline>
                                        </svg>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isModalOpen && selectedPeriodId && (
                <DrillDownModal 
                    periodId={selectedPeriodId} 
                    date={selectedDate} 
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedPeriodId(null);
                        fetchLiveBoard(true); // refresh counts on close
                    }} 
                />
            )}
        </div>
    );
}

export default LiveTimetable;
