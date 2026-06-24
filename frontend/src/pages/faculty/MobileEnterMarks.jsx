import React, { useState } from 'react';
import './MobileEnterMarks.css';

// Helpers
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

function MobileMarkRow({ student, exam, rowData, onChange, onSave }) {
    const [saving, setSaving] = useState(false);
    const marks = rowData.marks_obtained ?? '';
    const absent = rowData.is_absent || false;
    const isSaved = rowData.isSaved || false;
    const isEditing = rowData.isEditing || false;
    const locked = exam.marks_locked;

    // Live computed values
    const pct = marks !== '' && !absent ? ((parseFloat(marks) / parseFloat(exam.total_marks)) * 100).toFixed(1) : null;
    const passed = pct !== null ? parseFloat(marks) >= parseFloat(exam.passing_marks) : null;
    const grade = pct !== null ? getGrade(parseFloat(pct)) : null;

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
        <div className="mem-student-card">
            {/* Top: Avatar, Name, Roll, Present/Absent */}
            <div className="mem-sc-header">
                <div className="mem-avatar" style={{ backgroundColor: getColorForInitials(student.User?.name || student.name) }}>
                    {getInitials(student.User?.name || student.name)}
                </div>
                <div className="mem-student-details">
                    <span className="mem-student-name">{student.User?.name || student.name}</span>
                    <span className="mem-roll-no">{student.roll_number || student.User?.roll_number || '—'}</span>
                    <span className="mem-student-email" style={{fontSize: '10px', color: '#94a3b8'}}>{student.User?.email || ''}</span>
                </div>
                <div className="mem-sc-status-wrap">
                    <select
                        className={`mem-status-select ${absent ? 'absent' : 'present'}`}
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
                    >
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                    </select>
                </div>
            </div>

            {/* Bottom: Marks Input, Grade, Action Button */}
            <div className="mem-sc-body">
                <div className="mem-sc-marks">
                    <span className="mem-sc-label">Marks (/{exam.total_marks})</span>
                    {absent ? (
                        <span style={{ color: '#94a3b8', fontWeight: '600', padding: '8px 0', fontSize: '14px' }}>—</span>
                    ) : (
                        <input
                            type="number"
                            className="mem-mark-input"
                            min={0}
                            max={exam.total_marks}
                            step="0.5"
                            placeholder="0.0"
                            value={marks}
                            disabled={locked || (isSaved && !isEditing)}
                            onChange={e => onChange(student.id, { ...rowData, marks_obtained: e.target.value })}
                        />
                    )}
                </div>

                <div className="mem-sc-grade">
                    <span className="mem-sc-label">Grade</span>
                    {absent ? (
                        <span style={{ color: '#ea580c', fontWeight: '700', fontSize: '14px', padding: '8px 0' }}>Absent</span>
                    ) : grade ? (
                        <>
                            <span className="mem-sc-grade-val" style={{ color: getGradeColor(grade) }}>{grade}</span>
                            <span className="mem-sc-grade-status" style={{ background: passed ? '#dcfce7' : '#fee2e2', color: passed ? '#16a34a' : '#dc2626' }}>
                                {pct}%
                            </span>
                        </>
                    ) : (
                        <span style={{ color: '#94a3b8', fontSize: '14px', padding: '8px 0', fontWeight: '600' }}>—</span>
                    )}
                </div>

                <div className="mem-sc-action">
                    <span className="mem-sc-label">Action</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {locked ? (
                            <div style={{ color: '#f59e0b', padding: '8px' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            </div>
                        ) : (
                            <button
                                disabled={saving}
                                onClick={handleSave}
                                className={`mem-action-button ${isSaved && !isEditing ? 'saved' : 'save'}`}
                            >
                                {isSaved && !isEditing ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                                )}
                            </button>
                        )}
                        {isSaved && !locked && !isEditing && (
                            <button
                                onClick={() => onChange(student.id, { ...rowData, isEditing: true })}
                                className="mem-action-button edit"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const MobileEnterMarks = ({
    exams,
    selectedExam,
    setSelectedExam,
    students,
    marksData,
    loading,
    error,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    handleRowChange,
    handleSaveMark,
    markAllPresent,
    markAllAbsent,
    handleImportClick,
    handleLock,
    lockingExam,
    fileInputRef,
    handleFileChange,
    avg,
    handleRefresh
}) => {

    const [searchQuery, setSearchQuery] = useState("");

    const examObj = selectedExam ? exams.find(e => e.id === parseInt(selectedExam)) : null;
    
    // Filtering logic
    const filteredStudents = students.filter(student => {
        const query = searchQuery.toLowerCase();
        return (
            (student.name && student.name.toLowerCase().includes(query)) ||
            (student.User?.name && student.User.name.toLowerCase().includes(query)) ||
            (student.roll_number && String(student.roll_number).toLowerCase().includes(query)) ||
            (student.User?.roll_number && String(student.User.roll_number).toLowerCase().includes(query)) ||
            (student.email && student.email.toLowerCase().includes(query)) ||
            (student.User?.email && student.User.email.toLowerCase().includes(query))
        );
    });

    const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
    const currentStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="mem-container">
            {/* Hero Banner */}
            <div className="mem-hero-banner">
                <div className="mem-hero-left">
                    <div className="mem-hero-icon-wrapper">
                        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                    </div>
                    <div className="mem-hero-text">
                        <h2>Enter Marks</h2>
                        <p>Enter and manage exam results for your students.</p>
                    </div>
                </div>
                <div className="mem-hero-right">
                    <div className="mem-hero-graphic">
                        📝<span>💯</span>
                    </div>
                </div>
            </div>

            {error && (
                <div style={{ color: '#b91c1c', margin: '0 16px 16px 16px', padding: '12px', background: '#fef2f2', border: "1px solid #fecaca", borderRadius: '8px', fontSize: '13px' }}>
                    {error}
                </div>
            )}

            {/* Stats Row */}
            {examObj && (
                <div className="mem-stats-row">
                    <div className="mem-stat-card">
                        <div className="mem-stat-header">
                            <div className="mem-stat-icon purple">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            </div>
                            <div className="mem-stat-title">Total Marks</div>
                        </div>
                        <div className="mem-stat-value">{parseFloat(examObj.total_marks).toFixed(2)}</div>
                        <div className="mem-stat-subtitle">Max marks for exam</div>
                    </div>
                    
                    <div className="mem-stat-card">
                        <div className="mem-stat-header">
                            <div className="mem-stat-icon green">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>
                            </div>
                            <div className="mem-stat-title">Passing Marks</div>
                        </div>
                        <div className="mem-stat-value">{parseFloat(examObj.passing_marks).toFixed(2)}</div>
                        <div className="mem-stat-subtitle">Min marks to pass</div>
                    </div>

                    <div className="mem-stat-card">
                        <div className="mem-stat-header">
                            <div className="mem-stat-icon blue">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                            </div>
                            <div className="mem-stat-title">Class Average</div>
                        </div>
                        <div className="mem-stat-value">{avg}</div>
                        <div className="mem-stat-subtitle">Average marks scored</div>
                    </div>

                    <div className="mem-stat-card">
                        <div className="mem-stat-header">
                            <div className="mem-stat-icon orange">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            </div>
                            <div className="mem-stat-title">Students</div>
                        </div>
                        <div className="mem-stat-value">{students.length}</div>
                        <div className="mem-stat-subtitle">Total in class</div>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            {examObj && (
                <div className="mem-actions-row">
                    <div className="mem-action-btn refresh" onClick={() => {
                        if (handleRefresh) {
                            handleRefresh();
                        } else {
                            window.location.reload();
                        }
                    }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                        Refresh
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="mem-filters-card">
                <div className="mem-filters-grid">
                    <div className="mem-filter-group" style={{ gridColumn: '1 / -1' }}>
                        <label>Select Exam <span>*</span></label>
                        <div className="mem-select-wrapper">
                            <select
                                className="mem-input"
                                value={selectedExam}
                                onChange={e => setSelectedExam(e.target.value)}
                            >
                                <option value="">Choose an exam to grade</option>
                                {exams.map(ex => (
                                    <option key={ex.id} value={ex.id}>
                                        {ex.name} {ex.Subject?.name ? `— ${ex.Subject.name}` : ''} ({new Date(ex.exam_date).toLocaleDateString('en-IN')}) {ex.marks_locked ? ' 🔒' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="mem-filter-group">
                        <label>Select Class <span>*</span></label>
                        <input className="mem-input" disabled value={examObj?.Class ? `${examObj.Class.name} ${examObj.Class.section ? `- ${examObj.Class.section}` : ''}` : '---'} />
                    </div>

                    <div className="mem-filter-group">
                        <label>Select Subject <span>*</span></label>
                        <input className="mem-input" disabled value={examObj?.Subject?.name || '---'} />
                    </div>

                    <div className="mem-filter-group" style={{ gridColumn: '1 / -1' }}>
                        <label>Exam Date <span>*</span></label>
                        <input className="mem-input" disabled value={examObj ? new Date(examObj.exam_date).toLocaleDateString('en-IN') : '---'} />
                    </div>
                </div>
            </div>

            {/* Student List */}
            {selectedExam && (
                <div className="mem-list-card">
                    <div className="mem-list-header">
                        <h3 className="mem-list-title">Student List ({filteredStudents.length} Students)</h3>
                        <div className="mem-list-actions">
                            <button onClick={markAllPresent} className="mem-btn-sm present" disabled={examObj?.marks_locked}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                Mark All Present
                            </button>
                            <button onClick={markAllAbsent} className="mem-btn-sm absent" disabled={examObj?.marks_locked}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                Mark All Absent
                            </button>
                            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} accept=".csv, .xlsx, .xls" />
                            <button onClick={handleImportClick} className="mem-btn-sm import" disabled={examObj?.marks_locked}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                Import Marks
                            </button>
                        </div>
                    </div>

                    <div className="mem-search-row">
                        <div className="mem-search-box">
                            <svg className="mem-search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            <input
                                type="text"
                                placeholder="Search by name, email, or roll num..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                            Loading students...
                        </div>
                    ) : (
                        <div className="mem-students-list">
                            {students.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                                    No students found in this class.
                                </div>
                            ) : filteredStudents.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "40px 20px", background: "white", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                                    <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🔍</div>
                                    <h4 style={{ color: "#475569", fontSize: "1.1rem", margin: "0 0 8px 0" }}>No matching students found</h4>
                                    <p style={{ color: "#94a3b8", fontSize: "0.9rem", margin: 0 }}>Try adjusting your search query.</p>
                                </div>
                            ) : (
                                currentStudents.map(student => (
                                    <MobileMarkRow
                                        key={student.id}
                                        student={student}
                                        exam={examObj}
                                        rowData={marksData[student.id] || {}}
                                        onChange={handleRowChange}
                                        onSave={handleSaveMark}
                                    />
                                ))
                            )}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && !loading && (
                        <div className="mem-pagination">
                            <div className="mem-pagination-text">
                                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredStudents.length)} of {filteredStudents.length} students
                            </div>
                            <div className="mem-pagination-controls">
                                <button
                                    className="mem-page-btn"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    &lt; Prev
                                </button>
                                
                                {Array.from({ length: totalPages }).map((_, i) => {
                                    // simple pagination (hide some if too many)
                                    if (totalPages > 5 && i !== 0 && i !== totalPages - 1 && Math.abs(currentPage - 1 - i) > 1) {
                                        if (i === 1 && currentPage > 3) return <span key={i} style={{ color: '#94a3b8', margin: '0 4px' }}>...</span>;
                                        if (i === totalPages - 2 && currentPage < totalPages - 2) return <span key={i} style={{ color: '#94a3b8', margin: '0 4px' }}>...</span>;
                                        return null;
                                    }
                                    return (
                                        <button
                                            key={i}
                                            className={`mem-page-btn ${currentPage === i + 1 ? 'active' : ''}`}
                                            onClick={() => setCurrentPage(i + 1)}
                                        >
                                            {i + 1}
                                        </button>
                                    );
                                })}

                                <button
                                    className="mem-page-btn"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    Next &gt;
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {examObj && examObj.marks_locked && (
                <div className="mem-locked-banner">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    Marks are locked. Students and parents can now view the results.
                </div>
            )}
            
            {examObj && !examObj.marks_locked && Object.values(marksData).filter(m => !m.isSaved).length > 0 && (
                <div className="mem-locked-banner" style={{ background: '#eff6ff', color: '#1e40af', borderColor: '#bfdbfe' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    You have {Object.values(marksData).filter(m => !m.isSaved && !m.isEditing).length} unsaved changes.
                </div>
            )}
        </div>
    );
};

export default MobileEnterMarks;
