import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import "../admin/Dashboard.css";

function ViewStudents() {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [classFilter, setClassFilter] = useState("");

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        try {
            const response = await api.get("/students");
            setStudents(response.data.data || []);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching students:", error);
            setLoading(false);
        }
    };

    const uniqueClasses = Array.from(new Set(
        students.flatMap(s => s.Classes?.map(c => `${c.name}${c.section ? ` - ${c.section}` : ""}`) || [])
    )).sort();

    const filteredStudents = students.filter((s) => {
        const matchesSearch =
            s.User?.name.toLowerCase().includes(search.toLowerCase()) ||
            s.User?.email.toLowerCase().includes(search.toLowerCase()) ||
            s.roll_number.toLowerCase().includes(search.toLowerCase());
            
        const classStrings = s.Classes?.map(c => `${c.name}${c.section ? ` - ${c.section}` : ""}`) || [];
        const matchesClass = classFilter === "" || classStrings.includes(classFilter);
        
        return matchesSearch && matchesClass;
    });

    if (loading) return <div className="dashboard-container">Loading students...</div>;

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1>👨‍🎓 View Students</h1>
                    <p>Overview of enrollments</p>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                    <Link to="/faculty/dashboard" className="btn btn-secondary">
                        ← Back
                    </Link>
                </div>
            </div>

            <div className="card" style={{ marginBottom: "2rem" }}>
                <div style={{ padding: "1.5rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Search by name, email, or roll number..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ flex: "1", minWidth: "250px" }}
                    />
                    <select
                        className="form-input"
                        value={classFilter}
                        onChange={(e) => setClassFilter(e.target.value)}
                        style={{ width: "220px" }}
                    >
                        <option value="">All Classes</option>
                        {uniqueClasses.map((cls, idx) => (
                            <option key={idx} value={cls}>{cls}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">All Students ({filteredStudents.length})</h3>
                </div>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Roll No</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Class</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: "center", padding: "2rem" }}>
                                        No students found
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map((student) => (
                                    <tr key={student.id}>
                                        <td>
                                            <span className="badge badge-secondary">{student.roll_number}</span>
                                        </td>
                                        <td>
                                            <strong>{student.User?.name}</strong>
                                            <br />
                                            <small style={{ color: "#6b7280" }}>{student.User?.phone}</small>
                                        </td>
                                        <td>{student.User?.email}</td>
                                        <td>
                                            {student.Classes && student.Classes.length > 0 ? (
                                                <>
                                                    {student.Classes.map(c => `${c.name}${c.section ? ` - ${c.section}` : ""}`).join(", ")}
                                                </>
                                            ) : (
                                                <span style={{ color: "#9ca3af" }}>Unassigned</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`badge badge-${student.User?.status === "active" ? "success" : "danger"}`}>
                                                {student.User?.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── MOBILE CARD LIST (shown on mobile via responsive.css) ── */}
                <div className="admin-mobile-cards card-stagger">
                    {filteredStudents.length === 0 ? (
                        <div className="empty-state-mobile">
                            <div className="empty-icon">👨‍🎓</div>
                            <div className="empty-title">No Students Found</div>
                            <div className="empty-desc">No students match your search or filter.</div>
                        </div>
                    ) : (
                        filteredStudents.map((student) => (
                            <div key={student.id} className="admin-item-card" style={{ borderLeftColor: '#4f46e5' }}>
                                <div className="aic-info">
                                    <div className="aic-name">
                                        {student.User?.name}
                                        <span className="aic-badge">
                                            <span className={`badge badge-${student.User?.status === 'active' ? 'success' : 'danger'}`}>
                                                {student.User?.status}
                                            </span>
                                        </span>
                                    </div>
                                    <div className="aic-sub">
                                        Roll: <strong>{student.roll_number}</strong> · {student.User?.email}
                                    </div>
                                    <div className="aic-sub">
                                        {student.Classes?.map(c => `${c.name}${c.section ? ` - ${c.section}` : ''}`).join(', ') || 'Unassigned'}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default ViewStudents;
