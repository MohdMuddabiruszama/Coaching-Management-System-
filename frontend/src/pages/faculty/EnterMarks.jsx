/**
 * EnterMarks — Faculty Page — Phase 5 (Approach B)
 * Features:
 *   ✅ Exam lock status — editing disabled when locked
 *   ✅ is_absent toggle per student row
 *   ✅ Live pass/fail preview while typing (pure JS — zero API calls)
 *   ✅ Class stats bar (Average, Highest, Lowest, Pass Rate) — computed client-side
 *   ✅ Lock & Publish button when all marks are entered
 *   ✅ Locked confirmation banner
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import examService from '../../services/exam.service';
import markService from '../../services/mark.service';
import '../admin/Dashboard.css';

// ─── Grade calculator ─────────────────────────────────────────
function getGrade(pct) {
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    if (pct >= 40) return 'D';
    return 'F';
}

// ─── Class Stats Bar (computed client-side — zero API) ────────
function ClassStatsBar({ rows, passingMarks }) {
    const appeared = rows.filter(r => r.marks_obtained !== '' && r.marks_obtained !== null && !r.is_absent);
    if (!appeared.length) return null;

    const marks  = appeared.map(r => parseFloat(r.marks_obtained));
    const passed = marks.filter(m => m >= parseFloat(passingMarks)).length;
    const avg    = (marks.reduce((a, b) => a + b, 0) / marks.length).toFixed(1);
    const pct    = ((passed / appeared.length) * 100).toFixed(0);

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: '8px',
            marginBottom: '1rem',
            padding: '1rem',
            background: 'linear-gradient(135deg, #E3F2FD, #EDE7F6)',
            borderRadius: '10px',
            border: '1px solid #90CAF9',
        }}>
            {[
                { label: 'Average',   value: avg,                           color: '#1565C0' },
                { label: 'Highest',   value: Math.max(...marks),            color: '#2E7D32' },
                { label: 'Lowest',    value: Math.min(...marks),            color: '#C62828' },
                { label: 'Pass Rate', value: pct + '%', color: parseFloat(pct) >= 50 ? '#2E7D32' : '#C62828' },
            ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '11px', color: '#666', fontWeight: 600 }}>{s.label}</div>
                </div>
            ))}
        </div>
    );
}

// ─── Mark Row (live preview + absent toggle) ──────────────────
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

    const rowBg = absent ? '#FFF8E1' : 'inherit';

    return (
        <tr style={{ background: rowBg }}>
            <td>
                <span className="badge badge-secondary">{student.roll_number || student.User?.roll_number || '—'}</span>
            </td>
            <td>
                <strong>{student.User?.name || student.name}</strong>
                <br />
                <small style={{ color: '#6b7280' }}>{student.User?.email || ''}</small>
            </td>
            <td>
                {/* Absent Toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: locked ? 'not-allowed' : 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={absent}
                        disabled={locked || (isSaved && !isEditing)}
                        onChange={e => {
                            onChange(student.id, {
                                ...rowData,
                                is_absent: e.target.checked,
                                marks_obtained: e.target.checked ? '' : rowData.marks_obtained,
                            });
                        }}
                    />
                    <span style={{ fontSize: '13px', color: absent ? '#E65100' : '#666' }}>
                        {absent ? '🚫 Absent' : 'Absent'}
                    </span>
                </label>
            </td>
            <td>
                {absent ? (
                    <span style={{ color: '#9E9E9E', fontStyle: 'italic' }}>—</span>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <input
                            type="number"
                            className="form-input"
                            min={0}
                            max={exam.total_marks}
                            step="0.5"
                            value={marks}
                            disabled={locked || (isSaved && !isEditing)}
                            placeholder={`/ ${exam.total_marks}`}
                            onChange={e => onChange(student.id, { ...rowData, marks_obtained: e.target.value })}
                            style={{ maxWidth: '100px' }}
                        />
                        {/* Live preview */}
                        {pct !== null && (
                            <span style={{
                                fontSize: '12px',
                                fontWeight: 700,
                                color: passed ? '#2E7D32' : '#C62828',
                                background: passed ? '#E8F5E9' : '#FFEBEE',
                                borderRadius: '4px',
                                padding: '2px 6px',
                            }}>
                                {pct}% · {grade} · {passed ? '✓ Pass' : '✗ Fail'}
                            </span>
                        )}
                    </div>
                )}
            </td>
            <td>
                {locked ? (
                    <span style={{ color: '#2E7D32', fontSize: '12px', fontWeight: 700 }}>🔒 Locked</span>
                ) : isSaved && !isEditing ? (
                    <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => onChange(student.id, { ...rowData, isEditing: true })}
                    >
                        Edit
                    </button>
                ) : (
                    <button
                        className="btn btn-sm btn-primary"
                        disabled={saving}
                        onClick={handleSave}
                    >
                        {saving ? '...' : 'Save'}
                    </button>
                )}
            </td>
        </tr>
    );
}

