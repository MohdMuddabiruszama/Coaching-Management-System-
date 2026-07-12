import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate, useOutletContext } from "react-router-dom";
import * as parentService from "../../services/parent.service";
import markService from "../../services/mark.service";
import performanceService from "../../services/performance.service";
import announcementService from "../../services/announcement.service";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { useParentDashboard } from "../../hooks/useMobileDashboard";
import { useParentBadges } from "../../hooks/useParentBadges";
import api from "../../services/api";
import "./MobileDashboard.css";

const GridIcons = {
  Overview: () => <span style={{ fontSize: '26px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>🏠</span>,
  Attendance: () => <span style={{ fontSize: '26px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>📋</span>,
  Marks: () => <span style={{ fontSize: '26px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>📈</span>,
  Performance: () => <span style={{ fontSize: '26px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>📊</span>,
  Fees: () => <span style={{ fontSize: '26px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>💳</span>,
  Timetable: () => <span style={{ fontSize: '26px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>📅</span>,
  Assignments: () => <span style={{ fontSize: '26px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>📝</span>,
  Chat: () => <span style={{ fontSize: '26px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>💬</span>,
  Announcements: () => <span style={{ fontSize: '26px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>📢</span>,
  More: () => (
    <div style={{ width: '26px', height: '26px', background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <div style={{ width: '4px', height: '4px', background: '#3b82f6', borderRadius: '50%' }}></div>
      <div style={{ width: '4px', height: '4px', background: '#3b82f6', borderRadius: '50%' }}></div>
      <div style={{ width: '4px', height: '4px', background: '#3b82f6', borderRadius: '50%' }}></div>
    </div>
  )
};

// ── QuickActionBtn Component (with Badge Support) ─────────────────────────
const QuickActionBtn = ({ icon, label, badge, badgeVariant = 'count-purple', onClick, isActive }) => {
    const hasCount = badge?.type === 'number' && badge.count > 0;
    const hasDot = badge?.type === 'dot';
    const hasAny = hasCount || hasDot;

    const variantStyles = {
        'count-purple': { bg: '#8b5cf6', shadow: 'rgba(139, 92, 246, 0.4)', border: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.2)' },
        'dot-blue': { bg: '#3b82f6', shadow: 'rgba(59, 130, 246, 0.5)', border: '#3b82f6', glow: 'rgba(59, 130, 246, 0.2)' },
        'dot-amber': { bg: '#f59e0b', shadow: 'rgba(245, 158, 11, 0.5)', border: '#f59e0b', glow: 'rgba(245, 158, 11, 0.2)' },
        'count-green': { bg: '#10b981', shadow: 'rgba(16, 185, 129, 0.4)', border: '#10b981', glow: 'rgba(16, 185, 129, 0.2)' },
    };
    const vs = variantStyles[badgeVariant] || variantStyles['count-purple'];

    return (
        <button
            className={`msd-action-btn${hasAny ? ' msd-action-btn--has-badge' : ''}${isActive ? ' active-tab' : ''}`}
            onClick={onClick}
            style={hasAny ? { '--qa-glow': vs.glow, '--qa-border': vs.border } : {}}
        >
            {/* Icon card */}
            <div className="msd-action-icon" style={hasAny ? {
                borderColor: vs.border,
                boxShadow: `0 0 0 2px ${vs.glow}, 0 4px 14px rgba(0,0,0,0.06)`,
            } : {}}>
                {typeof icon === 'string' ? <span>{icon}</span> : icon}

                {/* Numeric badge */}
                {hasCount && (
                    <span className="msd-qa-badge msd-qa-badge--count" style={{
                        background: vs.bg,
                        boxShadow: `0 2px 8px ${vs.shadow}`,
                    }}>
                        {badge.count > 99 ? '99+' : badge.count}
                    </span>
                )}

                {/* Dot badge with ripple */}
                {hasDot && (
                    <span className="msd-qa-badge msd-qa-badge--dot" style={{
                        background: vs.bg,
                        boxShadow: `0 0 0 0 ${vs.shadow}`,
                        '--ripple-color': vs.shadow,
                    }} />
                )}
            </div>

            {/* Label */}
            <span className="msd-action-label">{label}</span>
        </button>
    );
}


export default function MobileDashboard() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};
  const setSelectedGlobalChildId = outletContext.setSelectedGlobalChildId;
  const layoutAdvanceAttendanceCount = outletContext.advanceAttendanceCount;
  const { data: dashboardRes } = useParentDashboard();
  
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [activeTab, setActiveTab] = useState("Overview");
  
  const [attendance, setAttendance] = useState(null);
  const [results, setResults] = useState([]);
  const [fees, setFees] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState([]);

  // ── Notification Feed ───────────────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const socketRef = useRef(null);

  // Fetch recent notifications on mount
  useEffect(() => {
    api.get('/notifications?limit=10').then(res => {
      if (res.data?.success) {
        setNotifications(res.data.data || []);
        setNotifUnread((res.data.data || []).filter(n => !n.is_read).length);
      }
    }).catch(() => {});
  }, []);

  // Real-time socket listener for new punch notifications
  useEffect(() => {
    let socket;
    const connectSocket = async () => {
      try {
        const { io } = await import('socket.io-client');
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) return;
        const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.VITE_API_URL || '').replace('/api', '') || 'http://localhost:3001';
        socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
        socketRef.current = socket;
        socket.on('notification', (notif) => {
          setNotifications(prev => [notif, ...prev.slice(0, 19)]);
          setNotifUnread(prev => prev + 1);
        });
        // Also handle legacy event name
        socket.on('new_notification', (notif) => {
          setNotifications(prev => [notif, ...prev.slice(0, 19)]);
          setNotifUnread(prev => prev + 1);
        });
      } catch (e) { /* socket not available */ }
    };
    connectSocket();
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, []);

  const markNotifsRead = () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    api.patch('/notifications/mark-read', { ids: unreadIds }).catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setNotifUnread(0);
  };
  // ────────────────────────────────────────────────────────────────────────

  // ── Initialize badges hook ──────────────────────────────────────────────
  const { badges, clearBadge, advanceAttendanceCount } = useParentBadges(
      attendance, results, assignments, fees, user?.id, selectedStudent?.id
  );
  // Prefer the layout context advance fn if available (so navigation updates the badge accurately)
  const doAdvanceAttendance = layoutAdvanceAttendanceCount || advanceAttendanceCount;

  const [detailLoading, setDetailLoading] = useState(false);
  // Fee Reminder popup — shows once per session
  const [reminderPopup, setReminderPopup] = useState(null);

  const studentCache = useRef({});

  // ── Fee Reminder Helpers ────────────────────────────────────────────────
  // Calculates integer day difference between reminder date and today
  const getDaysUntilReminder = (reminderDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rem = new Date(reminderDate);
    rem.setHours(0, 0, 0, 0);
    return Math.round((rem - today) / (1000 * 60 * 60 * 24));
  };

  // Phased trigger: show at exactly 8d, exactly 4d, ≤2d, on/past date (never for paid)
  const shouldShowReminder = (fee) => {
    if (!fee.reminder_date || fee.status === 'paid') return false;
    const daysLeft = getDaysUntilReminder(fee.reminder_date);
    return daysLeft === 8 || daysLeft === 4 || daysLeft <= 2;
  };

  // Urgency: red = on/overdue, orange = future (8d, 4d, ≤2d)
  const getReminderUrgency = (reminderDate) => {
    return getDaysUntilReminder(reminderDate) <= 0 ? 'red' : 'orange';
  };
  // ────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const [data, announcementsData] = await Promise.all([
        parentService.getParentDashboard().catch(() => ({ data: { students: [] } })),
        announcementService.getInstituteAnnouncements().catch(() => [])
      ]);
      const loadedStudents = data?.data?.students || [];
      setStudents(loadedStudents);
      setRecentAnnouncements(Array.isArray(announcementsData) ? announcementsData.slice(0, 3) : []);

      // ── Build once-per-session reminder popup from StudentFees ────────────
      // Uses sessionStorage so it shows only once per login session.
      // Re-appears after logout / tab close (same as web dashboard).
      const hasShown = sessionStorage.getItem('mobilePopupShown');
      if (!hasShown) {
        const popups = [];
        loadedStudents.forEach(st => {
          if (st.StudentFees) {
            st.StudentFees.forEach(fee => {
              if (shouldShowReminder(fee)) {
                const daysLeft = getDaysUntilReminder(fee.reminder_date);
                popups.push({
                  studentName: st.User?.name || 'Student',
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
          setReminderPopup(popups);
          sessionStorage.setItem('mobilePopupShown', 'true');
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      if (loadedStudents.length > 0) {
        const storedId = sessionStorage.getItem("parentSelectedStudentId");
        const studentToSelect = loadedStudents.find(s => s.id.toString() === storedId) || loadedStudents[0];
        await selectStudent(studentToSelect);
      }
    } catch (error) {
      console.error("Error fetching mobile parent dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectStudent = async (student) => {
    if (!student || !student.id) return;
    
    sessionStorage.setItem("parentSelectedStudentId", student.id.toString());
    setSelectedStudent(student);
    if (setSelectedGlobalChildId) setSelectedGlobalChildId(student.id.toString());
    if (studentCache.current[student.id]) {
      const cached = studentCache.current[student.id];
      setAttendance(cached.attendance);
      setResults(cached.results);
      setFees(cached.fees);
      setPerformance(cached.performance);
      setAssignments(cached.assignments || []);
      return;
    }

    setDetailLoading(true);
    try {
      const [attData, resData, feeData, perfData, asgData] = await Promise.all([
        parentService.getLinkedStudentAttendance(student.id).catch(() => ({ data: null })),
        markService.getParentChild(student.id).catch(() => []),
        parentService.getLinkedStudentFees(student.id).catch(() => ({ data: [] })),
        performanceService.getChildPerformance(student.id).catch(() => null),
        parentService.getLinkedStudentAssignments(student.id).catch(() => ({ assignments: [] }))
      ]);
      
      const fetchedAttendance = attData?.data || null;
      const fetchedResults = Array.isArray(resData) ? resData : (resData?.data || []);
      const fetchedFees = feeData?.data || [];
      const fetchedAssignments = asgData?.assignments || [];
      
      studentCache.current[student.id] = {
        attendance: fetchedAttendance,
        results: fetchedResults,
        fees: fetchedFees,
        performance: perfData,
        assignments: fetchedAssignments
      };

      setAttendance(fetchedAttendance);
      setResults(fetchedResults);
      setFees(fetchedFees);
      setPerformance(perfData);
      setAssignments(fetchedAssignments);
    } catch (error) {
      console.error("Error fetching details for student", error);
    } finally {
      setDetailLoading(false);
    }
  };

  const overallAttendanceStats = useMemo(() => {
    if (!attendance?.records || attendance.records.length === 0) {
        return {
            averagePercentage: attendance?.summary?.attendance_percentage || 0,
            totalWorkingDays: attendance?.summary?.working_days || 0,
            totalPresent: attendance?.summary?.present_days || 0,
        };
    }

    const present = attendance.records.filter(r => r.status === 'present').length;
    const absent = attendance.records.filter(r => r.status === 'absent').length;
    const late = attendance.records.filter(r => r.status === 'late').length;
    const halfDay = attendance.records.filter(r => r.status === 'half_day').length;
    
    const working = present + absent + late + halfDay;
    const presentCount = present + late + (halfDay * 0.5);
    
    let averagePercentage = 0;
    if (working > 0) {
        averagePercentage = Number(((presentCount / working) * 100).toFixed(2));
    }

    return {
        averagePercentage,
        totalWorkingDays: working,
        totalPresent: presentCount
    };
  }, [attendance]);

  const attPct = overallAttendanceStats.averagePercentage;
  const presentDays = overallAttendanceStats.totalPresent;
  const totalDays = overallAttendanceStats.totalWorkingDays;

  const safeAssignments = Array.isArray(assignments) ? assignments : [];
  const totalAssignments = safeAssignments.length;
  const completedAssignments = safeAssignments.filter(a => a && a.my_submission && ['submitted', 'late', 'graded'].includes(a.my_submission.status)).length;
  const assignmentsPct = totalAssignments ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

  const safeFees = Array.isArray(fees) ? fees : [];
  const pendingFees = safeFees.filter(f => f && (f.status === 'pending' || f.status === 'partial'));
  const totalPendingAmount = pendingFees.reduce((acc, f) => acc + parseFloat(f.due_amount || 0), 0);
  const totalPaidAmount = safeFees.reduce((acc, f) => acc + parseFloat(f.paid_amount || 0), 0);
  const totalFees = safeFees.reduce((acc, f) => acc + parseFloat(f.final_amount || 0), 0);
  
  const safeResults = Array.isArray(results) ? results : [];
  const passedExams = safeResults.filter(r => r && r.status === 'Pass').length;
  const passRate = safeResults.length ? Math.round((passedExams / safeResults.length) * 100) : 0;

  const enrolledSubjectPerformance = useMemo(() => {
    let subjectsList = [];
    if (selectedStudent?.Subjects && selectedStudent.Subjects.length > 0) {
        subjectsList = selectedStudent.Subjects.map(s => s.name);
    } else if (selectedStudent?.Classes?.length > 0) {
        selectedStudent.Classes.forEach(cls => {
            if (cls.Subjects && cls.Subjects.length > 0) {
                cls.Subjects.forEach(sub => {
                    if (!subjectsList.includes(sub.name)) subjectsList.push(sub.name);
                });
            }
        });
    }

    if (subjectsList.length === 0 && attendance?.records) {
        const attSubjects = new Set();
        attendance.records.forEach(r => {
            const subName = r.Subject?.name || r.Class?.name;
            if (subName) attSubjects.add(subName);
        });
        subjectsList = Array.from(attSubjects);
    }

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
    }).slice(0, 3);
  }, [performance, selectedStudent, attendance]);

  // ── Sync Header Color with Visible Fee Reminder Message ────────────────
  const setHeaderBgColor = outletContext.setHeaderBgColor;

  let showingReminderUrgency = 'normal';
  if (activeTab === "Overview" && safeFees.length > 0) {
    const showingFees = safeFees.filter(f => shouldShowReminder(f));
    if (showingFees.length > 0) {
      if (showingFees.some(f => getReminderUrgency(f.reminder_date) === 'red')) {
        showingReminderUrgency = 'red';
      } else {
        showingReminderUrgency = 'orange';
      }
    }
  }

  useEffect(() => {
    if (setHeaderBgColor) {
      setHeaderBgColor(showingReminderUrgency);
    }
    // Cleanup on unmount or tab switch
    return () => {
      if (setHeaderBgColor) setHeaderBgColor('normal');
    };
  }, [showingReminderUrgency, setHeaderBgColor]);
  // ────────────────────────────────────────────────────────────────────────


  if (loading) {
    return (
      <div className="mpd-loading">
        <LoadingSpinner />
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="mpd-layout">
      {/* USER BANNER */}
      <div className="mpd-user-banner">
        <div className="mpd-user-content">
          <div className="mpd-user-info">
            <p className="mpd-welcome">Welcome back,</p>
            <h2 className="mpd-user-name">{user?.name || "Parent"}!</h2>
            <p className="mpd-student-context">
              Here's how {selectedStudent?.User?.name ? selectedStudent.User.name.split(" ")[0] : "your child"} is doing.
            </p>
          </div>
        </div>
      </div>

      {/* STUDENT SELECTOR */}
      <div className="mpd-student-scroll">
        {students.length > 0 ? students.map((student, idx) => {
          const isSelected = selectedStudent?.id === student.id;
          const initials = student.User?.name?.substring(0,2).toUpperCase() || 'ST';

          // ── Fee Reminder Card Status (per Workflow Report) ─────────────────
          // Uses reminderDate ONLY (not dueDate) to determine card color.
          // All comparisons use midnight-normalised local dates (Math.round).
          //   diffDays === 8  → ORANGE  (24-hour window — only fires today)
          //   diffDays === 4  → ORANGE  (24-hour window — only fires today)
          //   diffDays === 1  → RED     (1 day before reminder)
          //   diffDays === 0  → RED     (exact reminder date)
          //   diffDays < 0   → RED     (overdue — reminder date passed)
          //   fee.status === 'paid' → skipped → NORMAL
          let cardStatus = 'normal';
          const childData = dashboardRes?.data?.children?.find(c => c.studentId === student.id);
          const feeListToUse = student.StudentFees?.length > 0 ? student.StudentFees : childData?.fees?.pendingList;
          if (feeListToUse?.length > 0) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let foundRed = false;
            let foundOrange = false;
            for (const fee of feeListToUse) {
              if (fee.status === 'paid') continue;
              const rDate = fee.reminderDate || fee.reminder_date;
              if (!rDate) continue;
              const remD = new Date(rDate);
              remD.setHours(0, 0, 0, 0);
              const diffDays = Math.round((remD - today) / (1000 * 60 * 60 * 24));
              if (diffDays <= 0) {
                // Exact date (0) or overdue (negative) → RED
                foundRed = true;
                break; // red is highest priority
              } else if (diffDays === 1 || diffDays === 2 || diffDays === 4 || diffDays === 8) {
                // 8, 4, 2, or 1 days before → ORANGE
                foundOrange = true;
                // keep looping — another fee might still be red
              }
            }
            if (foundRed) cardStatus = 'red';
            else if (foundOrange) cardStatus = 'orange';
          }

          // ── Card visual style based on status ─────────────────────────────
          let cardStyle = {};
          let avatarStyle = {};
          let textStyle = {};
          let badgeStyle = {};
          let badgeLabel = 'ACTIVE';

          if (cardStatus === 'red') {
            badgeLabel = 'FEE ALERT';
            if (isSelected) {
              cardStyle = { background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', borderColor: 'transparent' };
              avatarStyle = { background: 'rgba(255,255,255,0.25)', color: '#fff' };
              textStyle = { color: 'rgba(255,255,255,0.9)' };
              badgeStyle = { background: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700 };
            } else {
              cardStyle = { background: '#fef2f2', border: '1.5px solid #ef4444' };
              avatarStyle = { background: '#ef4444', color: '#fff' };
              badgeStyle = { background: '#fee2e2', color: '#ef4444', fontWeight: 700 };
            }
          } else if (cardStatus === 'orange') {
            badgeLabel = 'FEE ALERT';
            if (isSelected) {
              cardStyle = { background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', borderColor: 'transparent' };
              avatarStyle = { background: 'rgba(255,255,255,0.25)', color: '#fff' };
              textStyle = { color: 'rgba(255,255,255,0.9)' };
              badgeStyle = { background: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700 };
            } else {
              cardStyle = { background: '#fffbeb', border: '1.5px solid #f59e0b' };
              avatarStyle = { background: '#f59e0b', color: '#fff' };
              badgeStyle = { background: '#fef3c7', color: '#d97706', fontWeight: 700 };
            }
          }

          // For normal selected card — use the default 'active' CSS class (purple gradient)
          const cardClassName = [
            'mpd-student-card',
            isSelected && cardStatus === 'normal' ? 'active' : '',
            idx % 2 !== 0 && !isSelected && cardStatus === 'normal' ? 'white-bg' : ''
          ].filter(Boolean).join(' ');

          return (
            <div
              key={student.id}
              className={cardClassName}
              style={cardStyle}
              onClick={() => selectStudent(student)}
            >
              <div className="mpd-student-avatar-circle" style={avatarStyle}>{initials}</div>
              <div className="mpd-student-details">
                <h3 style={isSelected && cardStatus !== 'normal' ? { color: '#fff' } : {}}>{student.User?.name || 'Student Name'}</h3>
                <p style={textStyle}>
                  Roll: {student.roll_number || `Class10-22${idx}`} | {student.Classes?.[0]?.name || 'Class'}
                </p>
                <span className="mpd-active-badge" style={badgeStyle}>
                  {badgeLabel}
                </span>
              </div>
            </div>
          );
        }) : (
          <div className="mpd-student-card white-bg" style={{width: '100%'}}>
             <div className="mpd-student-details">
                <h3>No Students Linked</h3>
                <p>Contact administrator</p>
             </div>
          </div>
        )}
      </div>

      {/* QUICK ACTIONS GRID */}
      <div className="mpd-grid-card">
        <div className="msd-quick-actions">
          <QuickActionBtn
              icon={<GridIcons.Overview />}
              label="Overview"
              isActive={activeTab === 'Overview'}
              onClick={() => setActiveTab('Overview')}
          />
          {user?.features?.attendance !== 'none' && (
              <QuickActionBtn
                  icon={<GridIcons.Attendance />}
                  label="Attendance"
                  badge={badges.attendance}
                  badgeVariant="dot-blue"
                  onClick={() => {
                      clearBadge('attendance');
                      if (doAdvanceAttendance && attendance?.records) {
                          doAdvanceAttendance(attendance.records.length);
                      }
                      navigate('/parent/attendance');
                  }}
              />
          )}
          {user?.features?.exams && (
              <QuickActionBtn
                  icon={<GridIcons.Marks />}
                  label="Marks"
                  badge={badges.marks}
                  badgeVariant="count-purple"
                  onClick={() => { clearBadge('marks'); navigate('/parent/marks'); }}
              />
          )}
          {user?.features?.exams && (
              <QuickActionBtn
                  icon={<GridIcons.Performance />}
                  label="Performance"
                  badge={badges.performance}
                  badgeVariant="dot-blue"
                  onClick={() => { clearBadge('performance'); navigate('/parent/performance'); }}
              />
          )}
          {user?.features?.fees && (
              <QuickActionBtn
                  icon={<GridIcons.Fees />}
                  label="Fees"
                  badge={badges.fees}
                  badgeVariant="dot-amber"
                  onClick={() => { clearBadge('fees'); navigate('/parent/fees'); }}
              />
          )}
          {user?.features?.timetable && (
              <QuickActionBtn
                  icon={<GridIcons.Timetable />}
                  label="Timetable"
                  onClick={() => navigate('/parent/timetable')}
              />
          )}
          {user?.features?.notes && (
              <QuickActionBtn
                  icon={<GridIcons.Assignments />}
                  label="Assignments"
                  badge={badges.assignments}
                  badgeVariant="count-purple"
                  onClick={() => { clearBadge('assignments'); navigate('/parent/assignments'); }}
              />
          )}
          {user?.features?.chat && (
              <QuickActionBtn
                  icon={<GridIcons.Chat />}
                  label="Chat"
                  badge={badges.chat}
                  badgeVariant="count-green"
                  onClick={() => { clearBadge('chat'); navigate('/parent/chat'); }}
              />
          )}
          {user?.features?.announcements && (
              <QuickActionBtn
                  icon={<GridIcons.Announcements />}
                  label="Announcements"
                  badge={badges.announcements}
                  badgeVariant="count-purple"
                  onClick={() => { clearBadge('announcements'); navigate('/parent/announcements'); }}
              />
          )}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      {detailLoading ? (
         <div className="mpd-loading" style={{ height: '300px' }}><LoadingSpinner /></div>
      ) : activeTab === 'Overview' && (
        <div className="mpd-overview-content">

          {/* ── PERSISTENT FEE REMINDER ALERT BANNERS ─────────────────────── */}
          {/* Visible as long as the trigger conditions are met (paid fee auto-hides) */}
          {safeFees.filter(f => shouldShowReminder(f)).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
              {safeFees.filter(f => shouldShowReminder(f)).map((fee, idx) => {
                const urgency = getReminderUrgency(fee.reminder_date);
                const daysLeft = getDaysUntilReminder(fee.reminder_date);
                const isRed = urgency === 'red';
                const daysText = daysLeft > 0
                  ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`
                  : daysLeft === 0
                    ? 'Due today!'
                    : `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''}`;
                return (
                  <div key={idx} style={{
                    background: isRed
                      ? 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.05))'
                      : 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.05))',
                    border: `1.5px solid ${isRed ? 'rgba(239,68,68,0.5)' : 'rgba(245,158,11,0.5)'}`,
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}>
                    <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>
                      {isRed ? '🚨' : '⚠️'}
                    </span>
                    <div style={{
                      color: isRed ? '#dc2626' : '#d97706',
                      fontWeight: '600',
                      fontSize: '13px',
                      lineHeight: '1.5'
                    }}>
                      {selectedStudent?.User?.name} has pending fees. Please pay before the reminder date:{' '}
                      {new Date(fee.reminder_date).toLocaleDateString('en-IN')}.
                      {' '}<span style={{ fontWeight: 700, fontSize: '12px', opacity: 0.85 }}>({daysText})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* ────────────────────────────────────────────────────────────────── */}

          {/* ── BIOMETRIC NOTIFICATION FEED ──────────────────────────────────── */}
          {notifications.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>🔔</span>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>Recent Alerts</span>
                  {notifUnread > 0 && (
                    <span style={{
                      background: '#8b5cf6', color: '#fff', borderRadius: '20px',
                      fontSize: '10px', fontWeight: 700, padding: '1px 7px', minWidth: '18px', textAlign: 'center'
                    }}>{notifUnread > 9 ? '9+' : notifUnread}</span>
                  )}
                </div>
                {notifUnread > 0 && (
                  <button onClick={markNotifsRead} style={{
                    background: 'none', border: 'none', color: '#8b5cf6',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: '2px 6px'
                  }}>Mark all read</button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {notifications.slice(0, 5).map((notif, idx) => {
                  const isGate = notif.type === 'biometric_gate_punch';
                  const isIn = notif.data_json?.punch_type === 'in';
                  const emoji = isGate ? (isIn ? '✅' : '🚪') : (isIn ? '📚' : '📤');
                  const accent = isGate ? (isIn ? '#10b981' : '#f59e0b') : '#8b5cf6';
                  const timeStr = notif.created_at ? new Date(notif.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
                  return (
                    <div key={notif.id || idx} style={{
                      background: notif.is_read ? '#f8fafc' : `${accent}0d`,
                      border: `1.5px solid ${notif.is_read ? '#e2e8f0' : accent + '40'}`,
                      borderRadius: '12px',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      transition: 'all 0.3s ease'
                    }}>
                      <span style={{
                        fontSize: '20px', flexShrink: 0,
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: `${accent}1a`, display: 'flex',
                        alignItems: 'center', justifyContent: 'center'
                      }}>{emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: notif.is_read ? 500 : 700,
                          fontSize: '13px',
                          color: '#1e293b',
                          marginBottom: '2px',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>{notif.title}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>{notif.body}</div>
                      </div>
                      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{timeStr}</span>
                        {!notif.is_read && (
                          <span style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: accent, display: 'block', flexShrink: 0
                          }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* ───────────────────────────────────────────────────────────────── */}

          {/* STATS GRID */}
          <div className="mpd-stats-grid">
            {user?.features?.attendance !== 'none' && (
              <div className="mpd-stat-box">
                <div className="mpd-stat-header">
                  <span className="mpd-stat-icon green-icon">📋</span>
                  <span className="mpd-stat-title">Attendance</span>
                </div>
                <div className="mpd-stat-value">{attPct}%</div>
                <div className="mpd-stat-bar-bg"><div className="mpd-stat-bar-fill green-fill" style={{width: `${attPct}%`}}></div></div>
                <div className="mpd-stat-footer">
                  <span>Present Days</span>
                  <span>{presentDays} / {totalDays}</span>
                </div>
              </div>
            )}

            <div className="mpd-stat-box">
              <div className="mpd-stat-header">
                <span className="mpd-stat-icon purple-icon">📚</span>
                <span className="mpd-stat-title">Classes Enrolled</span>
              </div>
              <div className="mpd-stat-value">{selectedStudent?.Classes?.length || 1}</div>
              <div className="mpd-stat-footer mt-auto">
                <span>Program Type</span>
                <span className="text-dark">Full Course</span>
              </div>
            </div>

            {user?.features?.notes && (
              <div className="mpd-stat-box">
                <div className="mpd-stat-header">
                  <span className="mpd-stat-icon blue-icon">📝</span>
                  <span className="mpd-stat-title">Assignments</span>
                </div>
                <div className="mpd-stat-value">{completedAssignments} <span className="small-val">/ {totalAssignments}</span></div>
                <div className="mpd-stat-footer mt-auto">
                  <span>Completed</span>
                  <span className="text-dark">{assignmentsPct}%</span>
                </div>
              </div>
            )}

            {user?.features?.fees && (
              <>
                <div className="mpd-stat-box">
                  <div className="mpd-stat-header">
                    <span className="mpd-stat-icon yellow-icon">⏳</span>
                    <span className="mpd-stat-title">Pending Fees</span>
                  </div>
                  <div className="mpd-stat-value">₹{totalPendingAmount.toLocaleString('en-IN')}</div>
                  <div className="mpd-stat-footer mt-auto">
                    <span>Status</span>
                    <span className="text-dark">{pendingFees.length} pending</span>
                  </div>
                </div>

                <div className="mpd-stat-box">
                  <div className="mpd-stat-header">
                    <span className="mpd-stat-icon green-icon">✅</span>
                    <span className="mpd-stat-title">Paid Fees</span>
                  </div>
                  <div className="mpd-stat-value">₹{totalPaidAmount.toLocaleString('en-IN', {maximumFractionDigits: 0}) || "0"}</div>
                  <div className="mpd-stat-bar-bg"><div className="mpd-stat-bar-fill green-fill" style={{width: totalFees ? `${(totalPaidAmount/totalFees)*100}%` : '100%'}}></div></div>
                  <div className="mpd-stat-footer">
                    <span>Total Fees</span>
                    <span className="text-dark">₹{totalFees.toLocaleString('en-IN', {maximumFractionDigits: 0}) || "0"}</span>
                  </div>
                </div>
              </>
            )}

            {user?.features?.exams && (
              <div className="mpd-stat-box">
                <div className="mpd-stat-header">
                  <span className="mpd-stat-icon red-icon">🎯</span>
                  <span className="mpd-stat-title">Exam Results</span>
                </div>
                <div className="mpd-stat-value">{passedExams} <span className="small-val">/ {safeResults.length || 1}</span></div>
                <div className="mpd-stat-bar-bg"><div className="mpd-stat-bar-fill" style={{width: `${passRate}%`, background: '#10b981'}}></div></div>
                <div className="mpd-stat-footer">
                  <span>Pass Rate</span>
                  <span className="text-green">{passRate}%</span>
                </div>
              </div>
            )}
          </div>

          {/* LIGHT ACCENT GRID */}
          <div className="mpd-accent-grid">
            {user?.features?.exams && (
              <div className="mpd-accent-card">
                <div className="mpd-card-header">
                  <h3>📊 Subject Performance</h3>
                  <span className="mpd-link" onClick={() => navigate('/parent/performance')}>View all</span>
                </div>
                <div className="mpd-card-body">
                  {enrolledSubjectPerformance.map((sub, idx) => (
                    <div key={idx} className="mpd-perf-row">
                      <span className="mpd-perf-name">{sub.name}</span>
                      <div className="mpd-perf-bar-wrap">
                        <div className="mpd-perf-bar" style={{width: `${sub.pct}%`, background: sub.color}}></div>
                      </div>
                      <span className="mpd-perf-pct">{sub.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {user?.features?.announcements && (
              <div className="mpd-accent-card">
                <div className="mpd-card-header">
                  <h3>Recent Announcements</h3>
                  <span className="mpd-link" onClick={() => navigate('/parent/announcements')}>View all</span>
                </div>
                <div className="mpd-card-body">
                  {recentAnnouncements.length > 0 ? recentAnnouncements.map((ann, idx) => (
                    <div key={idx} className="mpd-ann-item">
                      <div className="mpd-ann-icon">📢</div>
                      <div className="mpd-ann-text">
                        <h4>{ann.title}</h4>
                        <p>{ann.message || ann.content}</p>
                        <span className="mpd-time">Recent</span>
                      </div>
                    </div>
                  )) : (
                    <div className="mpd-ann-item">
                      <div className="mpd-ann-icon" style={{background: '#fce7f3', color: '#ec4899'}}>📢</div>
                      <div className="mpd-ann-text">
                        <h4>No Announcements</h4>
                        <p>You have no recent announcements.</p>
                        <span className="mpd-time">Now</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FEE REMINDER MODAL POPUP ─────────────────────────────────────── */}
      {/* Appears once per session (sessionStorage: mobilePopupShown).        */}
      {/* Dismissed on Acknowledge; won't reappear until logout / tab close.  */}
      {reminderPopup && reminderPopup.length > 0 && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.55)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px', backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#fff', borderRadius: '20px',
            maxWidth: '380px', width: '100%',
            boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
            padding: '28px 20px 24px',
            textAlign: 'center',
            maxHeight: '85vh',
            display: 'flex', flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{ fontSize: '3rem', marginBottom: '6px' }}>⚠️</div>
            <h2 style={{
              color: '#ef4444', marginBottom: '18px',
              fontWeight: 800, fontSize: '1.3rem'
            }}>Fee Reminder</h2>

            {/* Reminder list — scrollable if many entries */}
            <div style={{
              flex: 1, overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: '10px',
              marginBottom: '20px', textAlign: 'left'
            }}>
              {reminderPopup.map((rem, idx) => (
                <div key={idx} style={{
                  padding: '12px 14px',
                  background: rem.overdue ? '#fee2e2' : '#fef3c7',
                  borderRadius: '12px',
                  borderLeft: `4px solid ${rem.overdue ? '#ef4444' : '#f59e0b'}`
                }}>
                  <p style={{
                    margin: 0,
                    color: rem.overdue ? '#991b1b' : '#92400e',
                    lineHeight: '1.55',
                    fontSize: '14px'
                  }}>
                    <strong>{rem.studentName}</strong> has pending fees of{' '}
                    <strong style={{ fontSize: '15px' }}>
                      ₹{parseFloat(rem.amount).toLocaleString('en-IN')}
                    </strong>.
                    <br />
                    <span style={{ fontSize: '12px', opacity: 0.9, marginTop: '4px', display: 'inline-block' }}>
                      {rem.overdue ? 'Overdue since' : 'Reminder Date'}:{' '}
                      {new Date(rem.date).toLocaleDateString('en-IN')}
                    </span>
                  </p>
                </div>
              ))}
            </div>

            {/* Acknowledge button */}
            <button
              onClick={() => setReminderPopup(null)}
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: '#fff',
                padding: '14px 20px',
                borderRadius: '12px',
                border: 'none',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: 'pointer',
                width: '100%',
                letterSpacing: '0.5px',
                boxShadow: '0 4px 14px rgba(239,68,68,0.4)',
                transition: 'transform 0.1s, box-shadow 0.1s'
              }}
              onTouchStart={e => e.currentTarget.style.transform = 'scale(0.97)'}
              onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}
      {/* ────────────────────────────────────────────────────────────────── */}
    </div>
  );
}
