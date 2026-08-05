/**
 * ManagerPendingFees.jsx
 * Lightweight read-only fee search for manager mobile.
 * NO fee collection, NO editing — web-only operations.
 * 1 API call per search using ?query= sparse response.
 */
import { useState, useCallback, useEffect } from "react";
import api from "../../services/api";
import "./ManagerPendingFees.css";

function ManagerPendingFees() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searched, setSearched] = useState(false);

    const handleSearch = useCallback(async () => {
        const q = query.trim();
        setLoading(true);
        setSearched(false);
        try {
            // GET /api/fees/student-fees?search=query&status=pending — existing endpoint
            const res = await api.get("/fees/student-fees", {
                params: { search: q, status: "pending", limit: 30 }
            });
            let data = res.data.data || res.data || [];
            data = data.filter(sf => sf.status === 'pending' || sf.status === 'partial');
            if (q) {
                const lowerQ = q.toLowerCase();
                data = data.filter(sf => 
                    sf.Student?.User?.name?.toLowerCase().includes(lowerQ) ||
                    sf.Student?.roll_number?.toLowerCase().includes(lowerQ)
                );
            }
            setResults(data);
        } catch (e) {
            console.error("Fee search error:", e);
            setResults([]);
        } finally {
            setLoading(false);
            setSearched(true);
        }
    }, [query]);

    useEffect(() => {
        handleSearch();
    }, []); // Fetch initially on mount

    const handleKeyDown = (e) => {
        if (e.key === "Enter") handleSearch();
    };

    const totalDue = results.reduce((sum, s) => sum + (parseFloat(s.due_amount) || 0), 0);

    return (
        <div className="mpf-page">
            <div className="mpf-header">
                <h2 className="mpf-title">💰 Pending Fees</h2>
                <p className="mpf-subtitle">Quick search — read only. Use desktop to collect fees.</p>
            </div>

            {/* Search Bar */}
            <div className="mpf-search-bar">
                <input
                    type="text"
                    className="mpf-search-input"
                    placeholder="Student name or roll number..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <button
                    className="mpf-search-btn"
                    onClick={handleSearch}
                    disabled={loading}
                    aria-label="Search"
                >
                    🔍
                </button>
            </div>

            {/* Summary */}
            {results.length > 0 && (
                <div className="mpf-summary-banner">
                    <span className="mpf-summary-icon">⚠️</span>
                    <div>
                        <p className="mpf-summary-val">
                            ₹{totalDue.toLocaleString("en-IN")}
                        </p>
                        <p className="mpf-summary-label">{results.length} student(s) with pending fees</p>
                    </div>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="mpf-loading">
                    <div className="mpf-spinner" />
                    Searching...
                </div>
            )}

            {/* Results */}
            {!loading && results.length > 0 && (
                <>
                    <div className="mpf-student-list">
                        {results.map((s, i) => (
                            <div key={i} className="mpf-student-card">
                                <div className="mpf-card-top">
                                    <p className="mpf-card-name">{s.Student?.User?.name || "Unknown Student"}</p>
                                    <span className="mpf-due-badge">
                                        ₹{parseFloat(s.due_amount || 0).toLocaleString("en-IN")}
                                    </span>
                                </div>
                                <p className="mpf-card-meta">
                                    Roll: {s.Student?.roll_number || "N/A"} · Class: {s.Class ? `${s.Class.name} ${s.Class.section || ''}`.trim() : "N/A"}
                                    {s.FeesStructure?.due_date ? ` · Due: ${new Date(s.FeesStructure.due_date).toLocaleDateString("en-IN")}` : ""}
                                </p>
                                {s.parent_phone && (
                                    <div className="mpf-card-actions">
                                        <a
                                            href={`tel:${s.parent_phone}`}
                                            className="mpf-call-btn"
                                        >
                                            📞 Call Parent
                                        </a>
                                        <a
                                            href={`https://wa.me/91${s.parent_phone}?text=${encodeURIComponent(`Dear Parent, your ward ${s.Student?.User?.name || 'the student'} has a pending fee of ₹${s.due_amount}. Please clear it at the earliest. Thank you.`)}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mpf-whatsapp-btn"
                                        >
                                            💬 WhatsApp
                                        </a>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="mpf-web-only-note">
                        🖥️ To collect fees or generate receipts, please use the desktop web application.
                    </div>
                </>
            )}

            {/* Empty State */}
            {!loading && searched && results.length === 0 && (
                <div className="mpf-empty">
                    <span className="mpf-empty-icon">✅</span>
                    No pending fees found for "{query}"
                </div>
            )}
        </div>
    );
}

export default ManagerPendingFees;
