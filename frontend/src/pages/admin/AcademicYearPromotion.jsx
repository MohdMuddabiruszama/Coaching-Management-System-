/**
 * AcademicYearPromotion — 4-Screen Promotion Wizard
 * Phase 9 — Academic Year Promotion Engine
 *
 * Screen 1: Overview       — class cards + student counts + suggested next stage
 * Screen 2: Review         — student table with bulk-select + per-student override
 * Screen 3: Confirmation   — summary + typed "PROMOTE" confirmation
 * Screen 4: Progress/Done  — result screen (instant for sync, live bar for async)
 */

import { useState, useEffect, useContext, useRef } from "react";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "./AcademicYearPromotion.css";

const STUDENT_ACTIONS = [
    { value: "promote", label: "Promote", icon: "⬆️", color: "#22c55e" },
    { value: "repeat", label: "Repeat Year", icon: "🔄", color: "#f59e0b" },
    { value: "graduate", label: "Graduate", icon: "🎓", color: "#6366f1" },
    { value: "transfer", label: "Transfer", icon: "↗️", color: "#0ea5e9" },
    { value: "drop", label: "Drop", icon: "❌", color: "#ef4444" },
];

const SCREENS = { OVERVIEW: 1, REVIEW: 2, CONFIRM: 3, RESULT: 4 };

