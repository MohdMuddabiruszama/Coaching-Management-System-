import { useState, useEffect, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import QRCode from "qrcode";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import "../admin/Dashboard.css";
function FacultyQRCode() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [facultyData, setFacultyData] = useState(null);
    useEffect(() => {
        fetchFacultyData();
    }, []);

    const fetchFacultyData = async () => {
        try {
            const profileRes = await api.get("/faculty/me");
            setFacultyData(profileRes.data.data);
        } catch (error) {
            console.error("Error fetching faculty profile:", error);
        } finally {
            setLoading(false);
        }
    };

    const getBase64ImageFromUrl = async (imageUrl) => {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
            });
        } catch (e) { return null; }
    };

    if (loading) return <div className="dashboard-container">Loading...</div>;

    const qrValue = facultyData ? `FACULTY_QR_${facultyData.id}` : "";

    return (
        <div className="dashboard-container">
            <div className="dashboard-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h1>🤳 My QR Code</h1>
                    <p>Show this static QR code to your Admin to mark attendance.</p>
                </div>

            </div>

            <div className="card" style={{ padding: "3rem", maxWidth: "540px", margin: "0 auto", textAlign: "center" }}>
                {!facultyData ? (
                    <div style={{ backgroundColor: "#fef2f2", padding: "2rem", borderRadius: "12px", border: "1px solid #ef4444" }}>
                        <h2 style={{ color: "#991b1b", marginBottom: "1rem" }}>🚫 Error</h2>
                        <p style={{ color: "#7f1d1d", fontSize: "1.1rem" }}>
                            Could not load your faculty data.
                        </p>
                    </div>
                ) : (
                    <div>
                        <h2 style={{ marginBottom: "1.5rem", color: "#1f2937" }}>Your Unique ID Code</h2>
                        <div style={{
                            background: "white",
                            padding: "1.5rem",
                            borderRadius: "16px",
                            display: "inline-block",
                            border: "2px solid #e5e7eb",
                            boxShadow: "0 10px 25px rgba(0,0,0,0.1)"
                        }}>
                            <QRCodeSVG
                                value={qrValue}
                                size={250}
                                level={"H"}
                                includeMargin={true}
                            />
                        </div>
                        <p style={{ marginTop: "1.5rem", color: "#4b5563", fontSize: "1.1rem", fontWeight: "bold" }}>
                            {facultyData?.User?.name || user?.name}
                        </p>
                        <p style={{ marginTop: "0.5rem", color: "#6b7280", fontSize: "0.95rem", marginBottom: "1.5rem" }}>
                            This QR code is unique to you and will not change. You can print it or show it directly from your device.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default FacultyQRCode;
