/**
 * AcademicYearSettings — Settings & Rules Configuration
 * Phase 9 — Academic Year Promotion Engine
 *
 * Sections:
 *  1. Academic Years list (create/edit/mark as current)
 *  2. Promotion Rules configuration (drag-and-drop sequence)
 *  3. Auto-suggest button
 *  4. Promotion Rollback tool
 */

import { useState, useEffect } from "react";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";
import "./AcademicYearPromotion.css";

export default function AcademicYearSettings() {
    const navigate = useNavigate();

    // ── State ──────────────────────────────────────────────────────────────
    const [tab, setTab] = useState("years");
    const [years, setYears] = useState([]);
    const [rules, setRules] = useState([]);
    const [classes, setClasses] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Year form
    const [newYearLabel, setNewYearLabel] = useState("");
    const [newYearStart, setNewYearStart] = useState("");
    const [newYearEnd, setNewYearEnd] = useState("");
    const [makeCurrent, setMakeCurrent] = useState(false);
    const [yearFormLoading, setYearFormLoading] = useState(false);

    // Rollback
    const [rbFromYear, setRbFromYear] = useState("");
    const [rbToYear, setRbToYear] = useState("");
    const [rbConfirm, setRbConfirm] = useState("");
    const [rbLoading, setRbLoading] = useState(false);

    // ── Fetch data ──────────────────────────────────────────────────────────
    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [yearsRes, rulesRes, classesRes] = await Promise.all([
                api.get("/academic-years"),
                api.get("/academic-years/rules"),
                api.get("/classes"),
            ]);
            setYears(yearsRes.data.data?.years || []);
            setRules(rulesRes.data.data?.rules || []);
            setClasses(classesRes.data.data || classesRes.data.data?.classes || []);
        } catch (err) {
            setError("Failed to load settings. Please refresh.");
        } finally {
            setLoading(false);
        }
    };

    // ── Academic Year operations ────────────────────────────────────────────
    const handleCreateYear = async (e) => {
        e.preventDefault();
        if (!newYearLabel.trim()) { setError("Please enter a year label."); return; }
        setYearFormLoading(true);
        setError(""); setSuccess("");
        try {
            await api.post("/academic-years", {
                label: newYearLabel.trim(),
                startDate: newYearStart || null,
                endDate: newYearEnd || null,
                makeCurrent,
            });
            setSuccess("Academic year created successfully!");
            setNewYearLabel(""); setNewYearStart(""); setNewYearEnd(""); setMakeCurrent(false);
            fetchAll();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to create academic year.");
        } finally {
            setYearFormLoading(false);
        }
    };

    const handleMakeCurrent = async (yearId) => {
        try {
            await api.patch(`/academic-years/${yearId}`, { makeCurrent: true });
            setSuccess("Current academic year updated!");
            fetchAll();
        } catch (err) {
            setError("Failed to update current year.");
        }
    };

    // ── Promotion Rules operations ──────────────────────────────────────────
    const handleSuggestRules = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await api.get("/academic-years/rules/suggest");
            setSuggestions(res.data.data?.suggestions || []);
        } catch (err) {
            setError("Failed to generate suggestions.");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSuggestedRules = async () => {
        if (suggestions.length === 0) return;
        setLoading(true);
        setError(""); setSuccess("");
        try {
            await api.post("/academic-years/rules/bulk", { rules: suggestions });
            setSuccess(`${suggestions.length} promotion rules saved!`);
            setSuggestions([]);
            fetchAll();
        } catch (err) {
            setError("Failed to save rules.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRule = async (ruleId) => {
        if (!window.confirm("Delete this promotion rule?")) return;
        try {
            await api.delete(`/academic-years/rules/${ruleId}`);
            setSuccess("Rule deleted.");
            fetchAll();
        } catch (err) {
            setError("Failed to delete rule.");
        }
    };

    // ── Rollback operation ──────────────────────────────────────────────────
    const handleRollback = async (e) => {
        e.preventDefault();
        if (rbConfirm !== "ROLLBACK") { setError('Type "ROLLBACK" to confirm.'); return; }
        setRbLoading(true);
        setError(""); setSuccess("");
        try {
            await api.post("/academic-years/promotion/rollback", {
                fromYearId: parseInt(rbFromYear, 10),
                toYearId: parseInt(rbToYear, 10),
                confirmation: "ROLLBACK",
            });
            setSuccess("Rollback completed! Enrollment records restored to the previous year.");
            setRbFromYear(""); setRbToYear(""); setRbConfirm("");
            fetchAll();
        } catch (err) {
            setError(err.response?.data?.message || "Rollback failed.");
        } finally {
            setRbLoading(false);
        }
    };

    const classOptions = classes || [];

    return (
        <div className="ayp-container">
            {/* Header */}
            <div className="ayp-header">
                <div className="ayp-header-left">
                    <span className="ayp-title-icon">📆</span>
                    <div>
                        <h1 className="ayp-title">Academic Year Settings</h1>
                        <p className="ayp-subtitle">Manage academic years and configure promotion rules</p>
                    </div>
                </div>
                <div className="ayp-header-actions">
                    <button className="ayp-btn ayp-btn-primary" onClick={() => navigate("/admin/academic-year-promotion")}>
                        🎓 Go to Promotion
                    </button>
                </div>
            </div>

            {error && <div className="ayp-error">{error}</div>}
            {success && (
                <div style={{ padding: "0.9rem 1.25rem", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "10px", color: "#15803d", fontSize: "0.9rem", marginBottom: "1.25rem" }}>
                    ✅ {success}
                </div>
            )}

            {/* Tab Navigation */}
            <div className="ays-tabs">
                {[
                    { id: "years", label: "📅 Academic Years" },
                    { id: "rules", label: "⚙️ Promotion Rules" },
                    { id: "rollback", label: "⏪ Rollback" },
                ].map((t) => (
                    <button
                        key={t.id}
                        className={`ays-tab ${tab === t.id ? "ays-tab-active" : ""}`}
                        onClick={() => { setTab(t.id); setError(""); setSuccess(""); }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── Tab 1: Academic Years ─────────────────────────────────── */}
            {tab === "years" && (
                <div className="ays-tab-content">
                    {/* Create form */}
                    <div className="ays-section-card">
                        <h3 className="ays-section-title">Create New Academic Year</h3>
                        <form onSubmit={handleCreateYear} className="ays-year-form">
                            <div className="ays-form-row">
                                <div className="ays-field">
                                    <label className="ayp-label">Year Label *</label>
                                    <input className="ayp-input" type="text" placeholder="e.g. 2026-27" maxLength={20}
                                        value={newYearLabel} onChange={(e) => setNewYearLabel(e.target.value)} />
                                </div>
                                <div className="ays-field">
                                    <label className="ayp-label">Start Date</label>
                                    <input className="ayp-input" type="date" value={newYearStart} onChange={(e) => setNewYearStart(e.target.value)} />
                                </div>
                                <div className="ays-field">
                                    <label className="ayp-label">End Date</label>
                                    <input className="ayp-input" type="date" value={newYearEnd} onChange={(e) => setNewYearEnd(e.target.value)} />
                                </div>
                            </div>
                            <label className="ays-checkbox-row">
                                <input type="checkbox" checked={makeCurrent} onChange={(e) => setMakeCurrent(e.target.checked)} />
                                <span>Set as current academic year</span>
                            </label>
                            <button type="submit" className="ayp-btn ayp-btn-primary" disabled={yearFormLoading}>
                                {yearFormLoading ? "Creating..." : "+ Create Academic Year"}
                            </button>
                        </form>
                    </div>

                    {/* Years list */}
                    <div className="ays-section-card">
                        <h3 className="ays-section-title">All Academic Years</h3>
                        {loading ? (
                            <div className="ayp-loading"><div className="ayp-spinner" /></div>
                        ) : (
                            <div className="ays-years-list">
                                {years.length === 0 && <p className="ayp-empty-state">No academic years yet. Create one above.</p>}
                                {years.map((year) => (
                                    <div key={year.id} className={`ays-year-row ${year.is_current ? "ays-year-current" : ""}`}>
                                        <div className="ays-year-info">
                                            <span className="ays-year-label">{year.label}</span>
                                            {year.is_current && <span className="ays-current-badge">Current</span>}
                                            <span className={`ays-status-badge ${year.status === "active" ? "ays-status-active" : "ays-status-closed"}`}>
                                                {year.status}
                                            </span>
                                        </div>
                                        <div className="ays-year-dates">
                                            {year.start_date && <span>{year.start_date} → {year.end_date || "..."}</span>}
                                        </div>
                                        <div className="ays-year-actions">
                                            {!year.is_current && (
                                                <button className="ayp-btn ayp-btn-ghost" style={{ fontSize: "0.8rem", padding: "0.4rem 0.7rem" }}
                                                    onClick={() => handleMakeCurrent(year.id)}>
                                                    Set as Current
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Tab 2: Promotion Rules ────────────────────────────────── */}
            {tab === "rules" && (
                <div className="ays-tab-content">
                    <div className="ays-section-card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                            <h3 className="ays-section-title" style={{ margin: 0 }}>Promotion Sequence Rules</h3>
                            <button className="ayp-btn ayp-btn-ghost" onClick={handleSuggestRules} disabled={loading}>
                                ✨ Auto-Suggest
                            </button>
                        </div>
                        <p className="ays-hint">Define the class sequence for your institute. When a promotion is executed, students are moved to the next class in this sequence.</p>

                        {/* Auto-suggestions */}
                        {suggestions.length > 0 && (
                            <div className="ays-suggestions-box">
                                <div className="ays-suggestions-header">
                                    <span>✨ Suggested sequence ({suggestions.length} rules)</span>
                                    <div style={{ display: "flex", gap: "0.5rem" }}>
                                        <button className="ayp-btn ayp-btn-primary" style={{ fontSize: "0.83rem" }} onClick={handleSaveSuggestedRules}>
                                            Save Suggestions
                                        </button>
                                        <button className="ayp-btn ayp-btn-ghost" style={{ fontSize: "0.83rem" }} onClick={() => setSuggestions([])}>
                                            Discard
                                        </button>
                                    </div>
                                </div>
                                {suggestions.map((s, i) => (
                                    <div key={i} className="ays-rule-row">
                                        <span className="ays-rule-order">{i + 1}</span>
                                        <span className="ays-rule-class">{s.fromClassName}</span>
                                        <span className="ays-rule-arrow">→</span>
                                        <span className="ays-rule-class">{s.toClassName || <em>Graduate / Complete</em>}</span>
                                        {s.isLast && <span className="ays-end-action-badge">{s.endAction || "graduate"}</span>}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Existing rules */}
                        <div className="ays-rules-list">
                            {loading && <div className="ayp-loading"><div className="ayp-spinner" /></div>}
                            {!loading && rules.length === 0 && (
                                <div className="ayp-empty-state">
                                    <p>No promotion rules configured. Click <strong>"Auto-Suggest"</strong> to generate a sequence from your existing classes.</p>
                                </div>
                            )}
                            {rules.map((rule, i) => (
                                <div key={rule.id} className="ays-rule-row">
                                    <span className="ays-rule-order">{i + 1}</span>
                                    <span className="ays-rule-class">{rule.fromClass?.name || "—"}</span>
                                    <span className="ays-rule-arrow">→</span>
                                    <span className="ays-rule-class">{rule.toClass?.name || <em style={{ color: "#94a3b8" }}>End of sequence</em>}</span>
                                    {!rule.to_class_id && <span className="ays-end-action-badge">{rule.end_action || "graduate"}</span>}
                                    <button className="ays-delete-btn" onClick={() => handleDeleteRule(rule.id)} title="Delete rule">✕</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Tab 3: Rollback ───────────────────────────────────────── */}
            {tab === "rollback" && (
                <div className="ays-tab-content">
                    <div className="ays-section-card">
                        <h3 className="ays-section-title">Rollback a Promotion</h3>
                        <div className="ays-rollback-warning">
                            <span>⚠️</span>
                            <div>
                                <strong>Danger Zone</strong> — This will reverse a promotion by reopening old enrollment records and closing new ones. The action is atomic and safe, but cannot be undone without re-running the promotion.
                            </div>
                        </div>

                        <form onSubmit={handleRollback} className="ays-rollback-form">
                            <div className="ays-form-row">
                                <div className="ays-field">
                                    <label className="ayp-label">Restore From Year (the old year to re-open)</label>
                                    <select className="ayp-select" style={{ width: "100%" }} value={rbFromYear} onChange={(e) => setRbFromYear(e.target.value)}>
                                        <option value="">Select year...</option>
                                        {years.map((y) => (
                                            <option key={y.id} value={y.id}>{y.label} {y.is_current ? "(current)" : ""}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="ays-field">
                                    <label className="ayp-label">Reverse From Year (the new year to close)</label>
                                    <select className="ayp-select" style={{ width: "100%" }} value={rbToYear} onChange={(e) => setRbToYear(e.target.value)}>
                                        <option value="">Select year...</option>
                                        {years.map((y) => (
                                            <option key={y.id} value={y.id}>{y.label} {y.is_current ? "(current)" : ""}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="ays-field" style={{ marginTop: "1rem" }}>
                                <label className="ayp-label">Type <strong>ROLLBACK</strong> to confirm</label>
                                <input className={`ayp-input ${rbConfirm === "ROLLBACK" ? "ayp-input-valid" : ""}`}
                                    type="text" placeholder="ROLLBACK" maxLength={10} style={{ maxWidth: "200px" }}
                                    value={rbConfirm} onChange={(e) => setRbConfirm(e.target.value.toUpperCase())} />
                            </div>
                            <button type="submit" className="ayp-btn ayp-btn-danger" disabled={rbLoading || rbConfirm !== "ROLLBACK" || !rbFromYear || !rbToYear}
                                style={{ marginTop: "1rem" }}>
                                {rbLoading ? "Rolling Back..." : "⏪ Execute Rollback"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Inline CSS for settings-specific styles */}
            <style>{`
                .ays-tabs {
                    display: flex;
                    gap: 0.25rem;
                    border-bottom: 2px solid var(--border-color, #e2e8f0);
                    margin-bottom: 1.5rem;
                }
                .ays-tab {
                    padding: 0.7rem 1.2rem;
                    background: none;
                    border: none;
                    border-bottom: 2px solid transparent;
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: #64748b;
                    cursor: pointer;
                    margin-bottom: -2px;
                    transition: all 0.15s ease;
                    border-radius: 4px 4px 0 0;
                }
                .ays-tab:hover { color: #6366f1; background: #f0f4ff; }
                .ays-tab-active { color: #6366f1; border-bottom-color: #6366f1; background: #f0f4ff; }
                .ays-tab-content { animation: fadeIn 0.2s ease; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
                .ays-section-card {
                    background: var(--card-bg, #fff);
                    border: 1px solid var(--border-color, #e2e8f0);
                    border-radius: 14px;
                    padding: 1.5rem;
                    margin-bottom: 1.25rem;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.05);
                }
                .ays-section-title { font-size: 1rem; font-weight: 700; color: #1e293b; margin: 0 0 1rem; }
                .ays-year-form { display: flex; flex-direction: column; gap: 1rem; }
                .ays-form-row { display: flex; gap: 1rem; flex-wrap: wrap; }
                .ays-field { display: flex; flex-direction: column; flex: 1; min-width: 160px; }
                .ayp-input { width: 100%; max-width: 100%; box-sizing: border-box; }
                .ays-checkbox-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer; }
                .ays-years-list { display: flex; flex-direction: column; gap: 0.75rem; }
                .ays-year-row {
                    display: flex; align-items: center; gap: 1rem; padding: 0.9rem 1.2rem;
                    border: 1px solid #e2e8f0; border-radius: 10px; flex-wrap: wrap;
                    transition: box-shadow 0.15s;
                }
                .ays-year-row:hover { box-shadow: 0 2px 8px rgba(99,102,241,0.08); }
                .ays-year-current { border-color: #a5b4fc; background: #f5f3ff; }
                .ays-year-info { display: flex; align-items: center; gap: 0.5rem; flex: 1; flex-wrap: wrap; }
                .ays-year-label { font-weight: 700; font-size: 1rem; color: #1e293b; }
                .ays-current-badge { padding: 0.15rem 0.5rem; background: #6366f1; color: #fff; border-radius: 12px; font-size: 0.72rem; font-weight: 700; }
                .ays-status-badge { padding: 0.15rem 0.5rem; border-radius: 12px; font-size: 0.72rem; font-weight: 600; }
                .ays-status-active { background: #dcfce7; color: #15803d; }
                .ays-status-closed { background: #f1f5f9; color: #64748b; }
                .ays-year-dates { font-size: 0.8rem; color: #94a3b8; }
                .ays-year-actions { margin-left: auto; }
                .ays-hint { font-size: 0.85rem; color: #64748b; margin: -0.5rem 0 1rem; }
                .ays-suggestions-box {
                    background: #f0f4ff; border: 1.5px solid #c7d2fe; border-radius: 10px;
                    padding: 1rem; margin-bottom: 1.25rem;
                }
                .ays-suggestions-header { display: flex; justify-content: space-between; align-items: center; font-weight: 600; color: #4f46e5; margin-bottom: 0.75rem; font-size: 0.88rem; flex-wrap: wrap; gap: 0.5rem; }
                .ays-rules-list { display: flex; flex-direction: column; gap: 0.5rem; }
                .ays-rule-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; flex-wrap: wrap; }
                .ays-rule-order { width: 24px; height: 24px; background: #6366f1; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; flex-shrink: 0; }
                .ays-rule-class { font-size: 0.9rem; font-weight: 600; color: #1e293b; }
                .ays-rule-arrow { color: #6366f1; font-size: 1rem; }
                .ays-end-action-badge { padding: 0.15rem 0.5rem; background: #ede9fe; color: #6d28d9; border-radius: 6px; font-size: 0.75rem; font-weight: 700; text-transform: capitalize; }
                .ays-delete-btn { margin-left: auto; background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.85rem; padding: 0.25rem 0.5rem; border-radius: 4px; transition: background 0.15s; }
                .ays-delete-btn:hover { background: #fee2e2; }
                .ays-rollback-warning {
                    display: flex; gap: 0.75rem; padding: 1rem 1.25rem; background: #fff7ed;
                    border: 1px solid #fed7aa; border-radius: 10px; color: #9a3412;
                    font-size: 0.88rem; margin-bottom: 1.5rem;
                }
                .ays-rollback-form { display: flex; flex-direction: column; gap: 0.75rem; }
            `}</style>
        </div>
    );
}
