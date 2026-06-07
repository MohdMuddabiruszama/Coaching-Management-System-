import React, { useState, useEffect, useContext, useRef } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import api from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import BackButton from "../../components/common/BackButton";
import "../admin/Dashboard.css";
import "../admin/Students.css";
import { savePdfNative } from "../../utils/capacitorPermissions";

function ScanAttendance() {
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [enrolledSubjects, setEnrolledSubjects] = useState([]);
    const [studentData, setStudentData] = useState(null);
    const [downloading, setDownloading] = useState(false);
    const qrCanvasRef = useRef(null);

    useEffect(() => {
        fetchStudentData();
    }, []);

    const fetchStudentData = async () => {
        try {
            // First fetch profile to get actual student ID and details
            const profileRes = await api.get("/students/me");
            const data = profileRes.data.data;
            setStudentData(data);

            // Check if student has subjects
            if (data && (data.Classes?.length > 0 || data.Subjects?.length > 0 || data.is_full_course)) {
                setEnrolledSubjects(data.Subjects?.length > 0 ? data.Subjects : data.Classes || []);
            }
        } catch (error) {
            console.error("Error fetching student profile:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadCard = async () => {
        setDownloading(true);
        try {
            // Find the QR canvas rendered in DOM
            const allCanvas = document.querySelectorAll('canvas');
            let qrDataUrl = null;
            for (let c of allCanvas) {
                if (c.width === 250 || c.width === 300) {
                    qrDataUrl = c.toDataURL('image/png');
                    break;
                }
            }

            const { jsPDF } = await import('jspdf');
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [85, 148] });

            const instName = user?.institute_name || 'Institute Name';
            const instPhone = user?.institute_phone || '';
            const studentName = studentData?.User?.name || user?.name || '';
            const studentEmail = studentData?.User?.email || user?.email || '';
            const gender = studentData?.gender || 'N/A';
            const rollNo = studentData?.roll_number || '';
            // Parent data
            const parentObj = studentData?.Parents?.[0];
            const parentName = parentObj?.name || 'N/A';
            const parentPhone = parentObj?.phone || parentObj?.User?.phone || '';
            const classText = studentData?.Classes?.map(c => `${c.name}${c.section ? ` - ${c.section}` : ''}`).join(', ') || 'N/A';
            const address = studentData?.address || 'N/A';

            // Fetch Institute Logo as Base64 for PDF format natively
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
                } catch (e) {
                    return null;
                }
            };

            let logoBase64 = null;
            if (user?.institute_logo || studentData?.institute_logo || studentData?.Institute?.logo) {
                let logoUrl = user?.institute_logo || studentData?.institute_logo || studentData?.Institute?.logo;
                if (logoUrl.startsWith('/')) {
                    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
                    logoUrl = `${apiUrl.replace(/\/api\/?$/, "")}${logoUrl}`;
                }
                logoBase64 = await getBase64ImageFromUrl(logoUrl);
            }

            // ── Background ──────────────────────────────────────────────────
            doc.setFillColor(245, 247, 255);
            doc.rect(0, 0, 85, 155, 'F');

            // Top header bar - Professional Dark Solid
            doc.setFillColor(30, 58, 138); // Blue-900 (Professional dark blue)
            doc.rect(0, 0, 85, 28, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');

            if (logoBase64) {
                // Draw logo cleanly on left
                doc.addImage(logoBase64, 'PNG', 5, 4, 20, 20);
                
                // Draw Institute Details aligned to the right of the logo
                doc.setFontSize(10);
                const instLines = doc.splitTextToSize(instName.toUpperCase(), 50);
                doc.text(instLines, 28, 14);
                
                if (instPhone) {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(7.5);
                    doc.setTextColor(219, 234, 254);
                    doc.text(`Ph: ${instPhone}`, 28, 20);
                }
            } else {
                // Center fallback if logo fails
                doc.setFontSize(11);
                const instLines = doc.splitTextToSize(instName.toUpperCase(), 72);
                const nameY = instPhone ? 12 : 16;
                doc.text(instLines, 42.5, nameY, { align: 'center' });
                if (instPhone) {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(7.5);
                    doc.setTextColor(219, 234, 254);
                    doc.text(`Ph: ${instPhone}`, 42.5, 18, { align: 'center' });
                }
            }

            // ── Divider below header ────────────────────────────────────────
            doc.setDrawColor(30, 58, 138);
            doc.setLineWidth(0.5);
            doc.line(6, 30, 79, 30);

            // ── Section labels ──────────────────────────────────────────────
            doc.setTextColor(100, 100, 120);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6);
            doc.text('QR CODE', 21, 35, { align: 'center' });
            doc.text('PHOTO', 64, 35, { align: 'center' });

            // ── QR Code image (left column) ─────────────────────────────────
            if (qrDataUrl) {
                doc.addImage(qrDataUrl, 'PNG', 5, 37, 33, 33);
            } else {
                doc.setFillColor(230, 230, 240);
                doc.rect(5, 37, 33, 33, 'F');
                doc.setTextColor(150, 150, 150);
                doc.setFontSize(6);
                doc.text('QR CODE', 21.5, 55, { align: 'center' });
            }

            // ── Photo placeholder box (right column) ────────────────────────
            doc.setFillColor(220, 224, 240);
            doc.rect(47, 37, 33, 33, 'F');
            doc.setDrawColor(180, 190, 220);
            doc.setLineWidth(0.3);
            doc.rect(47, 37, 33, 33);
            doc.setDrawColor(150, 160, 190);
            doc.setLineWidth(0.2);
            doc.circle(63.5, 47, 4, 'S');
            doc.line(55, 69, 55, 60);
            doc.line(55, 60, 72, 60);
            doc.line(72, 60, 72, 69);
            doc.setTextColor(140, 150, 185);
            doc.setFontSize(5);
            doc.text('PHOTO', 63.5, 72, { align: 'center' });

            // ── Horizontal divider ──────────────────────────────────────────
            doc.setDrawColor(200, 205, 225);
            doc.setLineWidth(0.3);
            doc.line(6, 74, 79, 74);

            // ── Student Name banner ──────────────────────────────────────────
            const infoStartY = 80;
            const lineH = 7;
            doc.setFillColor(102, 126, 234);
            doc.rect(5, infoStartY - 4, 75, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(studentName.toUpperCase(), 42.5, infoStartY, { align: 'center' });

            // ── Info rows (Roll, Parent, Email, ParentPhone, Class, Gender, Address) ─
            const rows = [
                { label: 'Roll No', value: rollNo || 'N/A' },
                { label: 'Parent', value: parentName },
                { label: 'Email', value: studentEmail },
                { label: 'Parent Ph', value: parentPhone || 'N/A' },
                { label: 'Class', value: classText },
                { label: 'Gender', value: gender },
                { label: 'Address', value: address },
            ];

            let y = infoStartY + lineH;
            rows.forEach((row, i) => {
                const bg = i % 2 === 0 ? [245, 247, 255] : [235, 238, 255];
                doc.setFillColor(...bg);
                doc.rect(5, y - 3.5, 75, 6.5, 'F');

                doc.setTextColor(102, 126, 234);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(6);
                doc.text(`${row.label}:`, 8, y + 0.5);

                doc.setTextColor(40, 40, 70);
                doc.setFont('helvetica', 'normal');
                const valLine = doc.splitTextToSize(String(row.value), 46);
                doc.text(valLine[0], 30, y + 0.5);

                y += lineH;
            });

            // ── Footer strip ────────────────────────────────────────────────
            doc.setFillColor(102, 126, 234);
            doc.rect(0, 149, 85, 6, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5.5);
            doc.text('Official Student Identity Card', 42.5, 152.5, { align: 'center' });

            // Works on ALL platforms: native Share sheet on Android, browser download on web
            await savePdfNative(doc, `ID_Card_${studentName.replace(/\s+/g, '_')}.pdf`);
        } catch (err) {
            console.error("Download error:", err);
            alert("Failed to download card: " + err.message);
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return <div className="dashboard-container">Loading...</div>;
    }

    // Unique Static QR code value based on Student ID.
    // Faculty will scan this QR code.
    const qrValue = studentData ? `STUDENT_QR_${studentData.id}` : "";

    return (
        <div className="dashboard-container">
            <div className="st-header">
                <div className="st-header-top-row">
                    <div className="st-header-left">
                        <h1>🤳 My Attendance QR Code</h1>
                        <p>Show this static QR code to your faculty to mark attendance.</p>
                    </div>
                </div>
                <div className="st-header-bottom-row">
                    <div className="st-breadcrumbs">
                        <span>Dashboard</span>
                        <span>›</span>
                        <span className="active">My QR Code</span>
                    </div>
                    <div className="st-header-actions">
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: "3rem", maxWidth: "540px", margin: "0 auto", textAlign: "center" }}>
                {enrolledSubjects.length === 0 ? (
                    <div style={{ backgroundColor: "#fef2f2", padding: "2rem", borderRadius: "12px", border: "1px solid #ef4444" }}>
                        <h2 style={{ color: "#991b1b", marginBottom: "1rem" }}>🚫 Not Enrolled</h2>
                        <p style={{ color: "#7f1d1d", fontSize: "1.1rem" }}>
                            You are not enrolled in any subjects. Your QR Code cannot be generated until you are assigned to a class/subject.
                        </p>
                    </div>
                ) : (
                    <div>
                        <h2 style={{ marginBottom: "1.5rem", color: "#1f2937" }}>Your Unique ID Code</h2>

                        {/* QR Code Display */}
                        <div style={{
                            background: "white",
                            padding: "1.5rem",
                            borderRadius: "16px",
                            display: "inline-block",
                            border: "2px solid #e5e7eb",
                            boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                            marginBottom: "1.5rem"
                        }}>
                            <QRCodeCanvas
                                ref={qrCanvasRef}
                                value={qrValue}
                                size={250}
                                level={"H"}
                                includeMargin={true}
                                style={{ display: 'block' }}
                            />
                        </div>

                        {/* Student name and info */}
                        <p style={{ marginTop: "0.5rem", color: "#4b5563", fontSize: "1.1rem", fontWeight: "bold" }}>
                            {studentData?.User?.name || user?.name}
                        </p>
                        {studentData?.Classes?.[0] && (
                            <p style={{ margin: "0.25rem 0 0", color: "#6b7280", fontSize: "0.9rem" }}>
                                {studentData.Classes.map(c => `${c.name}${c.section ? ` - ${c.section}` : ''}`).join(', ')}
                            </p>
                        )}
                        <p style={{ marginTop: "1rem", color: "#6b7280", fontSize: "0.9rem", lineHeight: "1.5" }}>
                            This QR code is unique to you and will not change. Show it to your faculty for attendance, or download your identity card.
                        </p>

                        {/* Download Button */}
                        <button
                            onClick={handleDownloadCard}
                            disabled={downloading}
                            style={{
                                marginTop: "1.5rem",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                padding: "0.75rem 2rem",
                                background: downloading
                                    ? "#a5b4fc"
                                    : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                color: "white",
                                border: "none",
                                borderRadius: "12px",
                                fontSize: "1rem",
                                fontWeight: "700",
                                cursor: downloading ? "not-allowed" : "pointer",
                                boxShadow: downloading ? "none" : "0 4px 15px rgba(102,126,234,0.4)",
                                transition: "all 0.2s ease",
                                letterSpacing: "0.02em"
                            }}
                        >
                            {downloading ? (
                                <>⏳ Generating PDF...</>
                            ) : (
                                <>⬇️ Download ID Card</>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ScanAttendance;