export default function AcademicYearPromotion() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const [screen, setScreen] = useState(SCREENS.OVERVIEW);
    const [preview, setPreview] = useState(null);
    const [students, setStudents] = useState([]);
    const [overrides, setOverrides] = useState({});   // { studentId: { action, toClassId } }
    const [selectedStudents, setSelectedStudents] = useState(new Set());
    const [newYearLabel, setNewYearLabel] = useState("");
    const [confirmText, setConfirmText] = useState("");
    const [loading, setLoading] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(true);
    const [error, setError] = useState("");
    const [result, setResult] = useState(null);
    const [filterClass, setFilterClass] = useState("all");
    const [filterFlag, setFilterFlag] = useState("all");
    const [searchText, setSearchText] = useState("");

    // ── Fetch preview on mount ────────────────────────────────────────────────
    useEffect(() => {
        fetchPreview();
    }, []);

    const fetchPreview = async () => {
        setPreviewLoading(true);
        setError("");
        try {
            const res = await api.get("/academic-years/promotion/preview");
            setPreview(res.data.data);
            // Auto-fill new year label suggestion
            if (res.data.data?.currentYear?.label) {
                const parts = res.data.data.currentYear.label.split("-");
                if (parts.length === 2) {
                    const nextYear = parseInt(parts[0], 10) + 1;
                    const nextYY = String(nextYear + 1).slice(-2);
                    setNewYearLabel(`${nextYear}-${nextYY}`);
                }
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load promotion preview. Please try again.");
        } finally {
            setPreviewLoading(false);
        }
    };

    // ── Load students for Review screen ──────────────────────────────────────
    const loadStudentsForReview = async () => {
        setLoading(true);
        try {
            const res = await api.get("/academic-years/promotion/eligible-students");
            const studs = res.data.data?.students || [];
            setStudents(studs);
            // Default action from promotion rules
            const defaultOverrides = {};
            studs.forEach((s) => {
                const rule = preview?.classes?.find((c) => c.classId === s.class_id);
                const action = rule?.suggestedAction?.type === "promote" ? "promote"
                    : rule?.suggestedAction?.type === "graduate" ? "graduate"
                    : rule?.suggestedAction?.type === "course_completed" ? "graduate"
                    : "promote";
                defaultOverrides[s.id] = {
                    action,
                    toClassId: rule?.suggestedAction?.toClassId || null,
                };
            });
            setOverrides(defaultOverrides);
        } catch (err) {
            setError("Failed to load students.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoToReview = () => {
        setScreen(SCREENS.REVIEW);
        if (students.length === 0) loadStudentsForReview();
    };

    // ── Override management ───────────────────────────────────────────────────
    const setStudentOverride = (studentId, field, value) => {
        setOverrides((prev) => ({
            ...prev,
            [studentId]: { ...prev[studentId], [field]: value },
        }));
    };

    const bulkSetAction = (action) => {
        const updated = { ...overrides };
        selectedStudents.forEach((id) => {
            updated[id] = { ...updated[id], action };
        });
        setOverrides(updated);
        setSelectedStudents(new Set());
    };

    const toggleSelectStudent = (id) => {
        setSelectedStudents((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedStudents.size === filteredStudents.length) {
            setSelectedStudents(new Set());
        } else {
            setSelectedStudents(new Set(filteredStudents.map((s) => s.id)));
        }
    };

    // ── Filtered students ─────────────────────────────────────────────────────
    const filteredStudents = students.filter((s) => {
        if (filterClass !== "all" && String(s.class_id) !== filterClass) return false;
        if (filterFlag === "flagged" && !preview?.flaggedStudentIds?.includes(s.id)) return false;
        if (searchText && !((s.User?.name || s.name) || "").toLowerCase().includes(searchText.toLowerCase())) return false;
        return true;
    });

    // ── Execute promotion ─────────────────────────────────────────────────────
    const handleExecutePromotion = async () => {
        if (confirmText !== "PROMOTE") {
            setError('Please type "PROMOTE" to confirm.');
            return;
        }
        if (!newYearLabel.trim()) {
            setError("Please enter the new academic year label (e.g. 2026-27).");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const overrideList = Object.entries(overrides).map(([studentId, data]) => ({
                studentId: parseInt(studentId, 10),
                action: data.action,
                toClassId: data.toClassId || null,
            }));

            const res = await api.post("/academic-years/promotion/execute", {
                newYearLabel,
                confirmation: "PROMOTE",
                overrides: overrideList,
            });

            setResult(res.data.data || res.data);
            setScreen(SCREENS.RESULT);
        } catch (err) {
            setError(err.response?.data?.message || "Promotion failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // ── Class list for filter ─────────────────────────────────────────────────
    const classOptions = preview?.classes?.filter((c) => c.studentCount > 0) || [];

    // ────────────────────────────────────────────────────────────────────────
    // SCREEN 1 — OVERVIEW
    // ────────────────────────────────────────────────────────────────────────
    if (screen === SCREENS.OVERVIEW) {
        return (
            <div className="ayp-container">
                <div className="ayp-header">
                    <div className="ayp-header-left">
                        <span className="ayp-title-icon">🎓</span>
                        <div>
                            <h1 className="ayp-title">Academic Year Promotion</h1>
                            <p className="ayp-subtitle">
                                {preview?.currentYear
                                    ? `Current year: ${preview.currentYear.label} → Promote to: ${newYearLabel || "..."}`
                                    : "Loading academic year data..."}
                            </p>
                        </div>
                    </div>
                    <div className="ayp-header-actions">
                        <button className="ayp-btn ayp-btn-ghost" onClick={() => navigate("/admin/academic-year-settings")}>
                            ⚙️ Year Settings
                        </button>
                        <button className="ayp-btn ayp-btn-ghost" onClick={fetchPreview} disabled={previewLoading}>
                            🔄 Refresh
                        </button>
                    </div>
                </div>

                {/* Steps indicator */}
                <div className="ayp-steps">
                    {["Overview", "Review & Override", "Confirm", "Result"].map((step, i) => (
                        <div key={step} className={`ayp-step ${screen > i ? "ayp-step-done" : ""} ${screen === i + 1 ? "ayp-step-active" : ""}`}>
                            <div className="ayp-step-dot">{screen > i + 1 ? "✓" : i + 1}</div>
                            <span>{step}</span>
                        </div>
                    ))}
                </div>

                {error && <div className="ayp-error">{error}</div>}

                {previewLoading ? (
                    <div className="ayp-loading">
                        <div className="ayp-spinner" />
                        <p>Loading promotion preview...</p>
                    </div>
                ) : preview ? (
                    <>
                        {/* Summary banner */}
                        <div className="ayp-summary-banner">
                            <div className="ayp-summary-card ayp-summary-total">
                                <span className="ayp-summary-icon">👥</span>
                                <div>
                                    <div className="ayp-summary-value">{preview.totalActiveStudents}</div>
                                    <div className="ayp-summary-label">Active Students</div>
                                </div>
                            </div>
                            <div className="ayp-summary-card ayp-summary-classes">
                                <span className="ayp-summary-icon">📚</span>
                                <div>
                                    <div className="ayp-summary-value">{preview.classes?.filter((c) => c.studentCount > 0).length}</div>
                                    <div className="ayp-summary-label">Active Classes</div>
                                </div>
                            </div>
                            <div className="ayp-summary-card ayp-summary-flagged">
                                <span className="ayp-summary-icon">⚠️</span>
                                <div>
                                    <div className="ayp-summary-value">{preview.flaggedStudentIds?.length || 0}</div>
                                    <div className="ayp-summary-label">Students with Pending Fees</div>
                                </div>
                            </div>
                            <div className="ayp-summary-card ayp-summary-rules">
                                <span className="ayp-summary-icon">{preview.promotionRulesDefined ? "✅" : "⚙️"}</span>
                                <div>
                                    <div className="ayp-summary-value">{preview.promotionRulesDefined ? "Configured" : "Not Set"}</div>
                                    <div className="ayp-summary-label">Promotion Rules</div>
                                </div>
                            </div>
                        </div>

                        {!preview.promotionRulesDefined && (
                            <div className="ayp-warning-banner">
                                <span>⚠️</span>
                                <div>
                                    <strong>No promotion rules configured.</strong>
                                    <span> Students will be kept in their current class (repeat). </span>
                                    <button className="ayp-inline-link" onClick={() => navigate("/admin/academic-year-settings")}>
                                        Configure rules →
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Class cards grid */}
                        <div className="ayp-class-grid">
                            {preview.classes?.map((cls) => (
                                <div key={cls.classId} className={`ayp-class-card ${cls.studentCount === 0 ? "ayp-class-card-empty" : ""}`}>
                                    <div className="ayp-class-card-header">
                                        <h3 className="ayp-class-name">{cls.className}{cls.classSection ? ` (${cls.classSection})` : ""}</h3>
                                        <span className={`ayp-class-badge ${cls.suggestedAction.type === "no_rule" ? "ayp-badge-warn" : "ayp-badge-ok"}`}>
                                            {cls.studentCount} students
                                        </span>
                                    </div>
                                    <div className="ayp-class-arrow">
                                        <div className="ayp-class-from">
                                            <span className="ayp-class-label">Current</span>
                                            <span className="ayp-class-value">{cls.className}</span>
                                        </div>
                                        <span className="ayp-arrow-icon">
                                            {cls.suggestedAction.type === "promote" ? "→" : cls.suggestedAction.type === "graduate" ? "🎓" : cls.suggestedAction.type === "course_completed" ? "✅" : "⟳"}
                                        </span>
                                        <div className="ayp-class-to">
                                            <span className="ayp-class-label">Next</span>
                                            <span className="ayp-class-value">
                                                {cls.suggestedAction.toClassName || (cls.suggestedAction.type === "graduate" ? "Graduate" : cls.suggestedAction.type === "course_completed" ? "Completed" : "No Rule")}
                                            </span>
                                        </div>
                                    </div>
                                    {cls.studentCount === 0 && <p className="ayp-class-empty-note">No active students</p>}
                                </div>
                            ))}
                        </div>

                        {/* New year label input */}
                        <div className="ayp-year-input-section">
                            <label className="ayp-label">New Academic Year Label</label>
                            <div className="ayp-year-input-row">
                                <input
                                    className="ayp-input"
                                    type="text"
                                    placeholder="e.g. 2026-27"
                                    value={newYearLabel}
                                    onChange={(e) => setNewYearLabel(e.target.value)}
                                    maxLength={20}
                                />
                                <p className="ayp-hint">This will be the label for the new academic year (e.g. 2026-27)</p>
                            </div>
                        </div>

                        <div className="ayp-footer-actions">
                            {preview.totalActiveStudents === 0 ? (
                                <p className="ayp-no-students">No active students to promote.</p>
                            ) : (
                                <button
                                    className="ayp-btn ayp-btn-primary ayp-btn-lg"
                                    onClick={handleGoToReview}
                                    disabled={!newYearLabel.trim()}
                                >
                                    Review Students & Overrides →
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="ayp-empty-state">
                        <p>No academic year data available. <button className="ayp-inline-link" onClick={() => navigate("/admin/academic-year-settings")}>Set up academic years →</button></p>
                    </div>
                )}
            </div>
        );
    }

    // ────────────────────────────────────────────────────────────────────────
    // SCREEN 2 — REVIEW & OVERRIDE
    // ────────────────────────────────────────────────────────────────────────
    if (screen === SCREENS.REVIEW) {
        return (
            <div className="ayp-container">
                <div className="ayp-header">
                    <div className="ayp-header-left">
                        <button className="ayp-btn ayp-btn-ghost" onClick={() => setScreen(SCREENS.OVERVIEW)}>← Back</button>
                        <div>
                            <h1 className="ayp-title">Review & Override</h1>
                            <p className="ayp-subtitle">{preview?.currentYear?.label} → {newYearLabel}</p>
                        </div>
                    </div>
                </div>

                <div className="ayp-steps">
                    {["Overview", "Review & Override", "Confirm", "Result"].map((step, i) => (
                        <div key={step} className={`ayp-step ${screen > i ? "ayp-step-done" : ""} ${screen === i + 1 ? "ayp-step-active" : ""}`}>
                            <div className="ayp-step-dot">{screen > i + 1 ? "✓" : i + 1}</div>
                            <span>{step}</span>
                        </div>
                    ))}
                </div>

                {error && <div className="ayp-error">{error}</div>}

                {/* Filters & bulk actions */}
                <div className="ayp-review-toolbar">
                    <input
                        className="ayp-input ayp-search-input"
                        placeholder="🔍 Search students..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                    />
                    <select className="ayp-select" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
                        <option value="all">All Classes</option>
                        {classOptions.map((c) => (
                            <option key={c.classId} value={String(c.classId)}>{c.className}{c.classSection ? ` (${c.classSection})` : ""}</option>
                        ))}
                    </select>
                    <select className="ayp-select" value={filterFlag} onChange={(e) => setFilterFlag(e.target.value)}>
                        <option value="all">All Students</option>
                        <option value="flagged">⚠️ Flagged (Pending Fees)</option>
                    </select>
                </div>

                {selectedStudents.size > 0 && (
                    <div className="ayp-bulk-actions">
                        <span className="ayp-bulk-label">{selectedStudents.size} selected:</span>
                        {STUDENT_ACTIONS.map((a) => (
                            <button
                                key={a.value}
                                className="ayp-bulk-btn"
                                style={{ "--action-color": a.color }}
                                onClick={() => bulkSetAction(a.value)}
                            >
                                {a.icon} {a.label}
                            </button>
                        ))}
                    </div>
                )}

                {loading ? (
                    <div className="ayp-loading"><div className="ayp-spinner" /><p>Loading students...</p></div>
                ) : (
                    <div className="ayp-table-wrapper">
                        <table className="ayp-table">
                            <thead>
                                <tr>
                                    <th>
                                        <input type="checkbox"
                                            checked={selectedStudents.size === filteredStudents.length && filteredStudents.length > 0}
                                            onChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th>Student</th>
                                    <th>Current Class</th>
                                    <th>Flags</th>
                                    <th>Action</th>
                                    <th>To Class</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.map((student) => {
                                    const isFlagged = preview?.flaggedStudentIds?.includes(student.id);
                                    const override = overrides[student.id] || { action: "promote", toClassId: null };
                                    const currentClass = preview?.classes?.find((c) => c.classId === student.class_id);

                                    return (
                                        <tr key={student.id} className={`ayp-table-row ${isFlagged ? "ayp-row-flagged" : ""} ${selectedStudents.has(student.id) ? "ayp-row-selected" : ""}`}>
                                            <td>
                                                <input type="checkbox"
                                                    checked={selectedStudents.has(student.id)}
                                                    onChange={() => toggleSelectStudent(student.id)}
                                                />
                                            </td>
                                            <td>
                                                <div className="ayp-student-cell">
                                                    <div className="ayp-student-avatar">{((student.User?.name || student.name) || "?")[0].toUpperCase()}</div>
                                                    <div>
                                                        <div className="ayp-student-name">{(student.User?.name || student.name) || "—"}</div>
                                                        <div className="ayp-student-roll">{student.roll_number || ""}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="ayp-td-class">{currentClass?.className || "—"}</td>
                                            <td>
                                                {isFlagged && (
                                                    <span className="ayp-flag-badge" title="Has pending fees">⚠️ Pending Fees</span>
                                                )}
                                            </td>
                                            <td>
                                                <select
                                                    className="ayp-action-select"
                                                    value={override.action}
                                                    onChange={(e) => setStudentOverride(student.id, "action", e.target.value)}
                                                    style={{ borderColor: STUDENT_ACTIONS.find((a) => a.value === override.action)?.color || "#e2e8f0" }}
                                                >
                                                    {STUDENT_ACTIONS.map((a) => (
                                                        <option key={a.value} value={a.value}>{a.icon} {a.label}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td>
                                                {(override.action === "promote" || override.action === "repeat") && (
                                                    <select
                                                        className="ayp-action-select"
                                                        value={override.toClassId || ""}
                                                        onChange={(e) => setStudentOverride(student.id, "toClassId", e.target.value ? parseInt(e.target.value, 10) : null)}
                                                    >
                                                        <option value="">Default</option>
                                                        {preview?.classes?.map((c) => (
                                                            <option key={c.classId} value={c.classId}>{c.className}</option>
                                                        ))}
                                                    </select>
                                                )}
                                                {override.action === "graduate" && <span className="ayp-badge-small ayp-badge-green">Graduate</span>}
                                                {override.action === "drop" && <span className="ayp-badge-small ayp-badge-red">Drop</span>}
                                                {override.action === "transfer" && <span className="ayp-badge-small ayp-badge-blue">Transfer</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredStudents.length === 0 && (
                                    <tr><td colSpan="6" className="ayp-td-empty">No students found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="ayp-footer-actions">
                    <span className="ayp-count-hint">{filteredStudents.length} of {students.length} students shown</span>
                    <button className="ayp-btn ayp-btn-primary ayp-btn-lg" onClick={() => setScreen(SCREENS.CONFIRM)}>
                        Confirm Promotion →
                    </button>
                </div>
            </div>
        );
    }

    // ────────────────────────────────────────────────────────────────────────
    // SCREEN 3 — CONFIRMATION
    // ────────────────────────────────────────────────────────────────────────
    if (screen === SCREENS.CONFIRM) {
        const actionCounts = Object.values(overrides).reduce((acc, o) => {
            acc[o.action] = (acc[o.action] || 0) + 1;
            return acc;
        }, {});

        return (
            <div className="ayp-container">
                <div className="ayp-header">
                    <div className="ayp-header-left">
                        <button className="ayp-btn ayp-btn-ghost" onClick={() => setScreen(SCREENS.REVIEW)}>← Back</button>
                        <div>
                            <h1 className="ayp-title">Confirm Promotion</h1>
                            <p className="ayp-subtitle">Review the final summary before executing</p>
                        </div>
                    </div>
                </div>

                <div className="ayp-steps">
                    {["Overview", "Review & Override", "Confirm", "Result"].map((step, i) => (
                        <div key={step} className={`ayp-step ${screen > i ? "ayp-step-done" : ""} ${screen === i + 1 ? "ayp-step-active" : ""}`}>
                            <div className="ayp-step-dot">{screen > i + 1 ? "✓" : i + 1}</div>
                            <span>{step}</span>
                        </div>
                    ))}
                </div>

                {error && <div className="ayp-error">{error}</div>}

                <div className="ayp-confirm-card">
                    <div className="ayp-confirm-year-change">
                        <div className="ayp-confirm-year-from">
                            <div className="ayp-confirm-year-label">From Year</div>
                            <div className="ayp-confirm-year-value">{preview?.currentYear?.label || "Current"}</div>
                        </div>
                        <div className="ayp-confirm-arrow">→</div>
                        <div className="ayp-confirm-year-to">
                            <div className="ayp-confirm-year-label">New Year</div>
                            <div className="ayp-confirm-year-value ayp-confirm-year-new">{newYearLabel}</div>
                        </div>
                    </div>

                    <div className="ayp-confirm-breakdown">
                        <h3 className="ayp-confirm-breakdown-title">Student Outcome Summary</h3>
                        <div className="ayp-confirm-breakdown-grid">
                            {STUDENT_ACTIONS.map((a) => (
                                actionCounts[a.value] ? (
                                    <div key={a.value} className="ayp-confirm-breakdown-item" style={{ "--action-color": a.color }}>
                                        <span className="ayp-confirm-breakdown-icon">{a.icon}</span>
                                        <span className="ayp-confirm-breakdown-count">{actionCounts[a.value]}</span>
                                        <span className="ayp-confirm-breakdown-label">{a.label}</span>
                                    </div>
                                ) : null
                            ))}
                        </div>
                        <div className="ayp-confirm-total">
                            Total students processed: <strong>{students.length}</strong>
                        </div>
                    </div>

                    <div className="ayp-confirm-warning">
                        <span>⚠️</span>
                        <span>This action will close all current active enrollments and open new ones. The transaction is atomic — it either fully succeeds or fully fails.</span>
                    </div>

                    <div className="ayp-confirm-type-section">
                        <label className="ayp-label">Type <strong>PROMOTE</strong> to confirm</label>
                        <input
                            className={`ayp-input ayp-confirm-input ${confirmText === "PROMOTE" ? "ayp-input-valid" : ""}`}
                            type="text"
                            placeholder="PROMOTE"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                            maxLength={10}
                        />
                    </div>

                    <div className="ayp-footer-actions">
                        <button
                            className="ayp-btn ayp-btn-danger ayp-btn-lg"
                            onClick={handleExecutePromotion}
                            disabled={loading || confirmText !== "PROMOTE"}
                        >
                            {loading ? "Processing..." : `🎓 Execute Promotion to ${newYearLabel}`}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ────────────────────────────────────────────────────────────────────────
    // SCREEN 4 — RESULT
    // ────────────────────────────────────────────────────────────────────────
    if (screen === SCREENS.RESULT) {
        const isAsync = result?.isAsync;

        return (
            <div className="ayp-container">
                <div className="ayp-steps">
                    {["Overview", "Review & Override", "Confirm", "Result"].map((step, i) => (
                        <div key={step} className={`ayp-step ${screen > i ? "ayp-step-done" : ""} ${screen === i + 1 ? "ayp-step-active" : ""}`}>
                            <div className="ayp-step-dot">{screen > i + 1 ? "✓" : i + 1}</div>
                            <span>{step}</span>
                        </div>
                    ))}
                </div>

                <div className="ayp-result-card">
                    {isAsync ? (
                        <>
                            <div className="ayp-result-icon ayp-result-async">⏳</div>
                            <h2 className="ayp-result-title">Promotion Queued</h2>
                            <p className="ayp-result-subtitle">Your institute has a large number of students. The promotion is being processed in the background.</p>
                            <div className="ayp-async-progress-bar">
                                <div className="ayp-async-progress-fill" />
                            </div>
                            <p className="ayp-result-note">You will receive a notification when it completes. You can safely leave this page.</p>
                        </>
                    ) : (
                        <>
                            <div className="ayp-result-icon ayp-result-success">🎉</div>
                            <h2 className="ayp-result-title">Promotion Complete!</h2>
                            <p className="ayp-result-subtitle">
                                Academic year {result?.fromYear?.label} → {result?.newYear?.label}
                            </p>
                            <div className="ayp-result-stats">
                                <div className="ayp-result-stat">
                                    <span className="ayp-result-stat-value">{result?.promoted || 0}</span>
                                    <span className="ayp-result-stat-label">Promoted</span>
                                </div>
                                <div className="ayp-result-stat">
                                    <span className="ayp-result-stat-value">{result?.graduated || 0}</span>
                                    <span className="ayp-result-stat-label">Graduated</span>
                                </div>
                                <div className="ayp-result-stat">
                                    <span className="ayp-result-stat-value">{result?.dropped || 0}</span>
                                    <span className="ayp-result-stat-label">Dropped</span>
                                </div>
                                <div className="ayp-result-stat">
                                    <span className="ayp-result-stat-value">{result?.totalProcessed || 0}</span>
                                    <span className="ayp-result-stat-label">Total Processed</span>
                                </div>
                            </div>
                            <p className="ayp-result-note">All enrollment records have been updated. The audit log has been written.</p>
                        </>
                    )}
                    <div className="ayp-result-actions">
                        <button className="ayp-btn ayp-btn-primary" onClick={() => navigate("/admin/students")}>
                            View Students
                        </button>
                        <button className="ayp-btn ayp-btn-ghost" onClick={() => {
                            setScreen(SCREENS.OVERVIEW);
                            setResult(null);
                            setConfirmText("");
                            setStudents([]);
                            setOverrides({});
                            fetchPreview();
                        }}>
                            Start New Promotion
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
