/**
 * Landing Page Pricing Section
 * Card layout matches the uploaded reference images:
 *   - Billing: Monthly / Yearly (save 2 months) toggle
 *   - Platform: Web Only / Web + Mobile app toggle
 *   - Card: icon · name · description · price · save badge (yearly) · divider
 *            · students · admins · faculty · features · storage
 *   - Feature comparison modal
 *   - Lifetime premium banner
 */

import { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';

/* ── plan icons by name ── */
const PLAN_ICONS = {
    Starter:      '🪴',
    Basic:        '📖',
    Professional: '🚀',
    Enterprise:   '🏛️',
};

/* ── storage label ── */
function storageLabel(mb) {
    if (mb === -1 || mb == null) return 'Unlimited';
    if (mb >= 1024) return `${(mb / 1024).toFixed(0)} GB`;
    return `${mb} MB`;
}

/* ── Feature comparison rows (26 features per spec) ── */
const COMPARE_ROWS = [
    { section: 'Attendance' },
    { label: 'Manage Student Attendance', key: 'feature_attendance', fmt: v => v && v !== 'none' ? (v === 'advanced' ? 'Advanced' : 'Basic') : '\u2014' },
    { label: 'View Attendance',            key: 'feature_attendance', fmt: v => v && v !== 'none' ? '\u2713' : '\u2014' },
    { label: 'Scan Student QR Code',       key: 'feature_scan_qr',         bool: true },
    { label: 'Faculty Attendance',         key: 'feature_faculty_attendance', bool: true },
    { label: 'View Faculty Tracker',       key: 'feature_faculty_tracker',  bool: true },
    { label: 'Scan Faculty QR Code',       key: 'feature_faculty_tracker',  bool: true },
    { label: 'Biometric Attendance',       key: 'feature_biometric',        bool: true },
    { section: 'People Management' },
    { label: 'Manage Admin / Managers',    key: 'feature_students',         bool: true },
    { label: 'Manage Students',            key: 'feature_students',         bool: true },
    { label: 'Manage Classes & Subjects',  key: 'feature_classes',          bool: true },
    { label: 'Manage Faculty',             key: 'feature_faculty',          bool: true },
    { label: 'Manage Parents',             key: 'feature_parent_portal',    bool: true },
    { section: 'Finance' },
    { label: 'Collect Fees',               key: 'feature_fees',             bool: true },
    { label: 'Finances & Expenses',        key: 'feature_finance',          bool: true },
    { label: 'Salary Management',          key: 'feature_salary',           bool: true },
    { section: 'Academics' },
    { label: 'Manage Exams',               key: 'feature_exams',            bool: true },
    { label: 'Master Timetable',           key: 'feature_timetable',        bool: true },
    { label: 'Assignments',                key: 'feature_assignment',       bool: true },
    { label: 'Exam Reports',               key: 'feature_export',           bool: true },
    { section: 'Communication & Content' },
    { label: 'Announcements',              key: 'feature_announcements',    bool: true },
    { label: 'All Notes',                  key: 'feature_notes',            bool: true },
    { label: 'Chat Monitor',               key: 'feature_chat',             bool: true },
    { section: 'Reports & Analytics' },
    { label: 'Reports & Analytics',        key: 'feature_reports', fmt: v => v === 'advanced' ? 'Advanced' : v === 'basic' ? 'Standard' : '\u2014' },
    { label: 'Student Performance Analytics', key: 'feature_performance_analytics', bool: true },
    { label: 'Faculty Performance Analytics', key: 'feature_performance_analytics', bool: true },
    { section: 'Communication Channels' },
    { label: 'SMS Notifications',          key: 'feature_sms',              bool: true },
    { label: 'Email Notifications',        key: 'feature_email',            bool: true },
    { label: 'WhatsApp',                   key: 'feature_whatsapp',         bool: true },
    { section: 'Institute Web Page' },
    { label: 'Institute Public Web Page',  key: 'feature_public_page',      bool: true },
    { label: 'Custom Domain & Branding',   key: 'feature_custom_branding',  bool: true },
    { section: 'Advanced' },
    { label: 'API Access',                 key: 'feature_api_access',       bool: true },
    { label: 'Multi-Branch Management',    key: 'feature_multi_branch',     bool: true },
    { section: 'Limits' },
    { label: 'Max Students',               key: 'max_students',  fmt: v => v === -1 ? 'Unlimited' : v?.toLocaleString('en-IN') },
    { label: 'Max Admins',                 key: 'max_admin_users', fmt: v => v === -1 ? 'Unlimited' : String(v) },
    { label: 'Max Faculty',                key: 'max_faculty',   fmt: v => v === -1 ? 'Unlimited' : v?.toLocaleString('en-IN') },
    { label: 'Storage',                    key: 'max_storage_mb',fmt: v => storageLabel(v) },
    { section: 'Mobile (Web + Mobile only)' },
    { label: 'Mobile App',                 key: 'feature_mobile_app',          bool: true },
    { label: 'Push Notifications',         key: 'feature_push_notifications',  bool: true },
    { label: 'Offline Attendance',         key: 'feature_offline_attendance',  bool: true },
    { label: 'Parent App',                 key: 'feature_parent_app',          bool: true },
    { label: 'Student App',                key: 'feature_student_app',         bool: true },
];

const CheckCircle = () => (
    <svg style={S.checkIcon} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
);

const CheckIcon = () => (
    <svg style={S.checkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeWidth="1.5"></path>
        <polyline points="22 4 12 14.01 9 11.01" strokeWidth="2"></polyline>
    </svg>
);

const FeatureCheck = () => (
    <svg style={S.checkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <path d="M8 12.5l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);


/* ── Inline styles ── */
const S = {
    wrap:    { padding: '140px 0 80px', background: 'var(--lp-bg, #f8fafc)', position: 'relative', fontFamily: "'Inter', 'Plus Jakarta Sans', sans-serif" },
    inner:   { maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem' },
    header:  { textAlign: 'center', marginBottom: '3rem' },
    eyebrow: { display:'inline-block', fontSize:'0.8rem', fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', color:'var(--lp-primary, #6366f1)', marginBottom:'0.5rem' },
    h2:      { fontSize:'clamp(1.6rem, 3.5vw, 2.4rem)', fontWeight:800, color:'var(--lp-text, #0f172a)', lineHeight:1.2, marginBottom:'0.75rem' },
    sub:     { fontSize:'0.95rem', color:'var(--lp-muted, #64748b)', maxWidth:'600px', margin:'0 auto' },

    controls:  { display:'flex', flexWrap:'wrap', justifyContent:'space-between', alignItems:'center', gap:'16px', marginBottom:'2.5rem' },
    ctrlGroup: { display:'flex', alignItems:'center', gap:'12px' },
    ctrlLabel: { fontSize:'0.85rem', fontWeight:600, color:'var(--lp-muted, #64748b)', marginRight:'6px' },
    btnGroup:  { display:'flex', background:'var(--lp-surface, #fff)', border:'1px solid var(--lp-border, #e2e8f0)', borderRadius:'10px', padding:'4px', gap:'4px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' },
    btn: (active) => ({
        padding:'8px 16px', border:'none', borderRadius:'8px', cursor:'pointer',
        fontWeight:600, fontSize:'0.85rem', transition:'all 0.2s', display: 'flex', alignItems: 'center',
        background: active ? 'var(--lp-primary, #6366f1)' : 'transparent',
        color:      active ? '#fff' : 'var(--lp-text, #0f172a)',
        boxShadow:  active ? '0 2px 4px rgba(99,102,241,0.2)' : 'none',
    }),
    saveBadge: { display:'inline-flex', alignItems:'center', background:'#dcfce7', color:'#059669', fontSize:'0.7rem', fontWeight:700, padding:'4px 10px', borderRadius:'20px', marginLeft:'8px' },
    extraBadge:{ color:'var(--lp-primary, #6366f1)', fontSize:'0.7rem', fontWeight:700, marginLeft:'6px' },

    grid:  { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'1.25rem', marginBottom:'3rem', alignItems:'stretch' },

    card: (popular) => ({
        background: 'var(--lp-surface, #fff)',
        border: `1px solid ${popular ? 'var(--lp-primary, #6366f1)' : 'var(--lp-border, #e2e8f0)'}`,
        borderRadius:'20px', padding:'1.75rem 1.5rem',
        position:'relative', display:'flex', flexDirection:'column',
        transition:'transform 0.3s ease, box-shadow 0.3s ease',
        boxShadow: popular ? '0 16px 32px rgba(99,102,241,0.08)' : '0 4px 6px rgba(0,0,0,0.02)',
        transform: popular ? 'scale(1.02)' : 'scale(1)',
        zIndex: popular ? 10 : 1,
    }),

    popularTag: {
        position:'absolute', top:'-13px', left:'50%', transform:'translateX(-50%)',
        background:'var(--lp-primary, #6366f1)', color:'#fff', fontSize:'0.75rem', fontWeight:700,
        padding:'4px 14px', borderRadius:'20px', whiteSpace:'nowrap',
    },

    planIcon: { fontSize:'1.6rem', marginBottom:'0.75rem', display:'inline-block' },
    planName: { fontSize:'1.15rem', fontWeight:800, color:'var(--lp-text, #0f172a)', marginBottom:'0.2rem' },
    planDesc: { fontSize:'0.82rem', color:'var(--lp-muted, #64748b)', marginBottom:'1rem', lineHeight:1.4 },

    priceRow:   { display:'flex', alignItems:'baseline', gap:'3px', marginBottom:'0.2rem' },
    currency:   { fontSize:'1.3rem', fontWeight:700, color:'var(--lp-text, #0f172a)' },
    amount:     { fontSize:'2.4rem', fontWeight:800, color:'var(--lp-text, #0f172a)', lineHeight:1, letterSpacing: '-1px' },
    period:     { fontSize:'0.85rem', color:'var(--lp-muted, #64748b)', marginLeft:'3px', fontWeight: 500 },
    saveRow:    { fontSize:'0.85rem', color:'#10b981', fontWeight:600, marginBottom:'1.25rem', minHeight:'1.2rem' },

    divider:    { border:'none', borderTop:'1px solid var(--lp-border, #e2e8f0)', margin:'0 0 1.25rem 0' },

    featuresList: { display:'flex', flexDirection:'column', gap:'12px', marginBottom:'2rem', listStyle: 'none', padding: 0, margin: '0 0 2rem 0' },
    featItem:   { display:'flex', alignItems:'flex-start', fontSize:'0.85rem', color:'var(--lp-muted, #475569)', lineHeight:1.4 },
    checkIcon:  { color: 'var(--lp-primary, #6366f1)', width: '16px', height: '16px', marginRight: '8px', flexShrink: 0, marginTop: '2px' },
    
    // Bottom features container
    bottomFeatures: {
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem',
        background: 'var(--lp-surface, #fff)', border: '1px solid var(--lp-border, #e2e8f0)', borderRadius: '20px', padding: '1.5rem 2rem',
        boxShadow: '0 10px 30px rgba(0,0,0,0.03)', marginTop: '2rem',
    },
    bfItem: { display: 'flex', alignItems: 'center', gap: '12px' },
    bfIconWrap: { width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lp-primary, #6366f1)' },
    bfTextWrap: { display: 'flex', flexDirection: 'column' },
    bfTitle: { fontSize: '0.85rem', fontWeight: 700, color: 'var(--lp-text, #0f172a)', marginBottom: '2px' },
    bfDesc: { fontSize: '0.75rem', color: 'var(--lp-muted, #64748b)' },

    /* modal */
    overlay: { position:'fixed', inset:0, background:'rgba(15,23,42,0.85)', backdropFilter:'blur(8px)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'1.5rem' },
    modal:   { background:'var(--lp-surface, #fff)', border:'1px solid var(--lp-border, #e2e8f0)', borderRadius:'16px', maxWidth:'900px', width:'100%', maxHeight:'85vh', overflowY:'auto', padding:'2rem', position:'relative', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' },
    closeBtn:{ position:'absolute', top:14, right:14, width:32, height:32, border:'1px solid var(--lp-border, #e2e8f0)', borderRadius:'7px', background:'var(--lp-bg, #f8fafc)', color:'var(--lp-muted, #64748b)', fontSize:'1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' },
    table:   { width:'100%', borderCollapse:'collapse', fontSize:'0.84rem' },
    th:      { padding:'10px 12px', textAlign:'left', color:'var(--lp-primary, #6366f1)', fontWeight:700, borderBottom:'1px solid var(--lp-border, #e2e8f0)', fontSize:'0.85rem', background:'var(--lp-bg, #f8fafc)' },
    td:      { padding:'10px 12px', borderBottom:'1px solid var(--lp-border, #e2e8f0)', color:'var(--lp-text, #0f172a)' },
    secRow:  { padding:'18px 12px 6px', fontWeight:700, color:'var(--lp-primary, #6366f1)', fontSize:'0.75rem', letterSpacing:'1px', textTransform:'uppercase', borderBottom:'2px solid rgba(99,102,241,0.12)', background:'rgba(99,102,241,0.02)' },
};

// SVG Icons for Bottom Features
const IconClock = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IconCard = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
const IconTool = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>;
const IconCancel = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
const IconGlobe = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
const IconMobile = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>;

export default function Pricing() {
    const navigate  = useNavigate();
    const { user }  = useContext(AuthContext);
    const fetchedRef = useRef(false);

    const [allPlans,     setAllPlans]     = useState([]);
    const [lifetimePlan, setLifetimePlan] = useState(null);
    const [loading,      setLoading]      = useState(true);
    const [billing,      setBilling]      = useState('monthly');   // 'monthly' | 'yearly'
    const [platform,     setPlatform]     = useState('web_only');  // 'web_only' | 'web_android'
    const [showModal,    setShowModal]    = useState(false);
    const [modalPlan,    setModalPlan]    = useState(null);

    /* ── single API call on mount ── */
    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        Promise.all([
            api.get('/plans'),
            api.get('/lifetime/info').catch(() => null),
        ]).then(([plansRes, ltRes]) => {
            const active = (plansRes.data.data || [])
                .filter(p => p.status === 'active' && !p.is_lifetime && !p.is_hidden)
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
            setAllPlans(active);
            if (ltRes?.data?.success) setLifetimePlan(ltRes.data.plan);
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const visible = allPlans.filter(p => p.platform_type === platform);

    const getPrice = (plan) => {
        if (plan.contact_sales) return null;
        if (billing === 'yearly' && plan.yearly_price) return Number(plan.yearly_price);
        return Number(plan.price);
    };

    const getSavings = (plan) => {
        if (billing !== 'yearly' || !plan.yearly_price || !plan.price) return null;
        const monthly = Number(plan.price);
        const yearly  = Number(plan.yearly_price);
        const saved   = monthly * 12 - yearly;
        return saved > 0 ? saved : null;
    };

    const fmt = n => n != null ? n.toLocaleString('en-IN') : '';

    const handleChoose = (plan) => {
        if (plan.contact_sales) {
            document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
            return;
        }
        if (user?.role === 'admin') navigate(`/checkout?plan_id=${plan.id}&cycle=${billing}`);
        else { localStorage.setItem('selectedPlan', plan.id); navigate('/register'); }
    };

    const handleLifetime = () => {
        if (user?.role === 'admin') navigate('/billing?tab=lifetime');
        else navigate('/register?intent=lifetime');
    };

    if (loading) return (
        <section id="pricing" style={S.wrap}>
            <div style={S.inner}>
                <div style={{ textAlign:'center', padding:'60px', color:'var(--lp-muted)' }}>Loading plans…</div>
            </div>
        </section>
    );

    return (
        <section id="pricing" style={S.wrap}>
            {/* hover / active micro-animations */}
            <style>{`
                .lp-pc:hover  { transform: translateY(-5px) !important; box-shadow: 0 16px 40px rgba(0,0,0,0.08) !important; border-color: var(--lp-primary) !important; }
                .lp-pc.popular:hover { box-shadow: 0 20px 50px rgba(99,102,241,0.15) !important; }
                
                /* Button Base */
                .lp-pb {
                    margin-top: auto; width: 100%; padding: 12px; border-radius: 10px;
                    font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: all 0.2s ease;
                }
                
                /* Outline Button */
                .lp-pb-outline {
                    background: transparent;
                    color: var(--lp-primary, #6366f1);
                    border: 1px solid var(--lp-border, #e2e8f0);
                }
                .lp-pb-outline:hover {
                    background: var(--lp-primary, #6366f1);
                    color: #fff;
                    border-color: var(--lp-primary, #6366f1);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(99,102,241,0.15);
                }
                
                /* Solid Button */
                .lp-pb-solid {
                    background: var(--lp-primary, #6366f1);
                    color: #fff;
                    border: 1px solid var(--lp-primary, #6366f1);
                }
                .lp-pb-solid:hover {
                    filter: brightness(1.1);
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(99,102,241,0.25);
                }
                
                .lp-pb:active { transform: translateY(1px) !important; filter: brightness(0.95) !important; box-shadow: none !important; }
            `}</style>

            <div style={S.inner}>
                {/* Header */}
                <div style={S.header}>
                    <span style={S.eyebrow}>Transparent Pricing</span>
                    <h2 style={S.h2}>Choose the Perfect Plan for Your Institute</h2>
                    <p style={S.sub}>No hidden fees. Cancel anytime. 14-day free trial — no credit card required.</p>
                </div>

                {/* Controls */}
                <div style={{ ...S.controls, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '24px', marginBottom: '3rem' }}>
                    {/* Billing toggle */}
                    <div style={S.ctrlGroup}>
                        <span style={S.ctrlLabel}>Billing:</span>
                        <div style={S.btnGroup}>
                            <button style={S.btn(billing === 'monthly')} onClick={() => setBilling('monthly')}>Monthly</button>
                            <button style={S.btn(billing === 'yearly')}  onClick={() => setBilling('yearly')}>Yearly</button>
                        </div>
                        <span style={S.saveBadge}>Save up to 20%</span>
                    </div>

                    {/* Book Free Demo Button */}
                    <button 
                        className="lp-pb lp-pb-solid" 
                        style={{ margin: 0, padding: '10px 24px', width: 'auto', borderRadius: '30px' }}
                        onClick={() => window.location.href = '/book-demo'}
                    >
                        Book Free Demo
                    </button>

                    {/* Platform toggle */}
                    <div style={S.ctrlGroup}>
                        <span style={S.ctrlLabel}>Platform:</span>
                        <div style={S.btnGroup}>
                            <button style={S.btn(platform === 'web_only')} onClick={() => setPlatform('web_only')}>
                                <span style={{marginRight: '6px', display:'flex'}}><IconGlobe/></span> Web Only
                            </button>
                            <button style={S.btn(platform === 'web_android')} onClick={() => setPlatform('web_android')}>
                                <span style={{marginRight: '6px', display:'flex'}}><IconMobile/></span> Web + Mobile App
                                <span style={S.extraBadge}>+₹extra</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Plan Cards */}
                <div style={S.grid}>
                    {visible.map((plan) => {
                        const price   = getPrice(plan);
                        const savings = getSavings(plan);
                        const popular = !!plan.is_popular;
                        const isEnt   = !!plan.contact_sales;
                        const icon    = PLAN_ICONS[plan.name] || '📋';
                        const fCount  = plan.feature_count ?? 0;
                        const storage = storageLabel(plan.max_storage_mb);

                        const students = plan.max_students    === -1 ? 'Unlimited' : plan.max_students?.toLocaleString('en-IN');
                        const admins   = plan.max_admin_users === -1 ? 'Unlimited' : plan.max_admin_users;
                        const managers = plan.max_managers    === -1 ? 'Unlimited' : (plan.max_managers || 0);
                        const faculty  = plan.max_faculty     === -1 ? 'Unlimited' : plan.max_faculty?.toLocaleString('en-IN');

                        return (
                            <div key={plan.id} className={`lp-pc ${popular ? 'popular' : ''}`} style={S.card(popular)}>
                                {popular && <div style={S.popularTag}>Most Popular</div>}

                                {/* Icon · Name · Description */}
                                <div>
                                    <span style={S.planIcon}>{icon}</span>
                                </div>
                                <div style={S.planName}>{plan.name}</div>
                                <div style={S.planDesc}>{plan.description || ''}</div>

                                {/* Price */}
                                {isEnt ? (
                                    <div style={S.priceRow}>
                                        <span style={{ ...S.amount, fontSize:'2.2rem' }}>Contact Sales</span>
                                    </div>
                                ) : (
                                    <div style={S.priceRow}>
                                        <span style={S.currency}>₹</span>
                                        <span style={S.amount}>{fmt(price)}</span>
                                        <span style={S.period}>/{billing === 'yearly' ? 'year' : 'month'}</span>
                                    </div>
                                )}

                                {/* Savings row (yearly only) */}
                                <div style={S.saveRow}>
                                    {savings ? <span>Save ₹{fmt(savings)}/yr</span> : null}
                                </div>

                                <hr style={S.divider} />

                                {/* Stats & Features */}
                                <ul style={S.featuresList}>
                                    <li style={S.featItem}>
                                        <FeatureCheck />
                                        <span><strong style={{color:'var(--lp-text)'}}>{students}</strong> students</span>
                                    </li>
                                    <li style={S.featItem}>
                                        <FeatureCheck />
                                        <span><strong style={{color:'var(--lp-text)'}}>{admins}</strong> admins &middot; <strong style={{color:'var(--lp-text)'}}>{managers}</strong> managers <br/> <strong style={{color:'var(--lp-text)'}}>{faculty}</strong> faculty</span>
                                    </li>
                                    <li style={S.featItem}>
                                        <FeatureCheck />
                                        <span><strong style={{color:'var(--lp-text)'}}>{fCount}</strong> features &middot; <strong style={{color:'var(--lp-text)'}}>{storage}</strong> storage</span>
                                    </li>
                                    <li style={S.featItem}>
                                        <FeatureCheck />
                                        <span>{isEnt ? 'Dedicated account manager' : popular ? 'Priority support' : 'Email support'}</span>
                                    </li>
                                </ul>

                                {/* CTA */}
                                <button
                                    className={`lp-pb ${popular ? 'lp-pb-solid' : 'lp-pb-outline'}`}
                                    onClick={(e) => { e.stopPropagation(); handleChoose(plan); }}
                                >
                                    {isEnt ? `Get ${plan.name}` : plan.is_free_trial ? 'Start Free Trial' : `Get ${plan.name}`}
                                </button>

                            </div>
                        );
                    })}
                </div>

                {/* Bottom Features */}
                <div style={S.bottomFeatures}>
                    <div style={S.bfItem}>
                        <div style={S.bfIconWrap}><IconClock /></div>
                        <div style={S.bfTextWrap}>
                            <div style={S.bfTitle}>14-Day Free Trial</div>
                            <div style={S.bfDesc}>Explore all features</div>
                        </div>
                    </div>
                    <div style={S.bfItem}>
                        <div style={S.bfIconWrap}><IconCard /></div>
                        <div style={S.bfTextWrap}>
                            <div style={S.bfTitle}>No Credit Card</div>
                            <div style={S.bfDesc}>No upfront payment</div>
                        </div>
                    </div>
                    <div style={S.bfItem}>
                        <div style={S.bfIconWrap}><IconTool /></div>
                        <div style={S.bfTextWrap}>
                            <div style={S.bfTitle}>Easy Setup</div>
                            <div style={S.bfDesc}>Get started in minutes</div>
                        </div>
                    </div>
                    <div style={S.bfItem}>
                        <div style={S.bfIconWrap}><IconCancel /></div>
                        <div style={S.bfTextWrap}>
                            <div style={S.bfTitle}>Cancel Anytime</div>
                            <div style={S.bfDesc}>No questions asked</div>
                        </div>
                    </div>
                </div>

                {/* Feature Comparison Modal */}
                {showModal && (
                    <div style={S.overlay} onClick={() => setShowModal(false)}>
                        <div style={S.modal} onClick={e => e.stopPropagation()}>
                            <button style={S.closeBtn} onClick={() => setShowModal(false)}>✕</button>
                            <h3 style={{ fontSize:'1.25rem', fontWeight:700, color:'var(--lp-text)', marginBottom:'1.5rem' }}>
                                {modalPlan ? `${modalPlan.name} — All Features` : `Compare ${platform === 'web_only' ? 'Web Only' : 'Web + Mobile'} Plans`}
                            </h3>
                            <div style={{ overflowX:'auto' }}>
                                <table style={S.table}>
                                    <thead>
                                        <tr>
                                            <th style={S.th}>Feature</th>
                                            {modalPlan
                                                ? <th style={S.th}>{modalPlan.name}</th>
                                                : visible.map(p => <th key={p.id} style={S.th}>{p.name}</th>)
                                            }
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {COMPARE_ROWS.map((row, idx) => {
                                            if (row.section) return (
                                                <tr key={idx}>
                                                    <td colSpan={modalPlan ? 2 : visible.length + 1} style={S.secRow}>{row.section}</td>
                                                </tr>
                                            );
                                            const renderVal = (p) => {
                                                if (row.bool) return p[row.key]
                                                    ? <span style={{ color:'#10b981', fontWeight:700 }}>\u2713</span>
                                                    : <span style={{ color:'var(--lp-muted)' }}>—</span>;
                                                if (row.fmt) return row.fmt(p[row.key]);
                                                return p[row.key] != null ? String(p[row.key]) : '—';
                                            };
                                            return (
                                                <tr key={idx}>
                                                    <td style={{ ...S.td, fontWeight:600, color:'var(--lp-text)' }}>{row.label}</td>
                                                    {modalPlan
                                                        ? <td style={S.td}>{renderVal(modalPlan)}</td>
                                                        : visible.map(p => <td key={p.id} style={S.td}>{renderVal(p)}</td>)
                                                    }
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

