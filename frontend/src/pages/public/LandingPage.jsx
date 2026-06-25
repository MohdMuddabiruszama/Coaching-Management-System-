/**
 * Landing Page - Professional Conversion Optimized
 * Main entry point for public visitors
 */

import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import "./PublicPages.css";
import api from "../../services/api";
import zfLogo from "../../assets/zf-logo.png";

function LandingPage() {
    const [stats, setStats] = useState({
        institutes: "50+",
        students: "5000+",
        satisfaction: "98%"
    });

    useEffect(() => {
        // Track page view for Analytics
        api.post('/leads/page-view', { url: window.location.pathname })
            .catch(err => console.error("Tracking error:", err));
    }, []);

    return (
        <div className="landing-page">
            {/* Navigation */}
            <nav className="public-nav">
                <div className="container">
                    <div className="nav-content">
                        <Link to="/" className="logo">
                            <img src={zfLogo} alt="ZenithFlows" style={{ height: '60px', width: '60px', objectFit: 'contain', verticalAlign: 'middle' }} /> ZenithFlows
                        </Link>
                        <div className="nav-links">
                            <Link to="/features">Features</Link>
                            <Link to="/pricing">Pricing</Link>
                            <Link to="/about">About</Link>
                            <Link to="/contact">Contact</Link>
                            <Link to="/login" className="btn-secondary">Login</Link>
                            <Link to="/register?plan=free_trial" className="btn-primary">Start Free Trial</Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="hero-section">
                <div className="container">
                    <div className="hero-content">
                        <h1 className="hero-title">
                            Transform Your Coaching Center with <span className="gradient-text">Smart Management</span>
                        </h1>
                        <p className="hero-subtitle">
                            Streamline student management, attendance tracking, and fee collection all in one powerful platform.
                            Join 50+ coaching centers already growing with ZenithFlows.
                        </p>
                        <div className="hero-cta">
                            <Link to="/register?plan=free_trial" className="btn-primary-large">
                                🚀 Start Free Trial
                            </Link>
                            <Link to="/pricing" className="btn-secondary-large">
                                💰 View Plans
                            </Link>
                        </div>
                        <div className="hero-stats">
                            <div className="stat-item">
                                <strong>{stats.institutes}</strong>
                                <span>Institutes</span>
                            </div>
                            <div className="stat-item">
                                <strong>{stats.students}</strong>
                                <span>Students Managed</span>
                            </div>
                            <div className="stat-item">
                                <strong>{stats.satisfaction}</strong>
                                <span>Satisfaction Rate</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Problem Section */}
            <section className="problem-section">
                <div className="container">
                    <h2 className="section-title">Are You Still Struggling With...</h2>
                    <div className="problems-grid">
                        <div className="problem-card">
                            <div className="problem-icon">📋</div>
                            <h3>Manual Attendance?</h3>
                            <p>Wasting hours marking attendance on paper registers and maintaining records?</p>
                        </div>
                        <div className="problem-card">
                            <div className="problem-icon">💸</div>
                            <h3>Fee Tracking in Excel?</h3>
                            <p>Losing track of payments, missing follow-ups, and manual receipt generation?</p>
                        </div>
                        <div className="problem-card">
                            <div className="problem-icon">📊</div>
                            <h3>No Clear Reports?</h3>
                            <p>Unable to get instant insights on student performance and revenue?</p>
                        </div>
                        <div className="problem-card">
                            <div className="problem-icon">🔒</div>
                            <h3>Data Security Concerns?</h3>
                            <p>Worried about losing important student data stored in files?</p>
                        </div>
                    </div>
                    <div className="problem-cta">
                        <p className="problem-solution">We solve all of this. <strong>Automatically.</strong></p>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="features-section">
                <div className="container">
                    <h2 className="section-title">Everything You Need to Run Your Institute</h2>
                    <p className="section-subtitle">Powerful features designed specifically for coaching centers</p>
                    <div className="features-grid">
                        <Link to="/features#students" className="feature-card">
                            <div className="feature-icon">👨‍🎓</div>
                            <h3>Student Management</h3>
                            <p>Complete student profiles, enrollment tracking, and parent communication</p>
                            <span className="feature-link">Learn more →</span>
                        </Link>
                        <Link to="/features#attendance" className="feature-card">
                            <div className="feature-icon">📅</div>
                            <h3>Attendance Tracking</h3>
                            <p>Digital attendance with reports, SMS alerts, and parent notifications</p>
                            <span className="feature-link">Learn more →</span>
                        </Link>
                        <Link to="/features#fees" className="feature-card">
                            <div className="feature-icon">💰</div>
                            <h3>Fees Management</h3>
                            <p>Automated fee collection, receipts, reminders, and payment tracking</p>
                            <span className="feature-link">Learn more →</span>
                        </Link>
                        <Link to="/features#reports" className="feature-card">
                            <div className="feature-icon">📊</div>
                            <h3>Reports & Analytics</h3>
                            <p>Real-time dashboards, performance metrics, and revenue insights</p>
                            <span className="feature-link">Learn more →</span>
                        </Link>
                        <Link to="/features#faculty" className="feature-card">
                            <div className="feature-icon">👩‍🏫</div>
                            <h3>Faculty Management</h3>
                            <p>Staff profiles, class assignments, and performance tracking</p>
                            <span className="feature-link">Learn more →</span>
                        </Link>
                        <Link to="/features#timetable" className="feature-card">
                            <div className="feature-icon">📅</div>
                            <h3>Master Timetable</h3>
                            <p>Dynamic schedule generation, soft-colored subject pills, and conflict prevention</p>
                            <span className="feature-link">Learn more →</span>
                        </Link>
                        <Link to="/features#security" className="feature-card">
                            <div className="feature-icon">🔒</div>
                            <h3>Secure Cloud Access</h3>
                            <p>Bank-level security, automatic backups, and 24/7 accessibility</p>
                            <span className="feature-link">Learn more →</span>
                        </Link>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="how-it-works-section">
                <div className="container">
                    <h2 className="section-title">Get Started in 4 Simple Steps</h2>
                    <div className="steps-grid">
                        <div className="step-card">
                            <div className="step-number">1</div>
                            <h3>Register Your Institute</h3>
                            <p>Sign up in 2 minutes with basic details</p>
                        </div>
                        <div className="step-card">
                            <div className="step-number">2</div>
                            <h3>Choose Your Plan</h3>
                            <p>Select a plan that fits your needs</p>
                        </div>
                        <div className="step-card">
                            <div className="step-number">3</div>
                            <h3>Add Students & Faculty</h3>
                            <p>Import or add your data easily</p>
                        </div>
                        <div className="step-card">
                            <div className="step-number">4</div>
                            <h3>Start Managing</h3>
                            <p>Access everything from anywhere</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Social Proof */}
            <section className="testimonials-section">
                <div className="container">
                    <h2 className="section-title">Trusted by 50+ Coaching Centers</h2>
                    <div className="testimonials-grid">
                        <div className="testimonial-card">
                            <div className="testimonial-rating">⭐⭐⭐⭐⭐</div>
                            <p className="testimonial-text">
                                "ZenithFlows transformed how we run our coaching center. Attendance tracking is now effortless,
                                and parents love the instant updates!"
                            </p>
                            <div className="testimonial-author">
                                <strong>Rajesh Kumar</strong>
                                <span>Director, Excel Coaching Center</span>
                            </div>
                        </div>
                        <div className="testimonial-card">
                            <div className="testimonial-rating">⭐⭐⭐⭐⭐</div>
                            <p className="testimonial-text">
                                "Fee collection was our biggest headache. Now it's completely automated.
                                We've reduced payment delays by 80%!"
                            </p>
                            <div className="testimonial-author">
                                <strong>Priya Sharma</strong>
                                <span>Owner, Bright Future Academy</span>
                            </div>
                        </div>
                        <div className="testimonial-card">
                            <div className="testimonial-rating">⭐⭐⭐⭐⭐</div>
                            <p className="testimonial-text">
                                "The reports feature gives us insights we never had before.
                                We can now make data-driven decisions for our institute."
                            </p>
                            <div className="testimonial-author">
                                <strong>Amit Patel</strong>
                                <span>Principal, Success Point</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="final-cta-section">
                <div className="container">
                    <h2 className="cta-title">Start Managing Your Institute Today</h2>
                    <p className="cta-subtitle">Join hundreds of coaching centers already using ZenithFlows</p>
                    <div className="cta-buttons">
                        <Link to="/register?plan=free_trial" className="btn-primary-large">
                            🚀 Start Free Trial
                        </Link>
                        <Link to="/pricing" className="btn-secondary-large">
                            💰 View Plans
                        </Link>
                    </div>
                    <p className="cta-note">No credit card required • 14-day free trial • Cancel anytime</p>
                </div>
            </section>

            {/* Footer */}
            <footer className="public-footer">
                <div className="container">
                    <div className="footer-grid">
                        <div className="footer-col">
                            <h4>ZenithFlows</h4>
                            <p>Professional coaching center management software</p>
                        </div>
                        <div className="footer-col">
                            <h4>Product</h4>
                            <Link to="/features">Features</Link>
                            <Link to="/pricing">Pricing</Link>
                            <Link to="/about">About Us</Link>
                        </div>
                        <div className="footer-col">
                            <h4>Support</h4>
                            <Link to="/contact">Contact</Link>
                            <Link to="/terms">Terms of Service</Link>
                            <Link to="/privacy">Privacy Policy</Link>
                        </div>
                        <div className="footer-col">
                            <h4>Connect</h4>
                            <a href="mailto:support@zfsolution.com">support@zfsolution.com</a>
                            <a href="tel:+911234567890">+91 123 456 7890</a>
                        </div>
                    </div>
                    <div className="footer-bottom">
                        <p>&copy; 2026 ZenithFlows. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default LandingPage;
