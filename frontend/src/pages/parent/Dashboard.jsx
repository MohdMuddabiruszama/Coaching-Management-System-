import { useState, useEffect, useContext, useRef, useMemo } from "react";
import { AuthContext } from "../../context/AuthContext";
import { AnnouncementSidebarContext } from "../../context/AnnouncementSidebarContext";
import ThemeSelector from "../../components/ThemeSelector";
import { useNavigate } from "react-router-dom";
import * as parentService from "../../services/parent.service";
import markService from "../../services/mark.service";
import performanceService from "../../services/performance.service";
import announcementService from "../../services/announcement.service";
import InstituteLogo from "../../components/common/InstituteLogo";
import AnnouncementBell from "../../components/AnnouncementBell";
import AdvancedStatCard from "../../components/common/AdvancedStatCard";
import "./Dashboard.css";
import "../student/Performance.css";
import "../student/StudentDashboard.css";
import "../student/StudentTimetableV2.css";
import "./ParentAssignments.css";
import api from "../../services/api";

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// SVG Icons for Assignments
const AsgIcons = {
    DocCheck: () => <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 14l-4 4-2-2 1.41-1.41L12 17.17l2.59-2.58L16 16zm-3-9V3.5L18.5 9H13z"/></svg>,
    DocCross: () => <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor"/><path d="M15 9l-6 6M9 9l6 6" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>,
    DocPending: () => <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-2 14v-4h2v4h-2zm0-6V7h2v3h-2zm1-7V3.5L18.5 9H13z"/></svg>,
    DocRefresh: () => <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM12 18c-2.21 0-4-1.79-4-4s1.79-4 4-4c1.1 0 2.1.45 2.82 1.18L13 13h5V8l-1.63 1.63C15.22 8.64 13.68 8 12 8c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.42 0 4.5-1.44 5.45-3.5h-2.14C14.47 17.39 13.33 18 12 18zM13 9V3.5L18.5 9H13z"/></svg>,
    ChatBubble: () => <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>,
    ChevronRight: () => <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>,
};

const getAsgSubjectIcon = (name) => {
    if (!name) return '📖';
    const n = name.toLowerCase();
    if (n.includes('math')) return '📗';
    if (n.includes('science')) return '👨‍🔬';
    return '📖';
};

