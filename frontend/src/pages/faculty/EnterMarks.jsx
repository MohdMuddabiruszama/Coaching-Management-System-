import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import examService from '../../services/exam.service';
import markService from '../../services/mark.service';
import '../admin/Dashboard.css';

function getGrade(pct) {
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    if (pct >= 40) return 'D';
    return 'F';
}

function getGradeColor(grade) {
    if (grade.startsWith('A')) return '#16a34a';
    if (grade.startsWith('B')) return '#10b981';
    if (grade.startsWith('C')) return '#f59e0b';
    if (grade.startsWith('D')) return '#d97706';
    return '#dc2626';
}

const getInitials = (name) => {
    if (!name) return "";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
};

const getColorForInitials = (name) => {
    const colors = ["#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#14b8a6", "#f43f5e"];
    if (!name) return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

function MarkRow({ student, exam, rowData, onChange, onSave }) {
    const [saving, setSaving] = useState(false);
    const marks  = rowData.marks_obtained ?? '';
    const absent = rowData.is_absent || false;
    const isSaved   = rowData.isSaved || false;
    const isEditing = rowData.isEditing || false;
    const locked = exam.marks_locked;

    // Live computed values
    const pct    = marks !== '' && !absent ? ((parseFloat(marks) / parseFloat(exam.total_marks)) * 100).toFixed(1) : null;
    const passed = pct !== null ? parseFloat(marks) >= parseFloat(exam.passing_marks) : null;
    const grade  = pct !== null ? getGrade(parseFloat(pct)) : null;

    const handleSave = async () => {
        if (!absent && (marks === '' || marks === undefined || marks === null)) {
            alert('Please enter valid marks or mark as absent.');
            return;
        }
        setSaving(true);
        try {
            await onSave(student.id, absent ? null : parseFloat(marks), absent);
        } finally {
            setSaving(false);
        }
    };

    return (
        <tr style={{ background: "white", boxShadow: "0 1px 2px rgba(0,0,0,0.02)", borderRadius: "8px", border: "1px solid #f3f4f6" }}>
            <td style={{ padding: "16px", borderBottom: "1px solid #f3f4f6", borderTopLeftRadius: "8px", borderBottomLeftRadius: "8px", color: "#4b5563", fontWeight: "600", fontSize: "0.9rem", verticalAlign: "middle" }}>
                {student.roll_number || student.User?.roll_number || '—'}
            </td>
            <td style={{ padding: "16px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: getColorForInitials(student.User?.name || student.name), color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "600", fontSize: "0.9rem", flexShrink: 0 }}>
                        {getInitials(student.User?.name || student.name)}
                    </div>
                    <div>
                        <div style={{ fontWeight: "600", color: "#111827", fontSize: "0.95rem" }}>{student.User?.name || student.name}</div>
                        <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>{student.User?.email || ''}</div>
                    </div>
                </div>
            </td>
            <td style={{ padding: "16px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle" }}>
                <select 
                    className="form-select" 
                    disabled={locked || (isSaved && !isEditing)}
                    value={absent ? "Absent" : "Present"}
                    onChange={(e) => {
                        const isAbs = e.target.value === "Absent";
                        onChange(student.id, {
                            ...rowData,
                            is_absent: isAbs,
                            marks_obtained: isAbs ? '' : rowData.marks_obtained,
                        });
                    }}
                    style={{ 
                        padding: "0.5rem 1rem", 
                        borderRadius: "8px", 
                        border: "1px solid #e5e7eb",
                        color: absent ? "#ef4444" : "#10b981",
                        fontWeight: "600",
                        width: "120px",
                        outline: "none"
                    }}
                >
                    <option value="Present" style={{color: "#10b981"}}>Present</option>
                    <option value="Absent" style={{color: "#ef4444"}}>Absent</option>
                </select>
            </td>
            <td style={{ padding: "16px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle", textAlign: "center" }}>
                {absent ? (
                    <span style={{ color: '#d1d5db', fontWeight: "600" }}>—</span>
                ) : (
                    <input
                        type="number"
                        min={0}
                        max={exam.total_marks}
                        step="0.5"
                        value={marks}
                        disabled={locked || (isSaved && !isEditing)}
                        onChange={e => onChange(student.id, { ...rowData, marks_obtained: e.target.value })}
                        style={{ 
                            border: "1px solid #e5e7eb", 
                            borderRadius: "8px", 
                            padding: "8px 12px", 
                            width: "80px", 
                            textAlign: "center",
                            fontSize: "0.95rem", 
                            fontWeight: "600",
                            outline: "none",
                            background: (locked || (isSaved && !isEditing)) ? "#f9fafb" : "white",
                            color: "#111827"
                        }}
                    />
                )}
            </td>
            <td style={{ padding: "16px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle", textAlign: "center" }}>
                {absent ? (
                    <span style={{ color: '#d1d5db', fontWeight: "600" }}>—</span>
                ) : grade ? (
                    <span style={{ color: getGradeColor(grade), fontWeight: "700", fontSize: "1rem" }}>{grade}</span>
                ) : (
                    <span style={{ color: '#d1d5db' }}>—</span>
                )}
            </td>
            <td style={{ padding: "16px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle", textAlign: "center" }}>
                {absent ? (
                    <span style={{ color: '#f59e0b', fontWeight: "600", fontSize: "0.85rem" }}>Absent</span>
                ) : pct !== null ? (
                    <span style={{ color: passed ? '#16a34a' : '#dc2626', fontWeight: "600", fontSize: "0.85rem" }}>
                        {pct}% · {passed ? 'Pass' : 'Fail'}
                    </span>
                ) : (
                    <span style={{ color: '#d1d5db' }}>—</span>
                )}
            </td>
            <td style={{ padding: "16px", borderBottom: "1px solid #f3f4f6", borderTopRightRadius: "8px", borderBottomRightRadius: "8px", verticalAlign: "middle", textAlign: "center" }}>
                <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                    {locked ? (
                        <div style={{ color: "#f59e0b" }} title="Locked">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        </div>
                    ) : (
                        <button
                            disabled={saving}
                            onClick={handleSave}
                            title="Save marks"
                            style={{ background: "transparent", border: "none", cursor: saving ? "wait" : "pointer", color: isSaved ? "#10b981" : "#6366f1", padding: "4px" }}
                        >
                            {isSaved && !isEditing ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                            )}
                        </button>
                    )}
                    {isSaved && !locked && (
                         <button
                            onClick={() => onChange(student.id, { ...rowData, isEditing: true })}
                            title="Edit marks"
                            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#8b5cf6", padding: "4px" }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
}

function EnterMarks() {
    const [exams, setExams] = useState([]);
    const [selectedExam, setSelectedExam] = useState('');
    const [students, setStudents] = useState([]);
    const [marksData, setMarksData] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [lockingExam, setLockingExam] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    useEffect(() => { fetchExams(); }, []);

    useEffect(() => {
        if (selectedExam) {
            const examObj = exams.find(e => e.id === parseInt(selectedExam));
            if (examObj) fetchStudentsAndMarks(examObj);
        } else {
            setStudents([]);
            setMarksData({});
        }
        setCurrentPage(1);
    }, [selectedExam]);

    const fetchExams = async () => {
        try {
            const res = await api.get('/exams');
            setExams(res.data.data.exams || []);
        } catch (err) {
            setError('Failed to load exams.');
        }
    };

    const fetchStudentsAndMarks = async (examObj) => {
        setLoading(true);
        setError('');
        try {
            const [studRes, marksRes] = await Promise.all([
                api.get(`/students?class_id=${examObj.class_id}&limit=10000`),
                api.get(`/exams/${examObj.id}/marks`).catch(() => ({ data: { data: [] } })),
            ]);

            const fetchedStudents = studRes.data.data || [];
            const existingMarks = marksRes.data.data || [];

            const initialData = {};
            fetchedStudents.forEach(st => {
                const em = existingMarks.find(m => m.student_id === st.id);
                let mo = em ? em.marks_obtained : '';
                
                // Sanitize in case previous invalid imports saved 'NaN' or other text
                if (mo !== '' && mo !== null && isNaN(parseFloat(mo))) {
                    mo = '';
                }

                initialData[st.id] = {
                    marks_obtained: mo,
                    is_absent: em ? em.is_absent : false,
                    isSaved: !!em,
                    isEditing: false,
                };
            });

            setStudents(fetchedStudents);
            setMarksData(initialData);
        } catch (err) {
            setError('Failed to load students for this class.');
        } finally {
            setLoading(false);
        }
    };

    const handleRowChange = (studentId, newData) => {
        setMarksData(prev => ({ ...prev, [studentId]: newData }));
    };

    const handleSaveMark = async (studentId, marksValue, isAbsent) => {
        const examObj = exams.find(e => e.id === parseInt(selectedExam));
        try {
            await markService.save({
                exam_id: parseInt(selectedExam),
                student_id: studentId,
                marks_obtained: marksValue,
                is_absent: isAbsent,
            });
            setMarksData(prev => ({
                ...prev,
                [studentId]: { ...prev[studentId], marks_obtained: marksValue, is_absent: isAbsent, isSaved: true, isEditing: false },
            }));
        } catch (err) {
            alert(err.response?.data?.message || 'Error saving marks.');
        }
    };

    const handleLock = async () => {
        if (!window.confirm('Lock and publish results? Students and parents will see their marks. This cannot be undone.')) return;
        setLockingExam(true);
        try {
            await examService.lockMarks(parseInt(selectedExam));
            alert('✅ Results locked and published!');
            fetchExams();
            const examObj = exams.find(e => e.id === parseInt(selectedExam));
            if (examObj) fetchStudentsAndMarks({ ...examObj, marks_locked: true });
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to lock exam');
        } finally {
            setLockingExam(false);
        }
    };

    const markAllPresent = () => {
        const examObj = exams.find(e => e.id === parseInt(selectedExam));
        if(!examObj || examObj.marks_locked) return;
        const newData = { ...marksData };
        students.forEach(st => {
            if (!newData[st.id]?.isSaved || newData[st.id]?.isEditing) {
                newData[st.id] = { ...newData[st.id], is_absent: false };
            }
        });
        setMarksData(newData);
    };

    const markAllAbsent = () => {
        const examObj = exams.find(e => e.id === parseInt(selectedExam));
        if(!examObj || examObj.marks_locked) return;
        const newData = { ...marksData };
        students.forEach(st => {
            if (!newData[st.id]?.isSaved || newData[st.id]?.isEditing) {
                newData[st.id] = { ...newData[st.id], is_absent: true, marks_obtained: '' };
            }
        });
        setMarksData(newData);
    };

    const handleImportClick = () => {
        if (!selectedExam) {
            alert('Please select an exam first to import marks.');
            return;
        }
        if (examObj?.marks_locked) {
            alert('Marks are locked for this exam. You cannot import new marks.');
            return;
        }
        setShowImportModal(true);
    };

    const downloadTemplate = () => {
        const examObj = exams.find(e => e.id === parseInt(selectedExam));
        if (!examObj || students.length === 0) return;
        
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Student ID,Roll No,Student Name,Marks,Absent (Y/N)\n";
        
        students.forEach(st => {
            const rollNo = st.roll_number || st.User?.roll_number || '';
            const name = st.User?.name || st.name || '';
            csvContent += `${st.id},"${rollNo}","${name}","","N"\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Marks_Template_${examObj.name.replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        try {
            const text = await file.text();
            const lines = text.split('\n');
            const dataToImport = [];

            // Skip header (i=0)
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                // Splitting CSV intelligently (handles simple quotes if present)
                const columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/^"|"$/g, '').trim());
                
                // Assuming format: Student ID, Roll No, Student Name, Marks, Absent (Y/N)
                const studentId = parseInt(columns[0]);
                if (isNaN(studentId)) continue;
                
                const marksStr = columns[3];
                const absentStr = columns[4] ? columns[4].toUpperCase() : 'N';
                const isAbsent = absentStr === 'Y' || absentStr === 'YES';

                let parsedMarks = null;
                if (!isAbsent) {
                    if (marksStr === undefined || marksStr.trim() === '') {
                        continue; // Skip rows where marks are completely empty and not absent
                    }
                    parsedMarks = parseFloat(marksStr);
                    if (isNaN(parsedMarks)) {
                        throw new Error(`Invalid marks '${marksStr}' for Student ID ${studentId}. Marks must be a valid number.`);
                    }
                }

                dataToImport.push({
                    student_id: studentId,
                    marks_obtained: isAbsent ? null : parsedMarks,
                    is_absent: isAbsent,
                    remarks: isAbsent ? 'Absent' : null,
                });
            }

            if (dataToImport.length > 0) {
                await markService.bulkSave({
                    exam_id: parseInt(selectedExam),
                    marksData: dataToImport
                });
                alert('✅ Marks imported successfully!');
                const examObj = exams.find(ex => ex.id === parseInt(selectedExam));
                if (examObj) fetchStudentsAndMarks(examObj);
            } else {
                alert('⚠️ No valid data found in the file.');
            }
        } catch (error) {
            console.error(error);
            alert(error.message ? `❌ ${error.message}` : '❌ Failed to parse or import the file.');
        } finally {
            e.target.value = ''; // Reset input
            setLoading(false);
        }
    };

    const handleViewReport = () => {
        if (!selectedExam) {
            alert('Please select an exam to view its report.');
            return;
        }
        navigate('/faculty/performance');
    };

    const examObj = selectedExam ? exams.find(e => e.id === parseInt(selectedExam)) : null;

    const allMarksEntered = students.length > 0 &&
        students.every(st => marksData[st.id]?.isSaved);

    let avg = "0.00";
    if (examObj) {
        const appeared = students.filter(st => {
            const rd = marksData[st.id] || {};
            return rd.marks_obtained !== '' && rd.marks_obtained != null && rd.marks_obtained !== undefined && !rd.is_absent && !isNaN(parseFloat(rd.marks_obtained));
        });
        if (appeared.length) {
            const marks = appeared.map(st => parseFloat(marksData[st.id].marks_obtained));
            avg = (marks.reduce((a, b) => a + b, 0) / marks.length).toFixed(2);
        }
    }

    const totalPages = Math.ceil(students.length / itemsPerPage);
    const currentStudents = students.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="dashboard-container">
            {/* HEADER */}
            <div className="dashboard-header" style={{ marginBottom: "2rem", borderBottom: "none", paddingBottom: "0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "white", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", color: "#6366f1", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", flexShrink: 0 }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "700", color: "#111827" }}>Enter Marks</h1>
                        <p style={{ margin: 0, color: "#6b7280", fontSize: "0.95rem" }}>Enter and manage exam results for your students.</p>
                    </div>
                </div>
            </div>

            {error && (
                <div style={{ color: '#b91c1c', padding: '1rem', marginBottom: '1rem', background: '#fef2f2', border: "1px solid #fecaca", borderRadius: '8px' }}>
                    {error}
                </div>
            )}

            {/* STATS CARDS */}
            {examObj && (
                <div className="advanced-stats-grid" style={{ marginBottom: "2rem" }}>
                    <div className="advanced-stat-card asc-purple">
                        <div className="asc-top">
                            <div className="asc-icon-wrapper" style={{ background: "#f3e8ff", color: "#7e22ce" }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            </div>
                            <div className="asc-info" style={{ textAlign: "left", flex: 1, marginLeft: "15px" }}>
                                <p className="asc-label" style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "4px", margin: 0 }}>Total Marks</p>
                                <h3 className="asc-value" style={{ fontSize: "1.5rem", color: "#111827", margin: 0 }}>{parseFloat(examObj.total_marks).toFixed(2)}</h3>
                            </div>
                        </div>
                        <div className="asc-bottom" style={{ marginTop: "12px" }}>
                            <span className="asc-sublabel" style={{ fontSize: "0.8rem", color: "#6b7280" }}>Maximum marks for exam</span>
                        </div>
                    </div>
                    
                    <div className="advanced-stat-card asc-green">
                        <div className="asc-top">
                            <div className="asc-icon-wrapper" style={{ background: "#dcfce7", color: "#15803d" }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>
                            </div>
                            <div className="asc-info" style={{ textAlign: "left", flex: 1, marginLeft: "15px" }}>
                                <p className="asc-label" style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "4px", margin: 0 }}>Passing Marks</p>
                                <h3 className="asc-value" style={{ fontSize: "1.5rem", color: "#111827", margin: 0 }}>{parseFloat(examObj.passing_marks).toFixed(2)}</h3>
                            </div>
                        </div>
                        <div className="asc-bottom" style={{ marginTop: "12px" }}>
                            <span className="asc-sublabel" style={{ fontSize: "0.8rem", color: "#6b7280" }}>Minimum marks to pass</span>
                        </div>
                    </div>

                    <div className="advanced-stat-card asc-blue">
                        <div className="asc-top">
                            <div className="asc-icon-wrapper" style={{ background: "#e0f2fe", color: "#0369a1" }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                            </div>
                            <div className="asc-info" style={{ textAlign: "left", flex: 1, marginLeft: "15px" }}>
                                <p className="asc-label" style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "4px", margin: 0 }}>Class Average</p>
                                <h3 className="asc-value" style={{ fontSize: "1.5rem", color: "#111827", margin: 0 }}>{avg}</h3>
                            </div>
                        </div>
                        <div className="asc-bottom" style={{ marginTop: "12px" }}>
                            <span className="asc-sublabel" style={{ fontSize: "0.8rem", color: "#6b7280" }}>Average marks scored</span>
                        </div>
                    </div>

                    <div className="advanced-stat-card asc-orange">
                        <div className="asc-top">
                            <div className="asc-icon-wrapper" style={{ background: "#fef3c7", color: "#d97706" }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            </div>
                            <div className="asc-info" style={{ textAlign: "left", flex: 1, marginLeft: "15px" }}>
                                <p className="asc-label" style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "4px", margin: 0 }}>Students</p>
                                <h3 className="asc-value" style={{ fontSize: "1.5rem", color: "#111827", margin: 0 }}>{students.length}</h3>
                            </div>
                        </div>
                        <div className="asc-bottom" style={{ marginTop: "12px" }}>
                            <span className="asc-sublabel" style={{ fontSize: "0.8rem", color: "#6b7280" }}>Total students in class</span>
                        </div>
                    </div>
                </div>
            )}

            {/* FILTERS */}
            <div style={{ marginBottom: "2rem", background: "white", padding: "1.5rem", borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem" }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: "600", color: "#374151", fontSize: "0.9rem", marginBottom: "8px", display: "block" }}>Select Exam <span style={{color: "#ef4444"}}>*</span></label>
                        <select
                            className="form-select"
                            value={selectedExam}
                            onChange={e => setSelectedExam(e.target.value)}
                            style={{ padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #d1d5db", width: "100%", outline: "none", transition: "border-color 0.2s" }}
                        >
                            <option value="">Choose an exam to grade</option>
                            {exams.map(ex => (
                                <option key={ex.id} value={ex.id}>
                                    {ex.name}
                                    {ex.Subject?.name ? ` — ${ex.Subject.name}` : ''}
                                    {' '}({new Date(ex.exam_date).toLocaleDateString('en-IN')})
                                    {ex.marks_locked ? ' 🔒' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: "600", color: "#374151", fontSize: "0.9rem", marginBottom: "8px", display: "block" }}>Select Class <span style={{color: "#ef4444"}}>*</span></label>
                        <select disabled className="form-select" style={{ padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #e5e7eb", width: "100%", background: "#f9fafb", color: "#6b7280", appearance: "none" }}>
                            <option>{examObj?.Class ? `${examObj.Class.name} ${examObj.Class.section ? `- ${examObj.Class.section}` : ''}` : '---'}</option>
                        </select>
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: "600", color: "#374151", fontSize: "0.9rem", marginBottom: "8px", display: "block" }}>Select Subject <span style={{color: "#ef4444"}}>*</span></label>
                        <select disabled className="form-select" style={{ padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #e5e7eb", width: "100%", background: "#f9fafb", color: "#6b7280", appearance: "none" }}>
                            <option>{examObj?.Subject?.name || '---'}</option>
                        </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontWeight: "600", color: "#374151", fontSize: "0.9rem", marginBottom: "8px", display: "block" }}>Exam Date <span style={{color: "#ef4444"}}>*</span></label>
                        <input type="text" disabled value={examObj ? new Date(examObj.exam_date).toLocaleDateString('en-IN') : '---'} className="form-input" style={{ padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #e5e7eb", width: "100%", background: "#f9fafb", color: "#6b7280", boxSizing: "border-box" }} />
                    </div>
                </div>
            </div>

            {/* TABLE SECTION */}
            {selectedExam && (
                <div className="card" style={{ marginBottom: "2rem", borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", background: "white" }}>
                    <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", borderBottom: "1px solid #f3f4f6", background: "white", borderRadius: "12px 12px 0 0" }}>
                        <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: "10px", margin: 0, fontSize: "1.1rem", color: "#111827" }}>
                            Student List ({students.length} Students)
                        </h3>
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                            <button onClick={markAllPresent} className="btn btn-sm" type="button" disabled={examObj.marks_locked} style={{ background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px", padding: "0.5rem 1rem", borderRadius: "6px", cursor: examObj.marks_locked ? "not-allowed" : "pointer", opacity: examObj.marks_locked ? 0.6 : 1 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                Mark All Present
                            </button>
                            <button onClick={markAllAbsent} className="btn btn-sm" type="button" disabled={examObj.marks_locked} style={{ background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px", padding: "0.5rem 1rem", borderRadius: "6px", cursor: examObj.marks_locked ? "not-allowed" : "pointer", opacity: examObj.marks_locked ? 0.6 : 1 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                Mark All Absent
                            </button>
                            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} accept=".csv, .xlsx, .xls" />
                            <button onClick={handleImportClick} className="btn btn-sm" type="button" disabled={examObj.marks_locked} style={{ background: "#f3e8ff", color: "#7e22ce", border: "1px solid #e9d5ff", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px", padding: "0.5rem 1rem", borderRadius: "6px", cursor: examObj.marks_locked ? "not-allowed" : "pointer", opacity: examObj.marks_locked ? 0.6 : 1 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                Import Marks
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                            <div className="loading-spinner"></div>
                            <p style={{marginTop: "1rem"}}>Loading students...</p>
                        </div>
                    ) : (
                        <div style={{ padding: '1rem 1.5rem' }}>
                            <div className="table-container">
                                <table className="table mobile-keep" style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px", background: "white" }}>
                                    <thead>
                                        <tr style={{ color: "#6b7280", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", background: "transparent" }}>
                                            <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: "600", textAlign: "left" }}>Roll No. <span style={{display: "inline-block", marginLeft:"4px", fontSize: "0.8rem", color: "#9ca3af"}}>↕</span></th>
                                            <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: "600", textAlign: "left" }}>Student Name <span style={{display: "inline-block", marginLeft:"4px", fontSize: "0.8rem", color: "#9ca3af"}}>↕</span></th>
                                            <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: "600", textAlign: "left" }}>Status <span style={{display: "inline-block", marginLeft:"4px", fontSize: "0.8rem", color: "#9ca3af"}}>↕</span></th>
                                            <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: "600", textAlign: "center" }}>Marks (Out of {examObj?.total_marks}) <span style={{display: "inline-block", marginLeft:"4px", fontSize: "0.8rem", color: "#9ca3af"}}>↕</span></th>
                                            <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: "600", textAlign: "center" }}>Grade <span style={{display: "inline-block", marginLeft:"4px", fontSize: "0.8rem", color: "#9ca3af"}}>↕</span></th>
                                            <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: "600", textAlign: "center" }}>Remarks <span style={{display: "inline-block", marginLeft:"4px", fontSize: "0.8rem", color: "#9ca3af"}}>↕</span></th>
                                            <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: "600", textAlign: "center" }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#888', background: "white", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                                                    No students found in this class.
                                                </td>
                                            </tr>
                                        ) : (
                                            currentStudents.map(student => (
                                                <MarkRow
                                                    key={student.id}
                                                    student={student}
                                                    exam={examObj}
                                                    rowData={marksData[student.id] || {}}
                                                    onChange={handleRowChange}
                                                    onSave={handleSaveMark}
                                                />
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* PAGINATION */}
                            {totalPages > 1 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                                    <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                                        Showing <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> to <strong>{Math.min(currentPage * itemsPerPage, students.length)}</strong> of <strong>{students.length}</strong> students
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                border: '1px solid #d1d5db',
                                                background: currentPage === 1 ? '#f3f4f6' : 'white',
                                                color: currentPage === 1 ? '#9ca3af' : '#374151',
                                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                                fontWeight: '500',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                            Previous
                                        </button>
                                        
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            {[...Array(totalPages)].map((_, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setCurrentPage(i + 1)}
                                                    style={{
                                                        width: '36px',
                                                        height: '36px',
                                                        borderRadius: '6px',
                                                        border: currentPage === i + 1 ? '1px solid #8b5cf6' : '1px solid #d1d5db',
                                                        background: currentPage === i + 1 ? '#f3e8ff' : 'white',
                                                        color: currentPage === i + 1 ? '#7e22ce' : '#374151',
                                                        cursor: 'pointer',
                                                        fontWeight: currentPage === i + 1 ? '600' : '500',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    {i + 1}
                                                </button>
                                            ))}
                                        </div>

                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                border: '1px solid #d1d5db',
                                                background: currentPage === totalPages ? '#f3f4f6' : 'white',
                                                color: currentPage === totalPages ? '#9ca3af' : '#374151',
                                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                                fontWeight: '500',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            Next
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Lock Banner / Button */}
                            {examObj && !examObj.marks_locked ? (
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f9fafb", padding: "1rem 1.5rem", borderRadius: "8px", border: "1px solid #e5e7eb", marginTop: "1.5rem" }}>
                                    <div style={{ color: "#4b5563", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px" }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                        Marks are open. Ensure all marks are saved before locking.
                                    </div>
                                    <button
                                        onClick={handleLock}
                                        disabled={lockingExam || !allMarksEntered}
                                        style={{
                                            padding: '10px 20px',
                                            background: (!allMarksEntered) ? '#e5e7eb' : 'linear-gradient(135deg, #10b981, #059669)',
                                            color: (!allMarksEntered) ? '#9ca3af' : '#fff',
                                            fontWeight: '600',
                                            fontSize: '0.95rem',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: (!allMarksEntered || lockingExam) ? 'not-allowed' : 'pointer',
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            boxShadow: allMarksEntered ? "0 2px 4px rgba(16, 185, 129, 0.2)" : "none"
                                        }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                        {lockingExam ? 'Locking...' : 'Lock Marks'}
                                    </button>
                                </div>
                            ) : examObj?.marks_locked ? (
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ecfdf5", padding: "1rem 1.5rem", borderRadius: "8px", border: "1px solid #a7f3d0", marginTop: "1.5rem", flexWrap: "wrap", gap: "10px" }}>
                                    <div style={{ color: "#065f46", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px", fontWeight: "500" }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "#10b981"}}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                        Marks are locked. Students and parents can now view the results.
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>
            )}

            {/* IMPORT MARKS MODAL */}
            {showImportModal && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
                    <div style={{ background: "white", padding: "2rem", borderRadius: "16px", width: "100%", maxWidth: "450px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                            <h3 style={{ margin: 0, fontSize: "1.25rem", color: "#111827", display: "flex", alignItems: "center", gap: "10px" }}>
                                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#f3e8ff", color: "#7e22ce", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                </div>
                                Import Marks
                            </h3>
                            <button onClick={() => setShowImportModal(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#6b7280", padding: "4px" }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        
                        <p style={{ color: "#4b5563", fontSize: "0.95rem", marginBottom: "2rem", lineHeight: "1.5" }}>
                            Import marks easily by downloading the template, filling in the scores, and uploading the completed file.
                        </p>

                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <button onClick={downloadTemplate} style={{ padding: "12px 16px", background: "white", border: "2px solid #e5e7eb", borderRadius: "10px", color: "#374151", fontWeight: "600", fontSize: "1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", transition: "all 0.2s" }} onMouseOver={e => {e.currentTarget.style.borderColor = "#c084fc"; e.currentTarget.style.color = "#7e22ce"}} onMouseOut={e => {e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.color = "#374151"}}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Download Template
                            </button>

                            <button onClick={() => { setShowImportModal(false); fileInputRef.current?.click(); }} style={{ padding: "12px 16px", background: "linear-gradient(135deg, #8b5cf6, #7e22ce)", border: "none", borderRadius: "10px", color: "white", fontWeight: "600", fontSize: "1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", boxShadow: "0 4px 6px -1px rgba(126, 34, 206, 0.3)" }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                Upload Complete File
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default EnterMarks;
