import { useState, useEffect } from "react";
import api from "../../services/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { resolveFileUrl } from "../../utils/resolveUrl";
import { toast } from "react-hot-toast";
import { downloadRemoteFile } from "../../utils/capacitorPermissions";

function StudentNotes() {
    const [notes, setNotes] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        try {
            setLoading(true);
            setError(null);

            // Clear unread notes count on the backend so the dashboard badge disappears
            api.post('/students/clear-unread-notes').catch(() => {});

            // Step 1: Get my student record — includes Subjects[] via StudentSubject junction
            const meRes = await api.get("/students/me");
            if (!meRes.data.success) {
                setError("Could not load student record.");
                return;
            }

            const studentRecord = meRes.data.data;
            // Subjects are returned as an array via belongsToMany association
            const mySubjects = studentRecord.Subjects || [];
            // Classes are returned as an array too (via StudentClass)
            const myClasses = studentRecord.Classes || [];

            setSubjects(mySubjects);

            if (mySubjects.length === 0 && myClasses.length === 0) {
                // No subjects or classes enrolled — show empty state
                setNotes([]);
                setLoading(false);
                return;
            }

            // Step 2: Fetch notes
            let allNotes = [];

            if (mySubjects.length > 0) {
                // Fetch notes for each enrolled subject
                for (const sub of mySubjects) {
                    try {
                        const nRes = await api.get(`/notes/subject/${sub.id}`);
                        if (nRes.data.success && nRes.data.data) {
                            const withLabel = nRes.data.data.map(n => ({
                                ...n,
                                subjectName: sub.name
                            }));
                            allNotes = [...allNotes, ...withLabel];
                        }
                    } catch (_) { }
                }
            } else if (myClasses.length > 0) {
                // Fallback: fetch notes by class
                for (const cls of myClasses) {
                    try {
                        const nRes = await api.get(`/notes/class/${cls.id}`);
                        if (nRes.data.success && nRes.data.data) {
                            allNotes = [...allNotes, ...nRes.data.data];
                        }
                    } catch (_) { }
                }
            }

            // Deduplicate
            const unique = Array.from(new Map(allNotes.map(n => [n.id, n])).values());
            setNotes(unique);
        } catch (err) {
            console.error("StudentNotes loadAll error:", err);
            setError(err.response?.data?.message || "Failed to load study materials");
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (note) => {
        try {
            await api.post(`/notes/download/${note.id}`);
        } catch (_) { }

        // Determine a clean filename from the URL or note title
        const fileUrl = resolveFileUrl(note.file_url);
        const urlParts = note.file_url?.split('/') || [];
        const rawFileName = urlParts[urlParts.length - 1] || `${note.title}.pdf`;
        const safeFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');

        toast.loading("Downloading...", { id: "dl" });
        await downloadRemoteFile(fileUrl, safeFileName);
        toast.dismiss("dl");
    };

    if (loading) return <div style={{ padding: 40 }}><LoadingSpinner /></div>;

    if (error) return (
        <div className="dashboard-container">
            <div className="card" style={{ textAlign: "center", padding: "3rem", color: "#ef4444" }}>
                <div style={{ fontSize: "2rem" }}>⚠️</div>
                <p>{error}</p>
                <button className="btn btn-primary" onClick={loadAll} style={{ marginTop: 12 }}>Retry</button>
            </div>
        </div>
    );

    const filteredNotes = selectedSubject
        ? notes.filter(n => String(n.subject_id) === String(selectedSubject))
        : notes;

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div>
                    <h1>📚 Study Materials</h1>
                    <p>Access notes and study materials shared by your faculty.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {subjects.length > 0 && (
                        <select
                            className="form-input"
                            value={selectedSubject}
                            onChange={e => setSelectedSubject(e.target.value)}
                            style={{ minWidth: 180 }}
                        >
                            <option value="">All Subjects</option>
                            {subjects.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    )}
                    <button className="btn btn-secondary" onClick={() => window.location.href = "/student/dashboard"}>
                        ← Back to Dashboard
                    </button>
                </div>
            </div>

            {/* Stats row */}
            {notes.length > 0 && (
                <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: "1.5rem" }}>
                    <div className="stat-card">
                        <div className="stat-icon">📄</div>
                        <div className="stat-content"><h3>{notes.length}</h3><p>Total Materials</p></div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">📚</div>
                        <div className="stat-content"><h3>{subjects.length}</h3><p>Enrolled Subjects</p></div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">🆕</div>
                        <div className="stat-content">
                            <h3>{notes.filter(n => {
                                const d = new Date(n.created_at);
                                return (new Date() - d) < 7 * 24 * 60 * 60 * 1000;
                            }).length}</h3>
                            <p>Added This Week</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="card">
                {filteredNotes.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
                        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📄</div>
                        {subjects.length === 0 ? (
                            <div>
                                <p><strong>No subjects enrolled.</strong></p>
                                <p style={{ marginTop: 8, fontSize: "0.9rem" }}>
                                    Contact your institute admin to enroll you in subjects.
                                </p>
                            </div>
                        ) : (
                            <p>No study materials uploaded yet for your subjects. Check back later!</p>
                        )}
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table mobile-keep">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Subject</th>
                                    <th>Date Uploaded</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredNotes.map(note => (
                                    <tr key={note.id}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{note.title}</div>
                                            {note.description && (
                                                <small style={{ color: "var(--text-secondary)" }}>{note.description}</small>
                                            )}
                                        </td>
                                        <td>
                                            <span className="badge badge-info">
                                                {note.subjectName || note.Subject?.name || "—"}
                                            </span>
                                        </td>
                                        <td>{new Date(note.created_at).toLocaleDateString("en-IN", {
                                            day: "2-digit", month: "short", year: "numeric"
                                        })}</td>
                                        <td>
                                            <button
                                                className="btn btn-primary"
                                                style={{ padding: "5px 16px", fontSize: "0.82rem" }}
                                                onClick={() => handleDownload(note)}
                                            >
                                                ⬇️ Download
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default StudentNotes;
