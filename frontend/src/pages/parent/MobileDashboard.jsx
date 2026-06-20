import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import * as parentService from "../../services/parent.service";
import markService from "../../services/mark.service";
import performanceService from "../../services/performance.service";
import announcementService from "../../services/announcement.service";
import LoadingSpinner from "../../components/common/LoadingSpinner";
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

export default function MobileDashboard() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  
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
  const [detailLoading, setDetailLoading] = useState(false);

  const studentCache = useRef({});

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
    if (!performance?.subjects || !Array.isArray(performance.subjects)) {
        return [
            {name: "Economics", pct: 0, color: "#e2e8f0"}, 
            {name: "English", pct: 0, color: "#ef4444"}
        ];
    }
    return performance.subjects.map((sub, i) => {
        const colors = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
        return {
            name: sub.subject_name || 'Subject',
            pct: Math.round(sub.avg_pct || 0),
            color: sub.below_passing ? '#ef4444' : colors[i % colors.length]
        };
    }).slice(0, 3);
  }, [performance]);

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
          <div className="mpd-user-avatar">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'Jane'}&backgroundColor=fde047`} alt="avatar" />
          </div>
          <div className="mpd-user-info">
            <p className="mpd-welcome">Welcome back,</p>
            <h2 className="mpd-user-name">{user?.name || "Parent"}!</h2>
            <p className="mpd-student-context">
              Here's how {selectedStudent?.User?.name ? selectedStudent.User.name.split(" ")[0] : "your child"} is doing.
            </p>
          </div>
        </div>
        <button className="mpd-logout-btn" onClick={logout}>
          <span style={{ fontSize: '14px', marginRight: '4px' }}>🚪</span> Logout
        </button>
      </div>

      {/* STUDENT SELECTOR */}
      <div className="mpd-student-scroll">
        {students.length > 0 ? students.map((student, idx) => {
          const isSelected = selectedStudent?.id === student.id;
          const initials = student.User?.name?.substring(0,2).toUpperCase() || 'ST';
          return (
            <div 
              key={student.id} 
              className={`mpd-student-card ${isSelected ? 'active' : ''} ${idx % 2 !== 0 && !isSelected ? 'white-bg' : ''}`}
              onClick={() => selectStudent(student)}
            >
              <div className="mpd-student-avatar-circle">{initials}</div>
              <div className="mpd-student-details">
                <h3>{student.User?.name}</h3>
                <p>Roll: {student.roll_number || `Class10-22${idx}`} | {student.Classes?.[0]?.name || 'Class'}</p>
                <span className="mpd-active-badge">ACTIVE</span>
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
        <div className="mpd-quick-actions">
          <div className="mpd-action-item active-tab">
            <div className="mpd-action-icon"><GridIcons.Overview /></div>
            <span>Overview</span>
          </div>
          <div className="mpd-action-item" onClick={() => navigate('/parent/attendance')}>
            <div className="mpd-action-icon"><GridIcons.Attendance /></div>
            <span>Attendance</span>
          </div>
          <div className="mpd-action-item" onClick={() => navigate('/parent/marks')}>
            <div className="mpd-action-icon"><GridIcons.Marks /></div>
            <span>Marks</span>
          </div>
          <div className="mpd-action-item" onClick={() => navigate('/parent/performance')}>
            <div className="mpd-action-icon"><GridIcons.Performance /></div>
            <span>Performance</span>
          </div>
          <div className="mpd-action-item" onClick={() => navigate('/parent/fees')}>
            <div className="mpd-action-icon"><GridIcons.Fees /></div>
            <span>Fees</span>
          </div>

          <div className="mpd-action-item" onClick={() => navigate('/parent/timetable')}>
            <div className="mpd-action-icon"><GridIcons.Timetable /></div>
            <span>Timetable</span>
          </div>
          <div className="mpd-action-item" onClick={() => navigate('/parent/assignments')}>
            <div className="mpd-action-icon"><GridIcons.Assignments /></div>
            <span>Assignments</span>
          </div>
          <div className="mpd-action-item" onClick={() => navigate('/parent/chat')}>
            <div className="mpd-action-icon"><GridIcons.Chat /></div>
            <span>Chat</span>
          </div>
          <div className="mpd-action-item" onClick={() => navigate('/parent/announcements')}>
            <div className="mpd-action-icon"><GridIcons.Announcements /></div>
            <span>Announcements</span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      {detailLoading ? (
         <div className="mpd-loading" style={{ height: '300px' }}><LoadingSpinner /></div>
      ) : activeTab === 'Overview' && (
        <div className="mpd-overview-content">
          {/* STATS GRID */}
          <div className="mpd-stats-grid">
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
          </div>

          {/* LIGHT ACCENT GRID */}
          <div className="mpd-accent-grid">
            <div className="mpd-accent-card">
              <div className="mpd-card-header">
                <h3>📊 Subject Performance</h3>
                <span className="mpd-link">View all</span>
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

            <div className="mpd-accent-card">
              <div className="mpd-card-header">
                <h3>Recent Announcements</h3>
                <span className="mpd-link">View all</span>
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
          </div>
        </div>
      )}
    </div>
  );
}
