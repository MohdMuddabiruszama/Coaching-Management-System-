/**
 * My Salary Slips — Faculty Page
 * Phase 10 — Faculty Salary.md
 *
 * Faculty can view their own paid salary slips and download PDF.
 */

import { useState, useEffect, useContext } from "react";
import { Link }        from "react-router-dom";
import salaryService   from "../../services/salary.service";
import { AuthContext } from "../../context/AuthContext";
import "./FacultyDashboard.css";

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
    `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

// ── Spinner ───────────────────────────────────────────────────────────────────
const Spinner = () => (
    <div style={{ textAlign:"center", padding:"3rem", color:"#6b7280" }}>
        <div style={{ width:40, height:40, border:"4px solid #e5e7eb", borderTopColor:"#7e22ce", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 1rem" }} />
        Loading salary slips...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
export default function MySalarySlipsPage() {
    const { user }        = useContext(AuthContext);
    const [slips, setSlips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(null); // id being downloaded
    const [toast, setToast] = useState("");

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

    useEffect(() => {
        salaryService.getMySlips()
            .then(res => setSlips(res.data || []))
            .catch(err => console.error("getMySlips error:", err))
            .finally(() => setLoading(false));
    }, []);

    const handleDownload = async (slip) => {
        setDownloading(slip.id);
        try {
            await salaryService.downloadSlip(slip.id, `salary_slip_${slip.month_year}.pdf`);
            showToast("📄 Salary slip downloaded!");
        } catch (err) {
            alert("Failed to download salary slip. Please try again.");
        } finally {
            setDownloading(null);
        }
    };

    // Stats
    const totalEarned = slips.reduce((s, r) => s + parseFloat(r.net_salary || 0), 0);
    const latestSlip  = slips[0];

    return (
        <div style={{ minHeight:"100vh", background:"#f8fafc", padding:"2rem 1.5rem" }}>
            {/* Toast */}
            {toast && (
                <div style={{ position:"fixed", top:20, right:20, background:"#10b981", color:"#fff", padding:"0.85rem 1.5rem", borderRadius:12, fontWeight:700, zIndex:9999, boxShadow:"0 4px 20px rgba(0,0,0,0.15)" }}>
                    {toast}
                </div>
            )}

            <div style={{ maxWidth:900, margin:"0 auto" }}>
                {/* Header */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"2rem", flexWrap:"wrap", gap:"1rem" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"1rem" }}>
                        <div style={{ width:52, height:52, borderRadius:14, background:"linear-gradient(135deg,#7e22ce,#4f46e5)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.5rem" }}>💼</div>
                        <div>
                            <h1 style={{ margin:0, fontSize:"1.6rem", color:"#111827", fontWeight:800 }}>My Salary Slips</h1>
                            <p style={{ margin:0, color:"#6b7280", fontSize:"0.9rem" }}>All your paid salary slips • Download PDF anytime</p>
                        </div>
                    </div>
                    <Link to="/faculty/dashboard" style={{ padding:"0.6rem 1.25rem", borderRadius:8, border:"1px solid #e5e7eb", background:"#fff", color:"#374151", fontWeight:600, fontSize:"0.9rem", textDecoration:"none", display:"flex", alignItems:"center", gap:"0.4rem" }}>
                        ← Back to Dashboard
                    </Link>
                </div>

                {/* Summary cards */}
                {!loading && slips.length > 0 && (
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:"1rem", marginBottom:"2rem" }}>
                        {[
                            { icon:"📄", label:"Total Slips",      val: slips.length.toString(),  bg:"#f3e8ff", color:"#7e22ce" },
                            { icon:"💰", label:"Total Earned",     val: fmt(totalEarned),           bg:"#d1fae5", color:"#059669" },
                            { icon:"📅", label:"Latest Month",     val: latestSlip?.month_year || "—", bg:"#dbeafe", color:"#2563eb" },
                            { icon:"💸", label:"Latest Net Salary", val: fmt(latestSlip?.net_salary || 0), bg:"#ede9fe", color:"#6d28d9" },
                        ].map((card, i) => (
                            <div key={i} style={{ background:"#fff", borderRadius:12, padding:"1.25rem", border:"1px solid #e5e7eb", display:"flex", alignItems:"center", gap:"0.75rem", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
                                <div style={{ width:44, height:44, borderRadius:10, background:card.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.3rem", flexShrink:0 }}>{card.icon}</div>
                                <div>
                                    <div style={{ fontSize:"1.1rem", fontWeight:800, color:card.color }}>{card.val}</div>
                                    <div style={{ fontSize:"0.78rem", color:"#6b7280", fontWeight:600 }}>{card.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Slips list */}
                <div style={{ background:"#fff", borderRadius:12, border:"1px solid #e5e7eb", overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
                    <div style={{ padding:"1.25rem 1.5rem", borderBottom:"1px solid #e5e7eb", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div style={{ fontWeight:700, color:"#111827", fontSize:"1rem" }}>💼 Paid Salary Slips</div>
                        <div style={{ fontSize:"0.85rem", color:"#6b7280" }}>{slips.length} records</div>
                    </div>

                    {loading ? <Spinner /> : slips.length === 0 ? (
                        <div style={{ textAlign:"center", padding:"4rem 2rem" }}>
                            <div style={{ fontSize:"3rem", marginBottom:"0.75rem" }}>💼</div>
                            <h3 style={{ color:"#374151" }}>No salary slips yet</h3>
                            <p style={{ color:"#9ca3af" }}>Your paid salary records will appear here. Contact your admin if you believe this is incorrect.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX:"auto" }}>
                            <table style={{ width:"100%", borderCollapse:"collapse" }}>
                                <thead style={{ background:"#f9fafb", color:"#6b7280", fontSize:"0.73rem", fontWeight:700, textTransform:"uppercase" }}>
                                    <tr>
                                        <th style={{ padding:"0.85rem 1.25rem", textAlign:"left" }}>Month</th>
                                        <th style={{ padding:"0.85rem 1.25rem", textAlign:"left" }}>Basic Salary</th>
                                        <th style={{ padding:"0.85rem 1.25rem", textAlign:"left" }}>Allowances</th>
                                        <th style={{ padding:"0.85rem 1.25rem", textAlign:"left" }}>Deductions</th>
                                        <th style={{ padding:"0.85rem 1.25rem", textAlign:"left" }}>Net Salary</th>
                                        <th style={{ padding:"0.85rem 1.25rem", textAlign:"left" }}>Attendance</th>
                                        <th style={{ padding:"0.85rem 1.25rem", textAlign:"left" }}>Paid On</th>
                                        <th style={{ padding:"0.85rem 1.25rem", textAlign:"center" }}>Download</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {slips.map(slip => (
                                        <tr key={slip.id} style={{ borderBottom:"1px solid #f3f4f6" }}
                                            onMouseOver={e => e.currentTarget.style.background="#f9fafb"}
                                            onMouseOut={e => e.currentTarget.style.background="transparent"}>
                                            <td style={{ padding:"1rem 1.25rem" }}>
                                                <div style={{ fontWeight:700, color:"#111827" }}>
                                                    {new Date(slip.month_year + "-01").toLocaleString("default", { month:"long", year:"numeric" })}
                                                </div>
                                                {slip.auto_generated && (
                                                    <span style={{ fontSize:"0.7rem", color:"#6366f1", background:"#eef2ff", padding:"0.1rem 0.4rem", borderRadius:4 }}>🤖 Auto</span>
                                                )}
                                            </td>
                                            <td style={{ padding:"1rem 1.25rem", color:"#111827", fontWeight:600 }}>{fmt(slip.basic_salary)}</td>
                                            <td style={{ padding:"1rem 1.25rem", color:"#059669", fontWeight:600 }}>+{fmt(slip.allowances)}</td>
                                            <td style={{ padding:"1rem 1.25rem", color:"#ef4444", fontWeight:600 }}>
                                                -{fmt(parseFloat(slip.deductions || 0) + parseFloat(slip.advance_paid || 0))}
                                            </td>
                                            <td style={{ padding:"1rem 1.25rem", color:"#7e22ce", fontWeight:800, fontSize:"1rem" }}>{fmt(slip.net_salary)}</td>
                                            <td style={{ padding:"1rem 1.25rem" }}>
                                                <span style={{ background:"#eff6ff", color:"#3b82f6", padding:"0.25rem 0.6rem", borderRadius:20, fontSize:"0.78rem", fontWeight:600 }}>
                                                    {slip.present_days}/{slip.working_days}d
                                                </span>
                                                <div style={{ color:"#9ca3af", fontSize:"0.7rem", marginTop:2 }}>
                                                    {((slip.present_days / (slip.working_days || 1)) * 100).toFixed(0)}% attendance
                                                </div>
                                            </td>
                                            <td style={{ padding:"1rem 1.25rem", fontSize:"0.85rem" }}>
                                                {slip.payment_date ? (
                                                    <>
                                                        <div style={{ fontWeight:600, color:"#111827" }}>{new Date(slip.payment_date).toLocaleDateString("en-IN")}</div>
                                                        <div style={{ color:"#6b7280", textTransform:"capitalize", fontSize:"0.8rem" }}>{slip.payment_method?.replace(/_/g," ")}</div>
                                                    </>
                                                ) : <span style={{ color:"#9ca3af" }}>—</span>}
                                            </td>
                                            <td style={{ padding:"1rem 1.25rem", textAlign:"center" }}>
                                                <button
                                                    onClick={() => handleDownload(slip)}
                                                    disabled={downloading === slip.id}
                                                    style={{
                                                        padding:"0.45rem 1rem", borderRadius:8, border:"none",
                                                        background: downloading === slip.id ? "#e5e7eb" : "linear-gradient(135deg,#4f46e5,#7e22ce)",
                                                        color: downloading === slip.id ? "#9ca3af" : "#fff",
                                                        cursor: downloading === slip.id ? "not-allowed" : "pointer",
                                                        fontWeight:600, fontSize:"0.85rem",
                                                        display:"flex", alignItems:"center", gap:"0.35rem", margin:"0 auto",
                                                        transition:"all 0.2s",
                                                    }}
                                                >
                                                    {downloading === slip.id ? "⏳" : "📄"} {downloading === slip.id ? "Downloading..." : "PDF Slip"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Info box */}
                {!loading && slips.length > 0 && (
                    <div style={{ marginTop:"1.5rem", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:10, padding:"1rem 1.5rem", display:"flex", gap:"0.75rem", alignItems:"center" }}>
                        <span style={{ color:"#3b82f6", fontSize:"1.2rem", flexShrink:0 }}>ℹ️</span>
                        <div style={{ color:"#1e40af", fontSize:"0.875rem" }}>
                            Your salary slips show only <strong>paid</strong> salaries. For pending salaries, contact your institute admin.
                            PDF slips are generated on-demand and contain complete salary breakdown, attendance summary, and payment details.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