// ─── Main EnterMarks Page ─────────────────────────────────────
function EnterMarks() {
    const [exams, setExams] = useState([]);
    const [selectedExam, setSelectedExam] = useState('');
    const [students, setStudents] = useState([]);
    const [marksData, setMarksData] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [lockingExam, setLockingExam] = useState(false);

    useEffect(() => { fetchExams(); }, []);

    useEffect(() => {
        if (selectedExam) {
            const examObj = exams.find(e => e.id === parseInt(selectedExam));
            if (examObj) fetchStudentsAndMarks(examObj);
        } else {
            setStudents([]);
            setMarksData({});
        }
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
                api.get(`/students?class_id=${examObj.class_id}`),
                api.get(`/exams/${examObj.id}/marks`).catch(() => ({ data: { data: [] } })),
            ]);

            const fetchedStudents = studRes.data.data || [];
            const existingMarks = marksRes.data.data || [];

            const initialData = {};
            fetchedStudents.forEach(st => {
                const em = existingMarks.find(m => m.student_id === st.id);
                initialData[st.id] = {
                    marks_obtained: em ? em.marks_obtained : '',
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

    const examObj = selectedExam ? exams.find(e => e.id === parseInt(selectedExam)) : null;

    // All marks entered = every student has a saved mark (present or absent)
    const allMarksEntered = students.length > 0 &&
        students.every(st => marksData[st.id]?.isSaved);

    // Stats bar rows
    const statsRows = students.map(st => marksData[st.id] || {});

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1>📝 Enter Marks</h1>
                    <p>Enter and manage exam results for your students</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Link to="/faculty/dashboard" className="btn btn-secondary">← Back</Link>
                </div>
            </div>

            {error && (
                <div style={{ color: '#C62828', padding: '10px', marginBottom: '1rem', background: '#FFEBEE', borderRadius: '8px' }}>
                    {error}
                </div>
            )}

            {/* Exam selector */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ padding: '1.5rem' }}>
                    <div className="form-group" style={{ maxWidth: '450px' }}>
                        <label className="form-label">Select Exam *</label>
                        <select
                            className="form-select"
                            value={selectedExam}
                            onChange={e => setSelectedExam(e.target.value)}
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

                    {/* Exam info banner */}
                    {examObj && (
                        <div style={{
                            marginTop: '1rem',
                            padding: '0.75rem 1.25rem',
                            background: examObj.marks_locked ? '#E8F5E9' : '#E3F2FD',
                            border: `1px solid ${examObj.marks_locked ? '#A5D6A7' : '#90CAF9'}`,
                            borderRadius: '8px',
                            fontSize: '14px',
                            display: 'flex',
                            gap: '1rem',
                            flexWrap: 'wrap',
                        }}>
                            <span><strong>Total Marks:</strong> {examObj.total_marks}</span>
                            <span><strong>Passing Marks:</strong> {examObj.passing_marks}</span>
                            <span><strong>Subject:</strong> {examObj.Subject?.name || 'N/A'}</span>
                            <span><strong>Status:</strong>{' '}
                                {examObj.marks_locked
                                    ? <span style={{ color: '#2E7D32', fontWeight: 700 }}>🔒 Locked — Results Published</span>
                                    : <span style={{ color: '#E65100', fontWeight: 700 }}>🟢 Open — Marks Being Entered</span>}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {selectedExam && (
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Student List ({students.length})</h3>
                    </div>

                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Loading students...</div>
                    ) : (
                        <div style={{ padding: '1rem' }}>
                            {/* Class Stats Bar */}
                            {examObj && (
                                <ClassStatsBar rows={statsRows} passingMarks={examObj.passing_marks} />
                            )}

                            <div className="table-container">
                                <table className="table mobile-keep">
                                    <thead>
                                        <tr>
                                            <th>Roll No</th>
                                            <th>Student Name</th>
                                            <th>Absent</th>
                                            <th>Marks / Total</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                                                    No students found in this class
                                                </td>
                                            </tr>
                                        ) : (
                                            students.map(student => (
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

                            {/* Lock & Publish Button */}
                            {examObj && !examObj.marks_locked && allMarksEntered && (
                                <button
                                    onClick={handleLock}
                                    disabled={lockingExam}
                                    style={{
                                        width: '100%',
                                        marginTop: '1.5rem',
                                        padding: '14px',
                                        background: 'linear-gradient(135deg, #E65100, #FF9800)',
                                        color: '#fff',
                                        fontWeight: '800',
                                        fontSize: '15px',
                                        border: 'none',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 16px rgba(230,81,0,0.35)',
                                        letterSpacing: '0.3px',
                                    }}
                                >
                                    {lockingExam ? '⏳ Locking...' : '🔒 Lock & Publish Results to Students'}
                                </button>
                            )}

                            {/* Locked confirmation banner */}
                            {examObj && examObj.marks_locked && (
                                <div style={{
                                    marginTop: '1rem',
                                    padding: '1rem 1.5rem',
                                    background: '#E8F5E9',
                                    borderRadius: '10px',
                                    textAlign: 'center',
                                    color: '#2E7D32',
                                    fontWeight: '700',
                                    border: '1px solid #A5D6A7',
                                }}>
                                    ✅ Marks locked. Students and parents can now view results.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default EnterMarks;
