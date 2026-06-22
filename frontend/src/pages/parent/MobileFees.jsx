import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import * as parentService from "../../services/parent.service";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { useNavigate } from "react-router-dom";
import "./MobileFees.css";
import "./MobileDashboard.css"; // For student selector styling

export default function MobileFees() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    
    const [fees, setFees] = useState([]);

    useEffect(() => {
        fetchDashboard();
    }, []);

    const fetchDashboard = async () => {
        try {
            const data = await parentService.getParentDashboard();
            const loadedStudents = data?.data?.students || [];
            setStudents(loadedStudents);
            
            if (loadedStudents.length > 0) {
                const storedId = sessionStorage.getItem("parentSelectedStudentId");
                const studentToSelect = loadedStudents.find(s => s.id.toString() === storedId) || loadedStudents[0];
                await selectStudent(studentToSelect);
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error("Error fetching students:", error);
            setLoading(false);
        }
    };

    const selectStudent = async (student) => {
        if (!student) return;
        sessionStorage.setItem("parentSelectedStudentId", student.id.toString());
        setSelectedStudent(student);
        setDetailLoading(true);
        
        try {
            const feeData = await parentService.getLinkedStudentFees(student.id);
            setFees(feeData?.data || []);
        } catch (error) {
            console.error("Error fetching fee details", error);
        } finally {
            setLoading(false);
            setDetailLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="mp-fees-container" style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                <LoadingSpinner />
            </div>
        );
    }

    const safeFees = Array.isArray(fees) ? fees : [];
    const totalRequired = safeFees.reduce((sum, fee) => sum + parseFloat(fee.final_amount || 0), 0);
    const safeTotalPaid = safeFees.reduce((sum, fee) => sum + parseFloat(fee.paid_amount || 0), 0);
    const balanceDue = safeFees.reduce((sum, fee) => sum + parseFloat(fee.due_amount || 0), 0);

    return (
        <div className="mp-fees-container" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            {/* Header */}
            <div className="mp-fees-header">
                <div className="mp-fees-title-area">
                    <div className="mp-fees-title-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
                    </div>
                    <div className="mp-fees-title-text">
                        <h1>Pay Fees</h1>
                        <p>View fee structures and payments.</p>
                    </div>
                </div>
            </div>

            {/* Student Selector */}
            <div className="mpd-student-scroll" style={{ padding: '0 16px', marginBottom: '16px' }}>
                {students.map((student, idx) => {
                    const isSelected = selectedStudent?.id === student.id;
                    const initials = student.User?.name?.substring(0,2).toUpperCase() || 'ST';
                    return (
                        <div 
                            key={student.id} 
                            className={`mpd-student-card ${isSelected ? 'active' : ''} ${idx % 2 !== 0 && !isSelected ? 'white-bg' : ''}`}
                            onClick={() => selectStudent(student)}
                        >
                            <div className="mpd-student-avatar-circle" style={{ width: '36px', height: '36px', fontSize: '14px' }}>
                                {initials}
                            </div>
                            <div className="mpd-student-details">
                                <h3 style={{ fontSize: '14px' }}>{student.User?.name?.split(" ")[0]}</h3>
                                <p style={{ fontSize: '10px' }}>{student.Classes?.[0]?.name || 'Class'}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {detailLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><LoadingSpinner /></div>
            ) : (
                <div className="mp-fees-content">
                    
                    {/* Stats Grid */}
                    <div className="mp-fees-stats">
                        <div className="mp-fees-stat-card">
                            <div className="mp-fees-stat-icon total">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
                            </div>
                            <div className="mp-fees-stat-content">
                                <p>Total Fees Assigned</p>
                                <h3>${totalRequired.toFixed(2)}</h3>
                            </div>
                        </div>

                        <div className="mp-fees-stat-card">
                            <div className="mp-fees-stat-icon paid">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                            </div>
                            <div className="mp-fees-stat-content">
                                <p>Total Paid</p>
                                <h3 style={{ color: '#10b981' }}>${safeTotalPaid.toFixed(2)}</h3>
                            </div>
                        </div>

                        <div className="mp-fees-stat-card">
                            <div className={`mp-fees-stat-icon due ${balanceDue <= 0 ? 'zero' : ''}`}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                            </div>
                            <div className="mp-fees-stat-content">
                                <p>Balance Due</p>
                                <h3 style={{ color: balanceDue > 0 ? '#f59e0b' : '#10b981' }}>
                                    ${Math.max(0, balanceDue).toFixed(2)}
                                </h3>
                            </div>
                        </div>
                    </div>

                    {/* Pending Fee Structures */}
                    <div className="mp-fees-section-wrap">
                        <div className="mp-fees-section-header">
                            <h3 className="mp-fees-section-title">
                                <span style={{ color: '#6366f1', fontSize: '18px' }}>📄</span> Pending Fee Structures
                            </h3>
                        </div>
                        
                        <div className="mp-fees-list">
                            {safeFees.length === 0 ? (
                                <div className="mp-fees-empty">No fees assigned for this student yet.</div>
                            ) : (
                                safeFees.map((fee) => {
                                    const finalAmount = parseFloat(fee.final_amount) || 0;
                                    const paidAmount = parseFloat(fee.paid_amount) || 0;
                                    const balance = parseFloat(fee.due_amount) || 0;
                                    const isPaidOff = fee.status === 'paid' || balance <= 0;

                                    return (
                                        <div key={fee.id} className="mp-fees-card">
                                            <div className="mp-fees-mc-top">
                                                <div className="mp-fees-mc-title-box">
                                                    <h4>{fee.FeesStructure?.fee_type || 'General Fee'}</h4>
                                                    <p>{fee.FeesStructure?.Subject ? `Subject: ${fee.FeesStructure.Subject.name}` : "Full Course / General"}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="mp-fees-mc-middle">
                                                <div className="mp-fees-mc-due">
                                                    <span className="label">Due Date</span>
                                                    <span className="val">{fee.FeesStructure?.due_date ? new Date(fee.FeesStructure.due_date).toLocaleDateString('en-GB') : '-'}</span>
                                                    {balance > 0 && fee.FeesStructure?.due_date && (
                                                        <span className="overdue-text">
                                                            {Math.ceil((new Date(fee.FeesStructure.due_date) - new Date()) / (1000 * 60 * 60 * 24)) > 0 
                                                                ? `(Due in ${Math.ceil((new Date(fee.FeesStructure.due_date) - new Date()) / (1000 * 60 * 60 * 24))} days)` 
                                                                : '(Overdue)'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mp-fees-mc-amounts">
                                                    <div>Total: <strong>${finalAmount.toFixed(2)}</strong></div>
                                                    <div>Paid: <span>${paidAmount.toFixed(2)}</span></div>
                                                    <div>Due: <strong style={{ color: balance > 0 ? '#ef4444' : '#10b981' }}>${balance.toFixed(2)}</strong></div>
                                                </div>
                                            </div>
                                            
                                            <div className="mp-fees-mc-actions">
                                                <span className={`mp-badge ${isPaidOff ? 'paid' : paidAmount > 0 ? 'partial' : 'pending'}`}>
                                                    {isPaidOff ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Pending'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                    
                </div>
            )}
            <div style={{ height: "80px" }}></div>
        </div>
    );
}
