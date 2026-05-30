/**
 * Exams Management Page — Phase 4 (Approach B)
 * Admin view: Create · Edit · Lock · Results · Delete exams
 * Includes: exam_type field, Type badge, Status badge, all action buttons
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import examService from '../../services/exam.service';
import ExamResultsDrawer from '../../components/ExamResultsDrawer';
import ThemeSelector from '../../components/ThemeSelector';
import './Dashboard.css';

// ─── Exam type display labels ────────────────────────────────
const EXAM_TYPE_LABELS = {
    unit_test:  'Unit Test',
    midterm:    'Mid-Term',
    final:      'Final Exam',
    mock:       'Mock Test',
    practical:  'Practical',
    other:      'Other',
};

const EXAM_TYPE_COLORS = {
    unit_test:  { bg: '#E3F2FD', color: '#1565C0' },
    midterm:    { bg: '#F3E5F5', color: '#6A1B9A' },
    final:      { bg: '#FCE4EC', color: '#C62828' },
    mock:       { bg: '#FFF8E1', color: '#E65100' },
    practical:  { bg: '#E8F5E9', color: '#2E7D32' },
    other:      { bg: '#F5F5F5', color: '#555555' },
};

const EMPTY_FORM = {
    name: '',
    subject_id: '',
    class_id: '',
    exam_date: '',
    total_marks: '',
    passing_marks: '',
    exam_type: 'unit_test',
};

function Exams() {
    const [exams, setExams] = useState([]);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingExam, setEditingExam] = useState(null); // null = create mode
    const [subjectMode, setSubjectMode] = useState('single');
    const [formData, setFormData] = useState(EMPTY_FORM);

    // Results drawer
    const [drawerExamId, setDrawerExamId] = useState(null);

    // Lock confirmation
    const [lockingId, setLockingId] = useState(null);

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [examRes, classRes, subRes] = await Promise.all([
                api.get('/exams'),
                api.get('/classes'),
                api.get('/subjects'),
            ]);
            setExams(examRes.data.data.exams || []);
            setClasses(classRes.data.data || []);
            setSubjects(subRes.data.data || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Subjects for selected class
    const availableSubjects = formData.class_id
        ? subjects.filter(s => s.class_id === parseInt(formData.class_id))
        : [];

    const selectedClass = classes.find(c => c.id === parseInt(formData.class_id));

    const handleChange = e =>
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleClassChange = e => {
        setFormData(prev => ({ ...prev, class_id: e.target.value, subject_id: '' }));
        setSubjectMode('single');
    };

    const handleModeChange = mode => {
        setSubjectMode(mode);
        if (mode === 'all') setFormData(prev => ({ ...prev, subject_id: '' }));
    };

    // ── Open create modal ────────────────────────────────────
    const openCreateModal = () => {
        setEditingExam(null);
        setFormData(EMPTY_FORM);
        setSubjectMode('single');
        setShowModal(true);
    };

    // ── Open edit modal ──────────────────────────────────────
    const openEditModal = (exam) => {
        setEditingExam(exam);
        setFormData({
            name:          exam.name,
            subject_id:    exam.subject_id || '',
            class_id:      exam.class_id || '',
            exam_date:     exam.exam_date ? exam.exam_date.slice(0, 10) : '',
            total_marks:   exam.total_marks,
            passing_marks: exam.passing_marks,
            exam_type:     exam.exam_type || 'unit_test',
        });
        setSubjectMode('single');
        setShowModal(true);
    };

    // ── Submit (create or edit) ──────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.class_id) { alert('Please select a class.'); return; }
        if (!editingExam && subjectMode === 'single' && !formData.subject_id) {
            alert('Please select a subject.'); return;
        }
        if (!editingExam && subjectMode === 'all' && availableSubjects.length === 0) {
            alert('No subjects available for the selected class.'); return;
        }

        setSubmitting(true);
        try {
            if (editingExam) {
                // ── EDIT MODE ──────────────────────────────────
                await examService.update(editingExam.id, {
                    name:          formData.name,
                    exam_date:     formData.exam_date,
                    total_marks:   formData.total_marks,
                    passing_marks: formData.passing_marks,
                    exam_type:     formData.exam_type,
                });
                alert('Exam updated successfully!');
            } else if (subjectMode === 'single') {
                // ── CREATE SINGLE ──────────────────────────────
                await api.post('/exams', formData);
                alert('Exam created successfully!');
            } else {
                // ── CREATE BULK (all subjects) ─────────────────
                const errors = [];
                const created = [];
                for (const subject of availableSubjects) {
                    try {
                        await api.post('/exams', { ...formData, subject_id: subject.id });
                        created.push(subject.name);
                    } catch (err) {
                        errors.push(`${subject.name}: ${err.response?.data?.message || 'Failed'}`);
                    }
                }
                if (errors.length === 0) {
                    alert(`✅ ${created.length} exam(s) created!\nSubjects: ${created.join(', ')}`);
                } else if (created.length > 0) {
                    alert(`⚠️ Partial success:\n✅ ${created.join(', ')}\n❌ ${errors.join('; ')}`);
                } else {
                    alert(`❌ Failed:\n${errors.join('\n')}`);
                }
            }
            setShowModal(false);
            setFormData(EMPTY_FORM);
            fetchAll();
        } catch (error) {
            alert(error.response?.data?.message || 'Something went wrong');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Delete ───────────────────────────────────────────────
    const handleDelete = async (exam) => {
        if (!window.confirm(`Delete exam "${exam.name}"? This will also delete all marks.`)) return;
        try {
            await examService.delete(exam.id);
            fetchAll();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to delete exam');
        }
    };

    // ── Lock ─────────────────────────────────────────────────
    const handleLock = async (exam) => {
        if (!window.confirm(`Lock "${exam.name}"? Students will be able to see their results. This cannot be undone.`)) return;
        setLockingId(exam.id);
        try {
            await examService.lockMarks(exam.id);
            alert('✅ Marks locked! Students and parents can now view results.');
            fetchAll();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to lock marks');
        } finally {
            setLockingId(null);
        }
    };

    if (loading) return <div className="dashboard-container">Loading...</div>;

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1>✍️ Manage Exams</h1>
                    <p>Schedule, manage, and publish exam results for your institute</p>
                </div>
                <div className="dashboard-header-right">
                    <ThemeSelector />
                    <Link to="/admin/dashboard" className="btn btn-secondary">← Back</Link>
                    <button onClick={openCreateModal} className="btn btn-primary btn-animated">
                        + Add Exam
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">All Exams ({exams.length})</h3>
                </div>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Exam Name</th>
                                <th>Type</th>
                                <th>Subject</th>
                                <th>Class</th>
                                <th>Date</th>
                                <th>Total / Passing</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {exams.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                                        No exams found. Create your first exam!
                                    </td>
                                </tr>
                            ) : (
                                exams.map(exam => {
                                    const classInfo = classes.find(c => c.id === exam.class_id);
                                    const typeColor = EXAM_TYPE_COLORS[exam.exam_type] || EXAM_TYPE_COLORS.other;
                                    return (
                                        <tr key={exam.id}>
                                            <td><strong>{exam.name}</strong></td>
                                            <td>
                                                <span style={{
                                                    background: typeColor.bg,
                                                    color: typeColor.color,
                                                    borderRadius: '6px',
                                                    padding: '3px 8px',
                                                    fontSize: '12px',
                                                    fontWeight: 700,
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    {EXAM_TYPE_LABELS[exam.exam_type] || exam.exam_type || 'Unit Test'}
                                                </span>
                                            </td>
                                            <td>{exam.Subject?.name || 'N/A'}</td>
                                            <td>
                                                {classInfo
                                                    ? `${classInfo.name}${classInfo.section ? ` - ${classInfo.section}` : ''}`
                                                    : 'N/A'}
                                            </td>
                                            <td>{new Date(exam.exam_date).toLocaleDateString('en-IN')}</td>
                                            <td>
                                                <strong>{exam.total_marks}</strong>
                                                <span style={{ color: '#888', fontSize: '12px' }}> / {exam.passing_marks}</span>
                                            </td>
                                            <td>
                                                {exam.marks_locked ? (
                                                    <span style={{ background: '#E8F5E9', color: '#2E7D32', borderRadius: '6px', padding: '3px 8px', fontSize: '12px', fontWeight: 700 }}>
                                                        🔒 Locked
                                                    </span>
                                                ) : (
                                                    <span style={{ background: '#FFF8E1', color: '#E65100', borderRadius: '6px', padding: '3px 8px', fontSize: '12px', fontWeight: 700 }}>
                                                        🟢 Open
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    {/* Edit — only when not locked */}
                                                    {!exam.marks_locked && (
                                                        <button
                                                            onClick={() => openEditModal(exam)}
                                                            className="btn btn-sm"
                                                            style={{ background: '#1565C0', color: '#fff', border: 'none' }}
                                                        >
                                                            ✏️ Edit
                                                        </button>
                                                    )}

                                                    {/* Results — always visible */}
                                                    <button
                                                        onClick={() => setDrawerExamId(exam.id)}
                                                        className="btn btn-sm"
                                                        style={{ background: '#4527A0', color: '#fff', border: 'none' }}
                                                    >
                                                        📊 Results
                                                    </button>

                                                    {/* Lock / Locked */}
                                                    {!exam.marks_locked ? (
                                                        <button
                                                            onClick={() => handleLock(exam)}
                                                            className="btn btn-sm"
                                                            disabled={lockingId === exam.id}
                                                            style={{ background: '#FF9800', color: '#fff', border: 'none' }}
                                                        >
                                                            {lockingId === exam.id ? '⏳...' : '🔓 Lock'}
                                                        </button>
                                                    ) : (
                                                        <span style={{ color: '#2E7D32', fontSize: '13px', fontWeight: 'bold' }}>
                                                            ✅ Published
                                                        </span>
                                                    )}

                                                    {/* Delete — only when not locked */}
                                                    {!exam.marks_locked && (
                                                        <button
                                                            onClick={() => handleDelete(exam)}
                                                            className="btn btn-sm btn-danger"
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Results Drawer ── */}
            {drawerExamId && (
                <ExamResultsDrawer
                    examId={drawerExamId}
                    onClose={() => setDrawerExamId(null)}
                />
            )}

            {/* ── Create / Edit Exam Modal ── */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
                        <div className="modal-header">
                            <h3>{editingExam ? `✏️ Edit — ${editingExam.name}` : '➕ Create Exam'}</h3>
                            <button onClick={() => setShowModal(false)} className="btn btn-sm">×</button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleSubmit}>
                                {/* Exam Name */}
                                <div className="form-group">
                                    <label className="form-label">Exam Name *</label>
                                    <input
                                        type="text"
                                        name="name"
                                        className="form-input"
                                        placeholder="e.g., PT 1, Mid-Term, Annual Exam"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                {/* Exam Type */}
                                <div className="form-group">
                                    <label className="form-label">Exam Type *</label>
                                    <select
                                        name="exam_type"
                                        className="form-select"
                                        value={formData.exam_type}
                                        onChange={handleChange}
                                    >
                                        <option value="unit_test">Unit Test / PT</option>
                                        <option value="midterm">Mid-Term Exam</option>
                                        <option value="final">Final / Annual Exam</option>
                                        <option value="mock">Mock Test</option>
                                        <option value="practical">Practical</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                {/* Class */}
                                <div className="form-group">
                                    <label className="form-label">Class *</label>
                                    <select
                                        name="class_id"
                                        className="form-select"
                                        value={formData.class_id}
                                        onChange={handleClassChange}
                                        required
                                        disabled={!!editingExam}
                                    >
                                        <option value="">Select a class</option>
                                        {classes.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}{c.section && ` - ${c.section}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Subject — only in create mode */}
                                {!editingExam && formData.class_id && (
                                    <div className="form-group">
                                        <label className="form-label">Subject *</label>
                                        {/* Mode toggle */}
                                        <div className="exam-subject-mode-toggle">
                                            <button
                                                type="button"
                                                className={`exam-mode-btn ${subjectMode === 'single' ? 'active' : ''}`}
                                                onClick={() => handleModeChange('single')}
                                            >
                                                📖 Single Subject
                                            </button>
                                            <button
                                                type="button"
                                                className={`exam-mode-btn ${subjectMode === 'all' ? 'active' : ''}`}
                                                onClick={() => handleModeChange('all')}
                                                disabled={availableSubjects.length === 0}
                                            >
                                                📚 All Subjects ({availableSubjects.length})
                                            </button>
                                        </div>
                                        {subjectMode === 'single' && (
                                            <select
                                                name="subject_id"
                                                className="form-select"
                                                value={formData.subject_id}
                                                onChange={handleChange}
                                                required
                                                disabled={availableSubjects.length === 0}
                                                style={{ marginTop: '0.5rem' }}
                                            >
                                                <option value="">
                                                    {availableSubjects.length === 0 ? 'No subjects in this class' : 'Select a subject'}
                                                </option>
                                                {availableSubjects.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                        )}
                                        {subjectMode === 'all' && availableSubjects.length > 0 && (
                                            <div className="exam-all-subjects-preview" style={{ marginTop: '0.5rem' }}>
                                                <p className="exam-all-subjects-info">
                                                    ✅ {availableSubjects.length} exam(s) will be created for <strong>{selectedClass?.name}</strong>
                                                </p>
                                                <div className="exam-subjects-tag-list">
                                                    {availableSubjects.map(s => (
                                                        <span key={s.id} className="exam-subject-tag">{s.name}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Exam Date */}
                                <div className="form-group">
                                    <label className="form-label">Exam Date *</label>
                                    <input
                                        type="date"
                                        name="exam_date"
                                        className="form-input"
                                        value={formData.exam_date}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                {/* Total / Passing Marks */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label className="form-label">Total Marks *</label>
                                        <input
                                            type="number"
                                            name="total_marks"
                                            className="form-input"
                                            min="1"
                                            value={formData.total_marks}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Passing Marks *</label>
                                        <input
                                            type="number"
                                            name="passing_marks"
                                            className="form-input"
                                            min="0"
                                            max={formData.total_marks || 100}
                                            value={formData.passing_marks}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="btn btn-secondary"
                                        disabled={submitting}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={submitting}
                                    >
                                        {submitting ? 'Saving...' :
                                         editingExam ? 'Update Exam' :
                                         subjectMode === 'all' ? `Create ${availableSubjects.length} Exam(s)` :
                                         'Create Exam'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Exams;