function ParentDashboard() {
    const { user, logout } = useContext(AuthContext);
    const { toggleSidebar } = useContext(AnnouncementSidebarContext);
    const navigate = useNavigate();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStudent, setSelectedStudent] = useState(null);

    // Detailed states
    const [attendance, setAttendance] = useState(null);
    const [results, setResults] = useState([]);
    const [fees, setFees] = useState([]);
    const [performance, setPerformance] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [assignmentFilter, setAssignmentFilter] = useState('all');
    const [activeTab, setActiveTab] = useState("overview");
    const [attendanceSubjectFilter, setAttendanceSubjectFilter] = useState("All");
    const [examFilter, setExamFilter] = useState('All');
    const [detailLoading, setDetailLoading] = useState(false);
    const [reminderPopup, setReminderPopup] = useState(null);
    const [recentAnnouncements, setRecentAnnouncements] = useState([]);
    
    // Timetable state
    const [timetableData, setTimetableData] = useState({ slots: [], timetable: [] });
    const [ttViewMode, setTtViewMode] = useState("week");
    const [ttCurrentDate, setTtCurrentDate] = useState(new Date());

    useEffect(() => {
        fetchDashboard();
    }, []);

    // Helper: calculate days until reminder
    const getDaysUntilReminder = (reminderDate) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const rem = new Date(reminderDate);
        rem.setHours(0, 0, 0, 0);
        return Math.ceil((rem - today) / (1000 * 60 * 60 * 24));
    };

    // Should we show a reminder for this fee? Phased: 8 days, 4 days, ≤2 days, and on/past date
    const shouldShowReminder = (fee) => {
        if (!fee.reminder_date || fee.status === 'paid') return false;
        const daysLeft = getDaysUntilReminder(fee.reminder_date);
        // Show at exactly 8 days, exactly 4 days, 2 days or less (continuous), and on/past date
        return daysLeft === 8 || daysLeft === 4 || daysLeft <= 2;
    };

    // Get urgency level: 'red' = overdue/today, 'orange' = approaching
    const getReminderUrgency = (reminderDate) => {
        const daysLeft = getDaysUntilReminder(reminderDate);
        if (daysLeft <= 0) return 'red';   // On or past reminder date
        return 'orange';                    // 8, 4, or ≤2 days before
    };

    const fetchDashboard = async () => {
        try {
            const [data, announcementsData] = await Promise.all([
                parentService.getParentDashboard(),
                announcementService.getInstituteAnnouncements().catch(() => [])
            ]);
            
            const loadedStudents = data.data.students || [];
            setStudents(loadedStudents);
            setRecentAnnouncements(announcementsData.slice(0, 3));
            
            // Check for popups using phased reminder logic
            const popups = [];
            
            loadedStudents.forEach(st => {
                if (st.StudentFees) {
                    st.StudentFees.forEach(fee => {
                        if (shouldShowReminder(fee)) {
                            const daysLeft = getDaysUntilReminder(fee.reminder_date);
                            popups.push({
                                studentName: st.User?.name,
                                amount: fee.due_amount,
                                date: fee.reminder_date,
                                daysLeft,
                                overdue: daysLeft <= 0
                            });
                        }
                    });
                }
            });
            
            if (popups.length > 0) {
                const hasShown = sessionStorage.getItem('feePopupShown');
                if (!hasShown) {
                    setReminderPopup(popups);
                    sessionStorage.setItem('feePopupShown', 'true');
                }
            }

            if (loadedStudents.length > 0) {
                await selectStudent(loadedStudents[0]);
            }
        } catch (error) {
            console.error("Error fetching parent dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    const getStudentCardStyle = (student) => {
        const isSelected = selectedStudent?.id === student.id;
        
        let worstUrgency = 'none'; // none | orange | red

        if (student.StudentFees && student.StudentFees.length > 0) {
            student.StudentFees.forEach(fee => {
                if (shouldShowReminder(fee)) {
                    const urgency = getReminderUrgency(fee.reminder_date);
                    if (urgency === 'red') worstUrgency = 'red';
                    else if (urgency === 'orange' && worstUrgency !== 'red') worstUrgency = 'orange';
                }
            });
        }

        if (worstUrgency === 'red') {
            return {
                background: isSelected ? "linear-gradient(135deg, #ef4444, #dc2626)" : "#fee2e2",
                color: isSelected ? "#fff" : "#991b1b",
                borderColor: isSelected ? "#ef4444" : "#fca5a5",
                boxShadow: isSelected ? "0 8px 24px rgba(239,68,68,0.35)" : undefined
            };
        } else if (worstUrgency === 'orange') {
            return {
                background: isSelected ? "linear-gradient(135deg, #f59e0b, #d97706)" : "#fef3c7",
                color: isSelected ? "#fff" : "#92400e",
                borderColor: isSelected ? "#f59e0b" : "#fcd34d",
                boxShadow: isSelected ? "0 8px 24px rgba(245,158,11,0.35)" : undefined
            };
        } else {
            return {
                background: isSelected ? "linear-gradient(135deg,#4f46e5,#7c3aed)" : undefined,
                color: isSelected ? "#fff" : undefined,
                borderColor: isSelected ? "#4f46e5" : undefined,
                boxShadow: isSelected ? "0 8px 24px rgba(79,70,229,0.35)" : undefined
            };
        }
    };

    // Cache for student details to minimize API calls
    const studentCache = useRef({});

    const selectStudent = async (student) => {
        setSelectedStudent(student);
        setActiveTab("overview");
        setAttendanceSubjectFilter("");
        setAssignmentFilter("all");
        
        // Use cached data if available to increase speed and reduce API calls
        if (studentCache.current[student.id]) {
            const cached = studentCache.current[student.id];
            setAttendance(cached.attendance);
            setResults(cached.results);
            setFees(cached.fees);
            setPerformance(cached.performance);
            setAssignments(cached.assignments || []);
            setTimetableData(cached.timetableData || { slots: [], timetable: [] });
            return;
        }

        setDetailLoading(true);
        try {
            const classId = student.Classes?.[0]?.id;
            const [attData, resData, feeData, perfData, asgData, slotsData, ttData] = await Promise.all([
                parentService.getLinkedStudentAttendance(student.id).catch(() => ({ data: null })),
                markService.getParentChild(student.id).catch(() => []),
                parentService.getLinkedStudentFees(student.id).catch(() => ({ data: [] })),
                performanceService.getChildPerformance(student.id).catch(() => null),
                parentService.getLinkedStudentAssignments(student.id).catch(() => ({ assignments: [] })),
                api.get("/timetable/slots").catch(() => ({ data: { data: [] } })),
                classId ? api.get(`/timetable/class/${classId}`).catch(() => ({ data: { data: [] } })) : Promise.resolve({ data: { data: [] } })
            ]);
            
            const fetchedAttendance = attData?.data;
            const fetchedResults = Array.isArray(resData) ? resData : (resData?.data || []);
            const fetchedFees = feeData?.data || [];
            const fetchedAssignments = asgData?.assignments || [];
            const fetchedTimetableData = {
                slots: slotsData?.data?.data || [],
                timetable: ttData?.data?.data || []
            };
            
            // Save to cache
            studentCache.current[student.id] = {
                attendance: fetchedAttendance,
                results: fetchedResults,
                fees: fetchedFees,
                performance: perfData,
                assignments: fetchedAssignments,
                timetableData: fetchedTimetableData
            };

            setAttendance(fetchedAttendance);
            setResults(fetchedResults);
            setFees(fetchedFees);
            setPerformance(perfData);
            setAssignments(fetchedAssignments);
            setTimetableData(fetchedTimetableData);
        } catch (error) {
            console.error("Error fetching details for student", error);
        } finally {
            setDetailLoading(false);
        }
    };

    // Phase 6: Compute fee breakdown
    const pendingFees = fees.filter(f => f.status === 'pending' || f.status === 'partial');
    const paidFees = fees.filter(f => f.status === 'paid');
    const totalPendingAmount = pendingFees.reduce((acc, f) => acc + parseFloat(f.due_amount || 0), 0);
    const totalPaidAmount = fees.reduce((acc, f) => acc + parseFloat(f.paid_amount || 0), 0);
    const totalFees = fees.reduce((acc, f) => acc + parseFloat(f.final_amount || 0), 0);

    const totalAssignments = assignments.length;
    const asgPending = assignments.filter(a => !a.my_submission || a.my_submission?.status === 'pending');
    const asgGraded = assignments.filter(a => a.my_submission?.status === 'graded');
    const asgSubmitted = assignments.filter(a => a.my_submission && ['submitted', 'late'].includes(a.my_submission.status));
    const asgResubmit = assignments.filter(a => a.my_submission?.status === 'resubmit_requested');
    const completedAssignments = asgGraded.length + asgSubmitted.length;
    const assignmentsPct = totalAssignments ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

    const filteredAssignments = useMemo(() => {
        if (assignmentFilter === 'pending') return asgPending;
        if (assignmentFilter === 'graded') return asgGraded;
        if (assignmentFilter === 'awaiting') return asgSubmitted;
        if (assignmentFilter === 'resubmit') return asgResubmit;
        return assignments;
    }, [assignments, assignmentFilter, asgPending, asgGraded, asgSubmitted, asgResubmit]);

    // Calculate Average Attendance Across All Enrolled Subjects
    const overallAttendanceStats = useMemo(() => {
        if (!attendance?.records || attendance.records.length === 0) {
            return {
                averagePercentage: attendance?.summary?.attendance_percentage || 0,
                totalWorkingDays: attendance?.summary?.working_days || 0,
                totalPresent: attendance?.summary?.present_days || 0,
            };
        }

        const subjectRecords = {};
        attendance.records.forEach(r => {
            const subName = r.Subject?.name || r.Class?.name || 'General';
            if (!subjectRecords[subName]) {
                subjectRecords[subName] = [];
            }
            subjectRecords[subName].push(r);
        });

        const subjects = Object.keys(subjectRecords);
        let totalPct = 0;
        let totalWorkingDays = 0;
        let totalPresentDays = 0;

        subjects.forEach(sub => {
            const records = subjectRecords[sub];
            const present = records.filter(r => r.status === 'present').length;
            const absent = records.filter(r => r.status === 'absent').length;
            const late = records.filter(r => r.status === 'late').length;
            const halfDay = records.filter(r => r.status === 'half_day').length;
            const working = present + absent + late + halfDay;
            
            let pct = 0;
            if (working > 0) {
                pct = ((present + late + (halfDay * 0.5)) / working) * 100;
            }
            totalPct += pct;
            totalWorkingDays += working;
            totalPresentDays += (present + late + halfDay);
        });

        return {
            averagePercentage: subjects.length > 0 ? Math.round(totalPct / subjects.length) : 0,
            totalWorkingDays,
            totalPresent: totalPresentDays
        };
    }, [attendance]);

    // Attendance percentage
    const attPct = overallAttendanceStats.averagePercentage;

    const TODAY_STR = new Date().toISOString().split('T')[0];
    const reminders = fees.filter(f => shouldShowReminder(f));

    // Attendance Subject Filtering Logic
    const uniqueAttendanceSubjects = useMemo(() => {
        if (!attendance?.records) return [];
        const subjects = new Set();
        attendance.records.forEach(r => {
            const subName = r.Subject?.name || r.Class?.name;
            if (subName) subjects.add(subName);
        });
        return Array.from(subjects).sort();
    }, [attendance]);

    // Calculate Enrolled Subject Performance for Overview Tab
    const enrolledSubjectPerformance = useMemo(() => {
        let subjectsList = [];
        // Extract subjects from student's enrolled classes
        if (selectedStudent?.Classes?.length > 0) {
            selectedStudent.Classes.forEach(cls => {
                if (cls.Subjects && cls.Subjects.length > 0) {
                    cls.Subjects.forEach(sub => {
                        if (!subjectsList.includes(sub.name)) subjectsList.push(sub.name);
                    });
                }
            });
        }
        
        // Fallback: If no explicit Subjects are found, use attendance unique subjects
        if (subjectsList.length === 0 && uniqueAttendanceSubjects?.length > 0) {
            subjectsList = [...uniqueAttendanceSubjects];
        }

        // Ultimate fallback if absolutely no data
        if (subjectsList.length === 0) {
            subjectsList = ['Mathematics', 'Science', 'English', 'Social Sci.', 'Hindi'];
        }

        const colors = ['#6366f1', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];
        
        return subjectsList.map((subjectName, i) => {
            const perfData = performance?.subjects?.find(s => s.subject_name === subjectName);
            const pct = perfData ? Math.round(perfData.avg_pct) : 0;
            const belowPassing = perfData ? perfData.below_passing : false;
            
            return {
                name: subjectName,
                pct: pct,
                color: belowPassing ? '#ef4444' : colors[i % colors.length]
            };
        });
    }, [selectedStudent, uniqueAttendanceSubjects, performance]);

    const filteredAttendanceRecords = useMemo(() => {
        if (!attendance?.records) return [];
        if (!attendanceSubjectFilter) return [];
        return attendance.records.filter(r => (r.Subject?.name || r.Class?.name) === attendanceSubjectFilter);
    }, [attendance, attendanceSubjectFilter]);

    const filteredSummary = useMemo(() => {
        if (!attendanceSubjectFilter || !attendance?.records) {
            return attendance?.summary;
        }
        const records = filteredAttendanceRecords;
        const present = records.filter(r => r.status === 'present').length;
        const absent = records.filter(r => r.status === 'absent').length;
        const late = records.filter(r => r.status === 'late').length;
        const halfDay = records.filter(r => r.status === 'half_day').length;
        const totalWorking = present + absent + late + halfDay;
        
        let pct = 0;
        if (totalWorking > 0) {
            pct = Math.round(((present + late + (halfDay * 0.5)) / totalWorking) * 100);
        }
        return {
            working_days: totalWorking,
            present_days: present + late + halfDay,
            absent_days: absent,
            attendance_percentage: pct,
            holiday_days: 0
        };
    }, [attendance, filteredAttendanceRecords, attendanceSubjectFilter]);

    // Use filtered summary for attPct in the tab
    const filteredAttPct = filteredSummary?.attendance_percentage || 0;

    useEffect(() => {
        if (uniqueAttendanceSubjects.length > 0) {
            if (!attendanceSubjectFilter || !uniqueAttendanceSubjects.includes(attendanceSubjectFilter)) {
                setAttendanceSubjectFilter(uniqueAttendanceSubjects[0]);
            }
        }
    }, [uniqueAttendanceSubjects, attendanceSubjectFilter]);

    if (loading) {
        return (
            <div className="parent-dashboard-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>👨‍👩‍👧</div>
                    <p>Loading your dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="parent-dashboard-container">
            {/* Header */}
            <header className="dashboard-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <InstituteLogo size="md" />
                    <div>
                        <h1>Parent Dashboard</h1>
                        <p>Welcome back, {user?.name || "Parent"}! {selectedStudent ? `Here's how ${selectedStudent.User?.name?.split(' ')[0]} is doing.` : "Monitoring your child's progress."}</p>
                    </div>
                </div>
                <div className="dashboard-header-right" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {user?.features?.announcements && <AnnouncementBell size="large" />}
                    <ThemeSelector />
                    <button onClick={logout} className="btn-logout">
                        <span style={{ marginRight: '5px' }}>🚪</span> Logout
                    </button>
                </div>
            </header>

            {/* Student Selector */}
            <div className="student-selector">
                {students.length === 0 ? (
                    <div style={{ color: "var(--text-secondary)", padding: "1rem" }}>No students linked to your account.</div>
                ) : students.map(student => {
                    const isSelected = selectedStudent?.id === student.id;
                    return (
                        <div
                            key={student.id}
                            className={`student-card-btn ${isSelected ? 'active' : ''}`}
                            onClick={() => selectStudent(student)}
                            style={getStudentCardStyle(student)}
                        >
                            <div className="student-avatar">
                                <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${student.User?.name || 'Student'}&backgroundColor=6366f1,8b5cf6&textColor=ffffff&fontWeight=700`} alt="avatar" />
                            </div>
                            <div className="details">
                                <h3>{student.User?.name}</h3>
                                <small>Roll: {student.roll_number} | {student.Classes?.[0]?.name || "—"}</small>
                                <div style={{ marginTop: '6px' }}>
                                    <span className="student-active-badge">Active</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {selectedStudent ? (
                <div>
                    {/* Tabs */}
                    <div className="tabs-container">
                        {[
                            { id: 'overview', label: '🏠 Overview' },
                            { id: 'attendance', label: '📋 Attendance', featureKey: 'attendance' },
                            { id: 'marks', label: '📈 Marks', featureKey: 'exams' },
                            { id: 'performance', label: '📊 Performance', featureKey: 'exams' },
                            { id: 'fees', label: '💳 Fees', featureKey: 'fees' },
                            { id: 'timetable', label: '📅 Timetable', featureKey: 'timetable' },
                            { id: 'assignments', label: '📝 Assignments', featureKey: 'notes' },
                            { id: 'chat', label: '💬 Chat', featureKey: 'chat' },
                            { id: 'announcements', label: '📢 Announcements', featureKey: 'announcements' }
                        ].filter(tab => {
                            if (!tab.featureKey) return true;
                            if (tab.featureKey === 'attendance') return user?.features?.attendance !== 'none';
                            return user?.features?.[tab.featureKey];
                        }).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    if (tab.id === 'announcements') {
                                        toggleSidebar();
                                    } else {
                                        setActiveTab(tab.id);
                                    }
                                }}
                                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {detailLoading ? (
                        <div className="dashboard-card" style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
                            Loading data...
                        </div>
                    ) : (
                        <>
                            {/* ═══ OVERVIEW TAB ═══ */}
                            {activeTab === 'overview' && (
                                <>
                                    {/* Reminder Alerts */}
                                    {reminders.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                            {reminders.map(rem => {
                                                const urgency = getReminderUrgency(rem.reminder_date);
                                                const daysLeft = getDaysUntilReminder(rem.reminder_date);
                                                const isRed = urgency === 'red';
                                                const borderColor = isRed ? 'rgba(239,68,68,0.5)' : 'rgba(245,158,11,0.5)';
                                                const bgGradient = isRed
                                                    ? 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.05))'
                                                    : 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.05))';
                                                const textColor = isRed ? '#dc2626' : '#d97706';
                                                const icon = isRed ? '🚨' : '⚠️';
                                                const daysText = daysLeft > 0 
                                                    ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining` 
                                                    : daysLeft === 0 
                                                        ? 'Due today!' 
                                                        : `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''}`;
                                                return (
                                                    <div key={`rem-${rem.id}`} style={{
                                                        background: bgGradient,
                                                        border: `1.5px solid ${borderColor}`, borderRadius: '12px',
                                                        padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem'
                                                    }}>
                                                        <span style={{ fontSize: '1.25rem' }}>{icon}</span>
                                                        <div style={{ color: textColor, fontWeight: '600', fontSize: '0.95rem' }}>
                                                            {selectedStudent?.User?.name} has pending fees. Please pay before the reminder date: {new Date(rem.reminder_date).toLocaleDateString()}. <span style={{ fontWeight: 700, fontSize: '0.85rem', opacity: 0.85 }}>({daysText})</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    <div className="sd-secondary-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                                        {/* Attendance */}
                                        <div className="sd-stat-card">
                                            <div className="sd-stat-card-header">
                                                <div className={`sd-stat-card-icon ${attPct >= 75 ? 'icon-green' : 'icon-yellow'}`}>📋</div>
                                                <span className="sd-stat-card-title">Attendance</span>
                                            </div>
                                            <div className="sd-stat-card-value-row">
                                                <span className="sd-stat-card-value">{attPct}%</span>
                                            </div>
                                            <div className="sd-progress-bar">
                                                <div className="sd-progress-fill" style={{ width: `${attPct}%`, backgroundColor: attPct >= 75 ? '#10b981' : '#f59e0b' }} />
                                            </div>
                                            <div className="sd-stat-card-footer">
                                                <span>Present Days</span>
                                                <span>{overallAttendanceStats.totalPresent} / {overallAttendanceStats.totalWorkingDays}</span>
                                            </div>
                                        </div>

                                        {/* Classes Enrolled */}
                                        <div className="sd-stat-card">
                                            <div className="sd-stat-card-header">
                                                <div className="sd-stat-card-icon icon-purple">📚</div>
                                                <span className="sd-stat-card-title">Classes Enrolled</span>
                                            </div>
                                            <div className="sd-stat-card-value-row">
                                                <span className="sd-stat-card-value">{selectedStudent?.Classes?.length || 0}</span>
                                            </div>
                                            <div className="sd-progress-bar" style={{ opacity: 0 }}>
                                                <div className="sd-progress-fill" style={{ width: '0%' }} />
                                            </div>
                                            <div className="sd-stat-card-footer">
                                                <span>Program Type</span>
                                                <span>{selectedStudent?.is_full_course ? 'Full Course' : 'Individual'}</span>
                                            </div>
                                        </div>

                                        {/* Assignments */}
                                        <div className="sd-stat-card">
                                            <div className="sd-stat-card-header">
                                                <div className={`sd-stat-card-icon ${assignmentsPct >= 75 ? 'icon-green' : 'icon-blue'}`}>📋</div>
                                                <span className="sd-stat-card-title">Assignments</span>
                                            </div>
                                            <div className="sd-stat-card-value-row">
                                                <span className="sd-stat-card-value">{completedAssignments}</span>
                                                <span className="sd-stat-card-max">/ {totalAssignments}</span>
                                            </div>
                                            <div className="sd-progress-bar">
                                                <div className="sd-progress-fill" style={{ width: `${assignmentsPct}%`, backgroundColor: assignmentsPct >= 75 ? '#10b981' : '#3b82f6' }} />
                                            </div>
                                            <div className="sd-stat-card-footer">
                                                <span>Completed</span>
                                                <span>{assignmentsPct}%</span>
                                            </div>
                                        </div>

                                        {/* Pending Fees */}
                                        <div className="sd-stat-card">
                                            <div className="sd-stat-card-header">
                                                <div className="sd-stat-card-icon icon-yellow">⏳</div>
                                                <span className="sd-stat-card-title">Pending Fees</span>
                                            </div>
                                            <div className="sd-stat-card-value-row">
                                                <span className="sd-stat-card-value">₹{totalPendingAmount.toLocaleString()}</span>
                                            </div>
                                            <div className="sd-progress-bar" style={{ opacity: 0 }}>
                                                <div className="sd-progress-fill" style={{ width: '0%' }} />
                                            </div>
                                            <div className="sd-stat-card-footer">
                                                <span>Status</span>
                                                <span className={pendingFees.length > 0 ? "sd-text-danger" : ""}>{pendingFees.length} pending</span>
                                            </div>
                                        </div>

                                        {/* Paid Fees */}
                                        <div className="sd-stat-card">
                                            <div className="sd-stat-card-header">
                                                <div className="sd-stat-card-icon icon-green">✅</div>
                                                <span className="sd-stat-card-title">Paid Fees</span>
                                            </div>
                                            <div className="sd-stat-card-value-row">
                                                <span className="sd-stat-card-value">₹{totalPaidAmount.toLocaleString()}</span>
                                            </div>
                                            <div className="sd-progress-bar">
                                                <div className="sd-progress-fill" style={{ width: `${totalFees > 0 ? (totalPaidAmount / totalFees) * 100 : 0}%`, backgroundColor: '#10b981' }} />
                                            </div>
                                            <div className="sd-stat-card-footer">
                                                <span>Total Fees</span>
                                                <span>₹{totalFees.toLocaleString()}</span>
                                            </div>
                                        </div>

                                        {/* Exam Results */}
                                        <div className="sd-stat-card">
                                            <div className="sd-stat-card-header">
                                                <div className="sd-stat-card-icon icon-purple">🎯</div>
                                                <span className="sd-stat-card-title">Exam Results</span>
                                            </div>
                                            <div className="sd-stat-card-value-row">
                                                <span className="sd-stat-card-value">{results.filter(r => r.status === 'Pass').length}</span>
                                                <span className="sd-stat-card-max">/ {results.length}</span>
                                            </div>
                                            <div className="sd-progress-bar">
                                                <div className="sd-progress-fill" style={{ width: `${results.length > 0 ? (results.filter(r => r.status === 'Pass').length / results.length) * 100 : 0}%`, backgroundColor: '#8b5cf6' }} />
                                            </div>
                                            <div className="sd-stat-card-footer">
                                                <span>Pass Rate</span>
                                                <span className="sd-text-success">{results.length > 0 ? Math.round((results.filter(r => r.status === 'Pass').length / results.length) * 100) : 0}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Light Accent Grid for Performance & Assignments */}
                                    <div className="light-accent-grid">
                                        <div className="light-card">
                                            <div className="light-card-header">
                                                <h3><span style={{color: '#8b5cf6'}}>📊</span> Subject performance</h3>
                                                <div className="view-all" onClick={() => setActiveTab('performance')}>View all</div>
                                            </div>
                                            <div>
                                                {enrolledSubjectPerformance.map((sub, i) => (
                                                    <div key={i} className="sp-row">
                                                        <div className="sp-label">{sub.name}</div>
                                                        <div className="sp-progress-bg">
                                                            <div className="sp-progress-fill" style={{ width: `${sub.pct}%`, background: sub.color }}></div>
                                                        </div>
                                                        <div className="sp-pct">{sub.pct}%</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="sd-widget" style={{ flex: 1, minWidth: '320px' }}>
                                            <div className="sd-widget-header">
                                                <h3>Recent Announcements</h3>
                                                <div className="sd-view-all" style={{ cursor: 'pointer' }} onClick={() => toggleSidebar()}>View all</div>
                                            </div>
                                            <div className="sd-list">
                                                {recentAnnouncements.length > 0 ? recentAnnouncements.map((ann, idx) => {
                                                    const ICON_POOL = ['📢', '📝', '🗓️', '📌', '📣'];
                                                    const COLOR_POOL = ['icon-purple', 'icon-green', 'icon-yellow', 'icon-blue', 'icon-purple'];
                                                    const icon = ICON_POOL[idx % ICON_POOL.length];
                                                    const color = COLOR_POOL[idx % COLOR_POOL.length];
                                                    
                                                    const formatTimeAgo = (dateStr) => {
                                                        if (!dateStr) return '';
                                                        const diff = Date.now() - new Date(dateStr).getTime();
                                                        const mins = Math.floor(diff / 60000);
                                                        if (mins < 1) return 'Just now';
                                                        if (mins < 60) return `${mins} min ago`;
                                                        const hrs = Math.floor(mins / 60);
                                                        if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
                                                        const days = Math.floor(hrs / 24);
                                                        return `${days} day${days > 1 ? 's' : ''} ago`;
                                                    };
                                                    
                                                    return (
                                                        <div className="sd-list-item" key={idx}>
                                                            <div className={`sd-list-icon ${color}`}>{icon}</div>
                                                            <div className="sd-list-content">
                                                                <h4 className="sd-list-title" style={{ margin: 0, fontSize: '14px' }}>{ann.title}</h4>
                                                                <p className="sd-list-desc" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px' }}>{ann.content}</p>
                                                                <span className="sd-time-ago" style={{ fontSize: '11px', color: '#94a3b8' }}>{formatTimeAgo(ann.createdAt || ann.created_at)}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                }) : (
                                                    <p className="sd-empty-state" style={{ margin: 0 }}>No recent announcements</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Actions */}
                                    <div className="dashboard-card">
                                        <h3>⚡ Quick Actions</h3>
                                        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                                            {[
                                                { label: "📅 View Timetable", tab: "timetable", color: "#6366f1", featureKey: 'timetable' },
                                                { label: "📋 View Attendance", tab: "attendance", color: "#10b981", featureKey: 'attendance' },
                                                { label: "📝 View Assignments", action: () => navigate('/parent/assignments'), color: "#0ea5e9", featureKey: 'notes' },
                                                { label: "💬 Chat with Faculty", action: () => navigate('/parent/chat'), color: "#f59e0b", featureKey: 'chat' },
                                                { label: "💳 View Fees", tab: "fees", color: "#ef4444", featureKey: 'fees' }
                                            ].filter(a => {
                                                if (a.featureKey === 'attendance') return user?.features?.attendance !== 'none';
                                                return user?.features?.[a.featureKey];
                                            }).map((a, i) => (
                                                <button
                                                    key={i}
                                                    onClick={a.action || (() => setActiveTab(a.tab))}
                                                    style={{
                                                        padding: "0.65rem 1.25rem", borderRadius: "10px", border: `2px solid ${a.color}`,
                                                        background: `${a.color}15`, color: a.color, fontWeight: "700",
                                                        cursor: "pointer", fontSize: "0.9rem", transition: "all 0.2s"
                                                    }}
                                                    onMouseEnter={e => { e.target.style.background = a.color; e.target.style.color = "#fff"; }}
                                                    onMouseLeave={e => { e.target.style.background = `${a.color}15`; e.target.style.color = a.color; }}
                                                >
                                                    {a.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* ═══ ATTENDANCE TAB ═══ */}
                            {activeTab === 'attendance' && (
                                <div className="dashboard-card">
                                    <h3>📋 Attendance Records — {selectedStudent?.User?.name}</h3>
                                    
                                    {uniqueAttendanceSubjects.length > 0 && (
                                        <div className="tabs-container" style={{ marginBottom: "1.5rem", padding: "0.25rem", background: "var(--bg-secondary, #f8fafc)", border: "none" }}>
                                            {uniqueAttendanceSubjects.map(sub => (
                                                <button
                                                    key={sub}
                                                    className={`tab-btn ${attendanceSubjectFilter === sub ? 'active' : ''}`}
                                                    onClick={() => setAttendanceSubjectFilter(sub)}
                                                    style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
                                                >
                                                    {sub}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Summary */}
                                    {filteredSummary && (
                                        <div className="stats-grid" style={{ marginBottom: "1.5rem" }}>
                                            <div className="stat-card">
                                                <div className="stat-icon">🏢</div>
                                                <div className="info">
                                                    <h3>{filteredSummary.working_days || 0}</h3>
                                                    <p>Working Days</p>
                                                    {/* Removed holiday text since it's now per subject */}
                                                </div>
                                            </div>
                                            <div className="stat-card">
                                                <div className="stat-icon">✅</div>
                                                <div className="info">
                                                    <h3 style={{ color: '#10b981' }}>{filteredSummary.present_days || 0}</h3>
                                                    <p>Present</p>
                                                </div>
                                            </div>
                                            <div className="stat-card">
                                                <div className="stat-icon">❌</div>
                                                <div className="info">
                                                    <h3 style={{ color: '#ef4444' }}>{filteredSummary.absent_days || 0}</h3>
                                                    <p>Absent</p>
                                                </div>
                                            </div>
                                            <div className="stat-card">
                                                <div className="stat-icon">📊</div>
                                                <div className="info">
                                                    <h3 style={{ color: filteredAttPct >= 75 ? '#10b981' : '#ef4444' }}>{filteredAttPct}%</h3>
                                                    <p>Attendance %</p>
                                                    <small style={{ color: filteredAttPct >= 75 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                                        {filteredAttPct >= 75 ? '✓ Good' : '⚠ Below 75%'}
                                                    </small>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Phase 7: Attendance table with In/Out timing */}
                                    {filteredAttendanceRecords?.length > 0 ? (
                                        <>
                                            {/* Desktop table */}
                                            <table className="data-table parent-att-table">
                                                <thead>
                                                    <tr>
                                                        <th>Date</th>
                                                        <th>Subject / Class</th>
                                                        <th>In Time</th>
                                                        <th>Status</th>
                                                        <th>Marked By</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredAttendanceRecords.map(record => (
                                                        <tr key={record.id}>
                                                            <td style={{ fontWeight: 600 }}>{new Date(record.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                            <td>{record.Subject?.name || record.Class?.name || 'All Subjects'}</td>
                                                            <td style={{ color: '#10b981', fontWeight: 600 }}>
                                                                {record.time_in ? record.time_in.substring(0, 5) : '—'}
                                                                {record.is_late && <span style={{ marginLeft: '0.4rem', color: '#f59e0b', fontSize: '0.75rem' }}>+{record.late_by_minutes}m late</span>}
                                                            </td>
                                                            <td>
                                                                <span className={`status-badge status-${record.status}`}>
                                                                    {record.status?.replace('_', ' ')}
                                                                </span>
                                                            </td>
                                                            <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                                {record.marked_by_type === 'biometric' ? '🔐 Biometric' :
                                                                    record.marked_by_type === 'mobile_otp' ? '📱 OTP' :
                                                                        record.marked_by_type === 'qr_code' ? '📸 QR Scan' : '📝 Manual'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {/* Mobile card list */}
                                            <div className="parent-att-cards mobile-table-card card-stagger">
                                                {filteredAttendanceRecords.map(record => (
                                                    <div key={record.id} className={`parent-att-card ${record.status || ''}`}>
                                                        <div style={{ flex: 1 }}>
                                                            <div className="parent-att-date">
                                                                {new Date(record.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </div>
                                                            <div className="parent-att-subject">
                                                                {record.Subject?.name || record.Class?.name || 'All Subjects'}
                                                            </div>
                                                            <div className="parent-att-marked">
                                                                {record.marked_by_type === 'biometric' ? '🔐 Bio' :
                                                                    record.marked_by_type === 'mobile_otp' ? '📱 OTP' :
                                                                        record.marked_by_type === 'qr_code' ? '📸 QR' : '📝 Manual'}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                            <span className={`status-badge status-${record.status}`}>
                                                                {record.status?.replace('_', ' ')}
                                                            </span>
                                                            {record.time_in && (
                                                                <div className="parent-att-time">{record.time_in.substring(0, 5)}</div>
                                                            )}
                                                            {record.is_late && (
                                                                <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700 }}>+{record.late_by_minutes}m late</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="sd-empty-state">
                                            <div className="sd-empty-icon">📋</div>
                                            <h3>No Records</h3>
                                            <p>No attendance records found for {selectedStudent?.User?.name}.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ═══ MARKS TAB ═══ */}
                            {activeTab === 'marks' && (() => {
                                const uniqueExamTypes = [...new Set((results || []).map(r => r.exam_type).filter(Boolean))];
                                const filteredResults = examFilter === 'All' ? (results || []) : (results || []).filter(r => r.exam_type === examFilter);

                                return (
                                <div className="dashboard-card" style={{ padding: '24px', background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                                    <div className="marks-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                                        <div>
                                            <h3 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#0F172A' }}>Exam Results — {selectedStudent?.User?.name}</h3>
                                            <p style={{ color: '#64748B', margin: 0, fontSize: '14px' }}>Detailed marks and performance in all assessments.</p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <div style={{ padding: '8px 16px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px', background: 'white' }}>
                                                <span style={{ color: '#64748B', display: 'block', marginBottom: '4px' }}>Academic Year</span>
                                                <strong style={{ color: '#1E293B' }}>2025 - 2026 📅</strong>
                                            </div>
                                            <div style={{ padding: '8px 16px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px', background: 'white', display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ color: '#64748B', display: 'block', marginBottom: '4px' }}>Filter</span>
                                                <select 
                                                    value={examFilter} 
                                                    onChange={(e) => setExamFilter(e.target.value)}
                                                    style={{ border: 'none', background: 'transparent', color: '#1E293B', fontWeight: 'bold', outline: 'none', cursor: 'pointer', padding: '0', fontSize: '12px', fontFamily: 'inherit' }}
                                                >
                                                    <option value="All">All Terms</option>
                                                    {uniqueExamTypes.map(type => (
                                                        <option key={type} value={type}>
                                                            {{ unit_test: 'Unit Test', midterm: 'Mid-Term', final: 'Final', mock: 'Mock', practical: 'Practical', other: 'Other' }[type] || type}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {filteredResults.length > 0 ? (
                                        <>
                                            {(() => {
                                                const totalExams = filteredResults.length;
                                                const passedExams = filteredResults.filter(r => r.status === 'Pass').length;
                                                const failedExams = filteredResults.filter(r => r.status === 'Fail').length;
                                                const passRate = totalExams > 0 ? Math.round((passedExams / totalExams) * 100) : 0;
                                                const failRate = totalExams > 0 ? Math.round((failedExams / totalExams) * 100) : 0;
                                                const validPercentages = filteredResults.filter(r => !r.is_absent && r.percentage !== null).map(r => parseFloat(r.percentage));
                                                const avgPercentage = validPercentages.length > 0 ? (validPercentages.reduce((a, b) => a + b, 0) / validPercentages.length).toFixed(2) : '0.00';

                                                return (
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                                                        {/* Average Percentage Card */}
                                                        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
                                                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                                                <div style={{ background: '#EEF2FF', color: '#6366F1', padding: '12px', borderRadius: '12px', fontSize: '24px' }}>📄</div>
                                                                <div>
                                                                    <p style={{ color: '#64748B', fontSize: '13px', margin: '0 0 4px 0', fontWeight: '500' }}>Average Percentage</p>
                                                                    <h2 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#1E293B' }}>{avgPercentage}%</h2>
                                                                    <p style={{ color: '#64748B', fontSize: '12px', margin: 0 }}>Overall Performance</p>
                                                                </div>
                                                            </div>
                                                            <div style={{ marginTop: '16px', height: '6px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                                                                <div style={{ width: `${avgPercentage}%`, height: '100%', background: 'linear-gradient(90deg, #6366F1, #A855F7)', borderRadius: '4px' }}></div>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Total Exams Card */}
                                                        <div style={{ background: '#F8FAFC', border: '1px solid #DCFCE7', borderRadius: '12px', padding: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                                                            <div style={{ background: '#DCFCE7', color: '#16A34A', borderRadius: '50%', fontSize: '24px', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>
                                                            <div>
                                                                <p style={{ color: '#64748B', fontSize: '13px', margin: '0 0 4px 0', fontWeight: '500' }}>Total Exams</p>
                                                                <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#1E293B' }}>{totalExams}</h2>
                                                                <p style={{ color: '#64748B', fontSize: '12px', margin: 0 }}>All Subjects</p>
                                                            </div>
                                                        </div>

                                                        {/* Passed Exams Card */}
                                                        <div style={{ background: '#F8FAFC', border: '1px solid #DBEAFE', borderRadius: '12px', padding: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                                                            <div style={{ background: '#DBEAFE', color: '#2563EB', padding: '12px', borderRadius: '12px', fontSize: '24px', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🏆</div>
                                                            <div>
                                                                <p style={{ color: '#64748B', fontSize: '13px', margin: '0 0 4px 0', fontWeight: '500' }}>Passed Exams</p>
                                                                <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#1E293B' }}>{passedExams}</h2>
                                                                <p style={{ color: '#16A34A', fontSize: '12px', margin: 0, fontWeight: '600' }}>{passRate}% of total</p>
                                                            </div>
                                                        </div>

                                                        {/* Failed Exams Card */}
                                                        <div style={{ background: '#F8FAFC', border: '1px solid #FEE2E2', borderRadius: '12px', padding: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                                                            <div style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: '50%', fontSize: '24px', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</div>
                                                            <div>
                                                                <p style={{ color: '#64748B', fontSize: '13px', margin: '0 0 4px 0', fontWeight: '500' }}>Failed Exams</p>
                                                                <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#1E293B' }}>{failedExams}</h2>
                                                                <p style={{ color: '#DC2626', fontSize: '12px', margin: 0, fontWeight: '600' }}>{failRate}% of total</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                                                <div style={{ overflowX: 'auto' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', minWidth: '800px' }}>
                                                        <thead>
                                                            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                <th style={{ padding: '16px 24px' }}>Subject</th>
                                                                <th style={{ padding: '16px 24px' }}>Test/Exam</th>
                                                                <th style={{ padding: '16px 24px' }}>Date</th>
                                                                <th style={{ padding: '16px 24px' }}>Marks</th>
                                                                <th style={{ padding: '16px 24px' }}>Percentage</th>
                                                                <th style={{ padding: '16px 24px' }}>Grade</th>
                                                                <th style={{ padding: '16px 24px' }}>Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {filteredResults.map((mark, idx) => {
                                                                const isPassed = mark.status === 'Pass';
                                                                const isAbsent = mark.is_absent;
                                                                const typeLabel = {
                                                                    unit_test: 'Unit Test', midterm: 'Mid-Term',
                                                                    final: 'Final', mock: 'Mock', practical: 'Practical', other: 'Other'
                                                                }[mark.exam_type] || mark.exam_type || 'Exam';

                                                                const colors = ['#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#EC4899'];
                                                                const bgColor = colors[idx % colors.length];
                                                                const subjectInitials = (mark.subject_name || 'NA').substring(0,2).toUpperCase();

                                                                return (
                                                                    <tr key={`${mark.exam_id}-${idx}`} style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: isAbsent ? '#FAFAFA' : 'white', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isAbsent ? '#FAFAFA' : 'white'}>
                                                                        <td style={{ padding: '16px 24px' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: bgColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', flexShrink: 0 }}>
                                                                                    {subjectInitials}
                                                                                </div>
                                                                                <div>
                                                                                    <div style={{ fontWeight: '700', color: '#1E293B', fontSize: '15px' }}>{mark.subject_name || 'N/A'}</div>
                                                                                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{typeLabel}</div>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td style={{ padding: '16px 24px', color: '#64748B', fontWeight: '500' }}>{mark.exam_name}</td>
                                                                        <td style={{ padding: '16px 24px', color: '#64748B', fontSize: '13px' }}>{mark.exam_date ? new Date(mark.exam_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                                                                        <td style={{ padding: '16px 24px', fontWeight: '600', color: '#1E293B' }}>
                                                                            {isAbsent ? <span style={{ color: '#9CA3AF' }}>Absent</span> : `${mark.marks_obtained} / ${mark.total_marks}`}
                                                                        </td>
                                                                        <td style={{ padding: '16px 24px', fontWeight: '700', color: isAbsent ? '#9CA3AF' : isPassed ? '#16A34A' : '#DC2626' }}>
                                                                            {isAbsent ? '—' : `${mark.percentage}%`}
                                                                        </td>
                                                                        <td style={{ padding: '16px 24px', fontWeight: '700', color: isAbsent ? '#9CA3AF' : isPassed ? '#16A34A' : '#DC2626' }}>
                                                                            {isAbsent ? '—' : mark.grade || '—'}
                                                                        </td>
                                                                        <td style={{ padding: '16px 24px' }}>
                                                                            <span style={{ 
                                                                                background: isAbsent ? '#F3F4F6' : isPassed ? '#DCFCE7' : '#FEE2E2', 
                                                                                color: isAbsent ? '#4B5563' : isPassed ? '#16A34A' : '#DC2626', 
                                                                                padding: '4px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                                                                                border: `1px solid ${isAbsent ? '#E5E7EB' : isPassed ? '#BBF7D0' : '#FECACA'}`
                                                                            }}>
                                                                                {isAbsent ? 'Absent' : isPassed ? 'Pass' : 'Fail'}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="sd-empty-state">
                                            <div className="sd-empty-icon">📈</div>
                                            <h3>No Results Yet</h3>
                                            <p>{examFilter !== 'All' ? `No exam results found for ${examFilter}.` : `No exam results have been published for ${selectedStudent?.User?.name} yet.`}</p>
                                        </div>
                                    )}
                                </div>
                            );
                            })()}

                            {/* ═══ PERFORMANCE TAB ═══ */}
                            {activeTab === 'performance' && (
                                <div className="dashboard-card perf-page">
                                    <h3>📊 Comprehensive Performance — {selectedStudent?.User?.name}</h3>
                                    {performance ? (
                                        <div style={{ marginTop: '1.5rem' }}>
                                            {/* Score Row */}
                                            <div className="perf-score-row" style={{ gridTemplateColumns: '200px 1fr' }}>
                                                <div className="perf-main-score-card" style={{ padding: '1.5rem' }}>
                                                    <div className="perf-score-circle" style={{ width: 90, height: 90, borderColor: performance.score?.status === 'good' ? '#10b981' : performance.score?.status === 'average' ? '#f59e0b' : '#ef4444' }}>
                                                        <span className="perf-score-number" style={{ fontSize: '1.8rem', color: performance.score?.status === 'good' ? '#10b981' : performance.score?.status === 'average' ? '#f59e0b' : '#ef4444' }}>{performance.score?.score ?? '—'}</span>
                                                    </div>
                                                    <div className="perf-grade-badge" style={{ padding: '0.15rem 1rem', fontSize: '1.2rem', background: performance.score?.grade === 'F' ? '#ef4444' : '#6366f1' }}>
                                                        {performance.score?.grade || '—'}
                                                    </div>
                                                </div>
                                                <div className="perf-metric-cards">
                                                    <div className="perf-metric-card" style={{ borderTop: '4px solid #6366f1' }}>
                                                        <div className="perf-metric-icon">📝</div>
                                                        <div className="perf-metric-value" style={{ color: '#6366f1', fontSize: '1.3rem' }}>{performance.score?.marks_pct ?? '—'}%</div>
                                                        <div className="perf-metric-label">Marks</div>
                                                    </div>
                                                    <div className="perf-metric-card" style={{ borderTop: '4px solid #10b981' }}>
                                                        <div className="perf-metric-icon">📋</div>
                                                        <div className="perf-metric-value" style={{ color: '#10b981', fontSize: '1.3rem' }}>{performance.score?.att_pct ?? '—'}%</div>
                                                        <div className="perf-metric-label">Attendance</div>
                                                    </div>
                                                    <div className="perf-metric-card" style={{ borderTop: '4px solid #f59e0b' }}>
                                                        <div className="perf-metric-icon">📌</div>
                                                        <div className="perf-metric-value" style={{ color: '#f59e0b', fontSize: '1.3rem' }}>{performance.score?.ass_pct ?? '—'}%</div>
                                                        <div className="perf-metric-label">Assignments</div>
                                                    </div>
                                                    <div className="perf-metric-card" style={{ borderTop: '4px solid #a855f7' }}>
                                                        <div className="perf-metric-icon">💬</div>
                                                        <div className="perf-metric-value" style={{ color: '#a855f7', fontSize: '1.3rem' }}>{performance.score?.eng_pct ?? '—'}%</div>
                                                        <div className="perf-metric-label">Engagement</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Concerns */}
                                            {performance.concerns?.length > 0 && (
                                                <div className="perf-concern-banner">
                                                    <div className="perf-concern-title">⚠️ Areas of Concern</div>
                                                    {performance.concerns.map((c, idx) => (
                                                        <div key={idx} className="perf-concern-item">
                                                            • {c.message}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Progress Bars */}
                                            <div className="perf-card" style={{ marginTop: '1.5rem', boxShadow: 'none' }}>
                                                <h4 style={{ margin: '0 0 1rem 0' }}>Subject Breakdown</h4>
                                                <div className="perf-progress-group">
                                                    {performance.subjects?.map(s => (
                                                        <div key={s.subject_id} className="perf-progress-row">
                                                            <div className="perf-progress-header">
                                                                <span>{s.subject_name}</span>
                                                                <span style={{ color: s.below_passing ? '#ef4444' : '#6366f1' }}>{s.avg_pct}%</span>
                                                            </div>
                                                            <div className="perf-progress-track">
                                                                <div
                                                                    className="perf-progress-fill"
                                                                    style={{
                                                                        width: `${s.avg_pct}%`,
                                                                        background: s.below_passing ? '#ef4444' : '#6366f1'
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                                            Performance data not available yet.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ═══ FEES TAB ═══ */}
                            {activeTab === 'fees' && (
                                <div className="dashboard-card">
                                    <h3>💳 Fee Records — {selectedStudent?.User?.name}</h3>

                                    {/* Phase 6: Fee summary badges */}
                                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
                                        <div style={{
                                            padding: "0.85rem 1.5rem", borderRadius: "12px",
                                            background: "rgba(239,68,68,0.1)", border: "1.5px solid rgba(239,68,68,0.4)",
                                            color: "#ef4444"
                                        }}>
                                            <div style={{ fontWeight: 800, fontSize: "1.4rem" }}>₹{totalPendingAmount.toLocaleString()}</div>
                                            <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>⏳ Total Pending</div>
                                        </div>
                                        <div style={{
                                            padding: "0.85rem 1.5rem", borderRadius: "12px",
                                            background: "rgba(16,185,129,0.1)", border: "1.5px solid rgba(16,185,129,0.4)",
                                            color: "#10b981"
                                        }}>
                                            <div style={{ fontWeight: 800, fontSize: "1.4rem" }}>₹{totalPaidAmount.toLocaleString()}</div>
                                            <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>✅ Total Paid</div>
                                        </div>
                                        <div style={{
                                            padding: "0.85rem 1.5rem", borderRadius: "12px",
                                            background: "rgba(99,102,241,0.1)", border: "1.5px solid rgba(99,102,241,0.4)",
                                            color: "#6366f1"
                                        }}>
                                            <div style={{ fontWeight: 800, fontSize: "1.4rem" }}>₹{totalFees.toLocaleString()}</div>
                                            <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>💰 Total Fees</div>
                                        </div>
                                    </div>

                                    {fees?.length > 0 ? (
                                        <>
                                            {/* Desktop table */}
                                            <table className="data-table parent-fee-table">
                                                <thead>
                                                    <tr>
                                                        <th>Fee Type</th>
                                                        <th>Original</th>
                                                        <th>Discount</th>
                                                        <th>Final</th>
                                                        <th>Paid</th>
                                                        <th>Due</th>
                                                        <th>Due Date</th>
                                                        <th>Reminder</th>
                                                        <th>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {fees.map(fee => (
                                                        <tr key={fee.id}>
                                                            <td><strong>{fee.FeesStructure?.fee_type || 'Fee'}</strong></td>
                                                            <td>₹{parseFloat(fee.original_amount || 0).toLocaleString()}</td>
                                                            <td style={{ color: '#a855f7' }}>-₹{parseFloat(fee.discount_amount || 0).toLocaleString()}</td>
                                                            <td><strong>₹{parseFloat(fee.final_amount || 0).toLocaleString()}</strong></td>
                                                            <td style={{ color: '#10b981' }}>₹{parseFloat(fee.paid_amount || 0).toLocaleString()}</td>
                                                            <td style={{ color: '#ef4444', fontWeight: 700 }}>₹{parseFloat(fee.due_amount || 0).toLocaleString()}</td>
                                                            <td>{fee.FeesStructure?.due_date ? new Date(fee.FeesStructure.due_date).toLocaleDateString() : '—'}</td>
                                                            <td>
                                                                {fee.reminder_date ? (
                                                                    <span style={{ color: fee.reminder_date <= TODAY_STR ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                                                                        {new Date(fee.reminder_date).toLocaleDateString()}
                                                                    </span>
                                                                ) : '—'}
                                                            </td>
                                                            <td>
                                                                <span className={`status-badge status-${fee.status === 'paid' ? 'paid' : fee.status === 'partial' ? 'partial' : 'pending'}`}>
                                                                    {fee.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {/* Mobile fee cards */}
                                            <div className="parent-fee-cards mobile-table-card card-stagger">
                                                {fees.map(fee => (
                                                    <div key={fee.id} className={`fee-mobile-card ${fee.status}`}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                            <div className="fee-type">{fee.FeesStructure?.fee_type || 'Fee'}</div>
                                                            <span className={`status-badge status-${fee.status === 'paid' ? 'paid' : fee.status === 'partial' ? 'partial' : 'pending'}`}>
                                                                {fee.status}
                                                            </span>
                                                        </div>
                                                        <div className="fee-amounts">
                                                            <div className="fee-amount-item">Final: <strong>₹{parseFloat(fee.final_amount || 0).toLocaleString()}</strong></div>
                                                            <div className="fee-amount-item" style={{ color: '#10b981' }}>Paid: <strong>₹{parseFloat(fee.paid_amount || 0).toLocaleString()}</strong></div>
                                                            <div className="fee-amount-item" style={{ color: '#ef4444' }}>Due: <strong>₹{parseFloat(fee.due_amount || 0).toLocaleString()}</strong></div>
                                                        </div>
                                                        {fee.FeesStructure?.due_date && (
                                                            <div style={{ fontSize: '12px', color: '#888', marginTop: '6px' }}>
                                                                📅 Due: {new Date(fee.FeesStructure.due_date).toLocaleDateString()}
                                                                {fee.reminder_date && (
                                                                    <span style={{ marginLeft: '8px', color: fee.reminder_date <= TODAY_STR ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>
                                                                        ⏰ Reminder: {new Date(fee.reminder_date).toLocaleDateString()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="empty-state-mobile">
                                            <div className="empty-icon">💳</div>
                                            <div className="empty-title">No Fee Records</div>
                                            <div className="empty-desc">No fee records found for {selectedStudent?.User?.name}.</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ═══ TIMETABLE TAB ═══ */}
                            {activeTab === 'timetable' && (() => {
                                const { slots = [], timetable = [] } = timetableData;
                                
                                // Only show time slots that actually have classes in the student's timetable
                                const activeSlots = slots.filter(slot => 
                                    timetable.some(t => t.slot_id === slot.id)
                                );
                                
                                // Parent doesn't have student.Subjects so we infer enrolled subjects from timetable directly
                                const enrolledSubjectNames = Array.from(new Set(timetable.map(t => t.Subject?.name).filter(Boolean)));
                                
                                const getStartOfWeek = (date) => {
                                    const d = new Date(date);
                                    const day = d.getDay();
                                    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                                    return new Date(d.setDate(diff));
                                };

                                const handlePrevWeek = () => setTtCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
                                const handleNextWeek = () => setTtCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
                                const handleToday = () => setTtCurrentDate(new Date());

                                const startOfWeek = getStartOfWeek(ttCurrentDate);
                                const endOfWeek = new Date(startOfWeek);
                                endOfWeek.setDate(startOfWeek.getDate() + 6);

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

                                return (
                                    <div className="tt-v2-container" style={{ margin: 0, padding: 0 }}>
                                        {/* ── Header ── */}
                                        <div className="tt-v2-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div className="tt-v2-header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <div className="tt-v2-header-icon" style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', fontSize: '28px' }}>📅</div>
                                                <div className="tt-v2-header-titles">
                                                    <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>Class Timetable</h1>
                                                    <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Weekly class schedule for {selectedStudent?.User?.name}.</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ── Top Banner ── */}
                                        <div className="tt-v2-top-banner" style={{ marginTop: '24px' }}>
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
                                                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>N/A</span>
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

                                        {/* ── Controls Row ── */}
                                        <div className="tt-v2-controls" style={{ position: 'relative', marginTop: '24px' }}>
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
                                                    className={`tt-v2-view-btn ${ttViewMode === 'week' ? 'active' : ''}`}
                                                    style={{ background: ttViewMode === 'week' ? '#6366f1' : '#fff', color: ttViewMode === 'week' ? '#fff' : '#64748b' }}
                                                    onClick={() => setTtViewMode('week')}
                                                >
                                                    ▦ Week View
                                                </button>
                                                <button 
                                                    className={`tt-v2-view-btn ${ttViewMode === 'list' ? 'active' : ''}`}
                                                    style={{ background: ttViewMode === 'list' ? '#6366f1' : '#fff', color: ttViewMode === 'list' ? '#fff' : '#64748b' }}
                                                    onClick={() => setTtViewMode('list')}
                                                >
                                                    ☷ List View
                                                </button>
                                            </div>
                                        </div>

                                        {/* ── Timetable Grid / List View ── */}
                                        <div className="tt-v2-grid-container" style={{ marginTop: '24px' }}>
                                            {activeSlots.length === 0 ? (
                                                <div style={{ padding: "4rem", textAlign: "center", color: "#94a3b8" }}>
                                                    No time slots or schedules have been set up by the institute administrators.
                                                </div>
                                            ) : (
                                                ttViewMode === 'week' ? (
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

                                                                        if (entry) {
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
                                                                if (entry) return { slot, entry };
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
                                        <div className="tt-v2-legend" style={{ marginTop: '24px' }}>
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
                            })()}

                            {/* ═══ ASSIGNMENTS TAB — Phase 8 ═══ */}
                            {activeTab === 'assignments' && (
                                <div className="dashboard-card" style={{ padding: '0', background: 'transparent', boxShadow: 'none' }}>
                                    <div className="pa-stats-grid">
                                        <div className="pa-stat-card pa-stat-pending">
                                            <div className="pa-stat-icon-wrapper" style={{ fontSize: '22px' }}>⏳</div>
                                            <div className="pa-stat-content">
                                                <div className="pa-stat-value">{asgPending.length}</div>
                                                <div className="pa-stat-label">Pending</div>
                                                <div className="pa-stat-subtext">Not submitted yet</div>
                                            </div>
                                        </div>
                                        <div className="pa-stat-card pa-stat-resubmit">
                                            <div className="pa-stat-icon-wrapper" style={{ fontSize: '22px' }}>🔄</div>
                                            <div className="pa-stat-content">
                                                <div className="pa-stat-value">{asgResubmit.length}</div>
                                                <div className="pa-stat-label">Needs Resubmit</div>
                                                <div className="pa-stat-subtext">Action required</div>
                                            </div>
                                        </div>
                                        <div className="pa-stat-card pa-stat-awaiting">
                                            <div className="pa-stat-icon-wrapper" style={{ fontSize: '22px' }}>📥</div>
                                            <div className="pa-stat-content">
                                                <div className="pa-stat-value">{asgSubmitted.length}</div>
                                                <div className="pa-stat-label">Awaiting Grade</div>
                                                <div className="pa-stat-subtext">Under review</div>
                                            </div>
                                        </div>
                                        <div className="pa-stat-card pa-stat-graded">
                                            <div className="pa-stat-icon-wrapper" style={{ fontSize: '22px' }}>✅</div>
                                            <div className="pa-stat-content">
                                                <div className="pa-stat-value">{asgGraded.length}</div>
                                                <div className="pa-stat-label">Graded</div>
                                                <div className="pa-stat-subtext">Completed</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pa-assignments-card">
                                        <div className="pa-assignments-header">
                                            <div className="pa-assignments-title-group">
                                                <div className="pa-assignments-icon" style={{ fontSize: '20px' }}>👤</div>
                                                <h2>{selectedStudent.User?.name || selectedStudent.name}'s Assignments</h2>
                                            </div>
                                            <div className="pa-assignments-actions">
                                                <select 
                                                    className="pa-filter-dropdown" 
                                                    value={assignmentFilter} 
                                                    onChange={(e) => setAssignmentFilter(e.target.value)}
                                                >
                                                    <option value="all">All Assignments</option>
                                                    <option value="pending">Pending</option>
                                                    <option value="resubmit">Needs Resubmit</option>
                                                    <option value="awaiting">Awaiting Grade</option>
                                                    <option value="graded">Graded</option>
                                                </select>
                                                <span className="pa-total-count">{filteredAssignments.length} total</span>
                                            </div>
                                        </div>

                                        {filteredAssignments.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No assignments found.</div>
                                        ) : (
                                            <div className="pa-assignment-list">
                                                {filteredAssignments.map(asg => {
                                                    const sub = asg.my_submission;
                                                    const status = sub?.status || 'pending';
                                                    
                                                    let uiState = { icon: AsgIcons.DocPending, cls: 'pending', badgeText: 'Not Submitted', badgeCls: 'pa-badge-pending' };
                                                    if (status === 'graded') uiState = { icon: AsgIcons.DocCheck, cls: 'graded', badgeText: 'Graded', badgeCls: 'pa-badge-graded' };
                                                    else if (status === 'submitted' || status === 'late') uiState = { icon: AsgIcons.DocCross, cls: 'awaiting', badgeText: 'Awaiting Grade', badgeCls: 'pa-badge-awaiting' };
                                                    else if (status === 'resubmit_requested') uiState = { icon: AsgIcons.DocRefresh, cls: 'resubmit', badgeText: 'Resubmit', badgeCls: 'pa-badge-resubmit' };

                                                    const pct = status === 'graded' ? Math.round((sub.marks_obtained / asg.max_marks) * 100) : 0;
                                                    const scoreColor = pct >= 80 ? '#16a34a' : pct >= 60 ? '#2563eb' : pct >= 40 ? '#d97706' : '#dc2626';

                                                    return (
                                                        <div key={asg.id} className="pa-asg-item">
                                                            <div className="pa-asg-main">
                                                                <div className={`pa-asg-icon-large ${uiState.cls}`}>
                                                                    <uiState.icon />
                                                                </div>
                                                                <div className="pa-asg-info">
                                                                    <div className={`pa-asg-badge ${uiState.badgeCls}`}>{uiState.badgeText}</div>
                                                                    <h3 className="pa-asg-title">{asg.title}</h3>
                                                                    <div className="pa-asg-meta">
                                                                        <div className="pa-asg-meta-item">📚 Class {asg.Class?.name}</div>
                                                                        <span className="pa-asg-meta-divider">|</span>
                                                                        <div className="pa-asg-meta-item" style={{ fontSize: '13px' }}>{getAsgSubjectIcon(asg.Subject?.name)} {asg.Subject?.name}</div>
                                                                        <span className="pa-asg-meta-divider">|</span>
                                                                        <div className="pa-asg-meta-item">👤 {asg.faculty?.name || asg.faculty?.User?.name}</div>
                                                                    </div>
                                                                    <div className="pa-asg-dates">
                                                                        <div className="due">📅 Due: {new Date(asg.due_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
                                                                        {sub?.submitted_at && <div className="due">📅 Submitted on: {new Date(sub.submitted_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="pa-asg-metrics">
                                                                {status === 'graded' ? (
                                                                    <div className="pa-asg-metric-group">
                                                                        <div className="pa-metric-label">Score</div>
                                                                        <div><span className="pa-score-value" style={{ color: scoreColor }}>{sub.marks_obtained}</span> <span className="pa-score-total">/ {asg.max_marks}</span></div>
                                                                        <div className="pa-progress-bar"><div className="pa-progress-fill" style={{ width: `${pct}%`, background: scoreColor }}></div></div>
                                                                        <div className="pa-score-pct">{pct}%</div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="pa-asg-metric-group">
                                                                        <div className="pa-metric-label">Status</div>
                                                                        <div className="pa-status-badge">{status === 'pending' && asg.is_overdue ? 'Overdue' : status === 'pending' ? 'Not Started' : 'Under Review'}</div>
                                                                        <div className="pa-status-text">{status === 'pending' && asg.is_overdue ? 'Past due date' : status === 'pending' ? 'Please submit soon' : 'Teacher is reviewing your submission'}</div>
                                                                    </div>
                                                                )}

                                                                <div className="pa-asg-metric-group" style={{ minWidth: 80 }}>
                                                                    <div className="pa-metric-label">Grade</div>
                                                                    <div className={status === 'graded' ? 'pa-grade-value' : 'pa-score-total'} style={status === 'graded' ? { color: scoreColor } : {}}>
                                                                        {status === 'graded' ? sub.grade || '-' : '-'}
                                                                    </div>
                                                                </div>

                                                                <div className="pa-asg-metric-group" style={{ minWidth: 200 }}>
                                                                    <div className="pa-metric-label">Teacher Feedback</div>
                                                                    {status === 'graded' || status === 'resubmit_requested' ? (
                                                                        <div className="pa-feedback-box">
                                                                            <span style={{ color: '#6366f1' }}><AsgIcons.ChatBubble /></span>
                                                                            <span className="pa-feedback-text">{sub.feedback || 'No feedback provided.'}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="pa-score-total" style={{ fontStyle: 'italic', display: 'flex', alignItems: 'center', height: '36px' }}>
                                                                            Not reviewed yet
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ═══ CHAT TAB — Phase 8 ═══ */}
                            {activeTab === 'chat' && (
                                <div className="dashboard-card" style={{ textAlign: "center", padding: "3rem" }}>
                                    <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>💬</div>
                                    <h3 style={{ justifyContent: "center" }}>Direct Faculty Communication</h3>
                                    <p>
                                        Send messages directly to your child's faculty members.<br />
                                        <small style={{ color: "var(--text-muted)" }}>Faculty will see your name as "<strong>{user?.name} (Parent of {selectedStudent?.User?.name})</strong>"</small>
                                    </p>
                                    <button
                                        onClick={() => navigate('/parent/chat')}
                                        style={{
                                            marginTop: "1.5rem", padding: "0.85rem 2rem", borderRadius: "10px",
                                            background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff",
                                            border: "none", fontWeight: "700", fontSize: "1rem", cursor: "pointer",
                                            boxShadow: "0 4px 16px rgba(245,158,11,0.35)"
                                        }}
                                    >
                                        💬 Open Chat →
                                    </button>
                                </div>
                            )}
                            {/* ═══ ANNOUNCEMENTS TAB — Phase 9 ═══ */}
                            {activeTab === 'announcements' && (
                                <div className="dashboard-card" style={{ textAlign: "center", padding: "3rem" }}>
                                    <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>📢</div>
                                    <h3 style={{ justifyContent: "center" }}>Institute Announcements</h3>
                                    <p>Read important updates and notices from the school administration.</p>
                                    <button
                                        onClick={toggleSidebar}
                                        style={{
                                            marginTop: "1.5rem", padding: "0.85rem 2rem", borderRadius: "10px",
                                            background: "linear-gradient(135deg,#3B82F6,#2563EB)", color: "#fff",
                                            border: "none", fontWeight: "700", fontSize: "1rem", cursor: "pointer",
                                            boxShadow: "0 4px 16px rgba(59,130,246,0.35)"
                                        }}
                                    >
                                        📢 Open Announcements →
                                    </button>
                                </div>
                            )}
                        </>
                    )
                    }
                </div >
            ) : (
                <div className="dashboard-card" style={{ textAlign: "center", color: "var(--text-secondary)", padding: "3rem" }}>
                    <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>👨‍👩‍👧</div>
                    <p>No students linked to your account. Please contact administration.</p>
                </div>
            )}

            {/* Fee Reminder Popup */}
            {reminderPopup && reminderPopup.length > 0 && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.5)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        background: 'var(--bg-card, #fff)', padding: '2.5rem 2rem', borderRadius: '20px',
                        maxWidth: '450px', width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
                        textAlign: 'center', position: 'relative'
                    }}>
                        <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>⚠️</div>
                        <h2 style={{ color: '#ef4444', marginBottom: '1.5rem', fontWeight: 800 }}>Fee Reminder</h2>
                        <div style={{ textAlign: 'left', marginBottom: '2rem', maxHeight: '50vh', overflowY: 'auto' }}>
                            {reminderPopup.map((rem, idx) => (
                                <div key={idx} style={{
                                    padding: '1rem', background: rem.overdue ? '#fee2e2' : '#fef3c7',
                                    borderRadius: '12px', marginBottom: '0.75rem', borderLeft: `4px solid ${rem.overdue ? '#ef4444' : '#f59e0b'}`
                                }}>
                                    <p style={{ margin: 0, color: rem.overdue ? '#991b1b' : '#92400e', lineHeight: '1.5' }}>
                                        <strong>{rem.studentName}</strong> has pending fees of <strong style={{ fontSize: '1.1rem' }}>₹{parseFloat(rem.amount).toLocaleString()}</strong>.
                                        <br />
                                        <span style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: '4px', display: 'inline-block' }}>
                                            {rem.overdue ? 'Overdue since' : 'Reminder Date'}: {new Date(rem.date).toLocaleDateString()}
                                        </span>
                                    </p>
                                </div>
                            ))}
                        </div>
                        <button 
                            onClick={() => setReminderPopup(null)}
                            style={{
                                background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white',
                                padding: '14px 24px', borderRadius: '12px', border: 'none',
                                fontWeight: 'bold', fontSize: '1.05rem', cursor: 'pointer', width: '100%',
                                transition: 'transform 0.1s'
                            }}
                            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            Acknowledge
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ParentDashboard;
