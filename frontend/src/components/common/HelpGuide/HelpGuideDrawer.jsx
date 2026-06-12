import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiX, FiCheckCircle, FiChevronRight, FiHelpCircle } from 'react-icons/fi';
import './HelpGuideDrawer.css';

const HelpGuideDrawer = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const [activeStep, setActiveStep] = useState(0);

    // Prevent body scroll when drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isOpen]);

    const steps = [
        {
            id: 1,
            title: "Create Faculty",
            icon: "👩‍🏫",
            description: "Add and manage your teaching staff. Assign them to specific roles and departments to structure your academic team.",
            actionText: "Manage Faculty",
            path: "/admin/faculty",
            color: "#8b5cf6" // Purple
        },
        {
            id: 2,
            title: "Create Classes",
            icon: "📚",
            description: "Define the standard classes or grades offered in your institute (e.g., Class 10, Grade 12 Science).",
            actionText: "Manage Classes",
            path: "/admin/classes",
            color: "#3b82f6" // Blue
        },
        {
            id: 3,
            title: "Create Subjects",
            icon: "📖",
            description: "Add academic subjects and map them to their respective classes to build your curriculum structure.",
            actionText: "Manage Subjects",
            path: "/admin/subjects",
            color: "#ec4899" // Pink
        },
        {
            id: 4,
            title: "Create Fees Structure",
            icon: "💰",
            description: "Configure transparent fee plans including tuition, transport, or library fees before enrolling students.",
            actionText: "Manage Fees",
            path: "/admin/fees",
            color: "#f59e0b" // Amber
        },
        {
            id: 5,
            title: "Create Student",
            icon: "👨‍🎓",
            description: "Enroll students, assign them to classes, apply their fee structures, and manage their academic journey.",
            actionText: "Manage Students",
            path: "/admin/students",
            color: "#10b981" // Emerald
        },
        {
            id: 6,
            title: "Create Parents",
            icon: "👨‍👩‍👧",
            description: "Link parent or guardian accounts to students for seamless communication and progress tracking.",
            actionText: "Manage Parents",
            path: "/admin/parents",
            color: "#f43f5e" // Rose
        },
        {
            id: 7,
            title: "Create Timetable",
            icon: "📅",
            description: "Schedule batches, allocate subjects to faculty, and generate daily timetables for your classes.",
            actionText: "Manage Timetable",
            path: "/admin/timetable",
            color: "#6366f1" // Indigo
        },
        {
            id: 8,
            title: "Create Faculty Salary",
            icon: "💼",
            description: "Set up payroll, manage allowances, and automate salary processing for your teaching staff.",
            actionText: "Manage Salary",
            path: "/admin/salary",
            color: "#14b8a6" // Teal
        },
        {
            id: 9,
            title: "Create Expenses",
            icon: "💸",
            description: "Record and track day-to-day operational expenses to maintain an accurate financial overview.",
            actionText: "Manage Expenses",
            path: "/admin/expenses",
            color: "#ef4444" // Red
        },
        {
            id: 10,
            title: "Create Public Web Page",
            icon: "🌐",
            description: "Set up and customize your institute's public-facing website to attract inquiries and showcase your offerings.",
            actionText: "Manage Public Page",
            path: "/admin/public-page",
            color: "#0ea5e9" // Sky Blue
        }
    ];

    const handleNavigate = (path) => {
        onClose();
        navigate(path);
    };

    return (
        <>
            {/* Backdrop overlay */}
            <div 
                className={`hgd-overlay ${isOpen ? 'open' : ''}`} 
                onClick={onClose}
                aria-hidden="true"
            />
            
            {/* Drawer */}
            <div className={`hgd-drawer ${isOpen ? 'open' : ''}`}>
                <div className="hgd-header">
                    <div className="hgd-header-title-container">
                        <div className="hgd-header-icon-wrapper">
                            <FiHelpCircle className="hgd-header-icon" />
                        </div>
                        <div>
                            <h2 className="hgd-title">Institute Setup Guide</h2>
                            <p className="hgd-subtitle">Follow these steps to complete your setup</p>
                        </div>
                    </div>
                    <button className="hgd-close-btn" onClick={onClose} aria-label="Close Help Guide">
                        <FiX />
                    </button>
                </div>

                <div className="hgd-content">
                    <div className="hgd-timeline">
                        {steps.map((step, index) => (
                            <div 
                                key={step.id} 
                                className={`hgd-step ${activeStep === index ? 'active' : ''}`}
                                onClick={() => setActiveStep(index)}
                                style={{ "--step-color": step.color }}
                            >
                                <div className="hgd-step-connector">
                                    <div className="hgd-step-marker">
                                        {index + 1}
                                    </div>
                                    {index < steps.length - 1 && <div className="hgd-step-line"></div>}
                                </div>
                                <div className="hgd-step-body">
                                    <div className="hgd-step-header">
                                        <h3 className="hgd-step-title">
                                            <span className="hgd-step-emoji">{step.icon}</span> 
                                            {step.title}
                                        </h3>
                                        <button 
                                            className="hgd-step-action"
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                handleNavigate(step.path); 
                                            }}
                                        >
                                            {step.actionText} <FiChevronRight />
                                        </button>
                                    </div>
                                    <p className="hgd-step-desc">{step.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="hgd-footer">
                    <div className="hgd-progress">
                        <div className="hgd-progress-text">
                            <span>Setup Completion</span>
                            <span>{Math.round(((activeStep + 1) / steps.length) * 100)}%</span>
                        </div>
                        <div className="hgd-progress-bar-bg">
                            <div 
                                className="hgd-progress-bar-fill" 
                                style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                    <button className="hgd-done-btn" onClick={onClose}>
                        <FiCheckCircle style={{ marginRight: '8px' }} />
                        I've got it, close guide
                    </button>
                </div>
            </div>
        </>
    );
};

export default HelpGuideDrawer;
