const fs = require('fs');

// 1. Update MobileManagerLayout.jsx
const layoutFile = 'd:/Pre Production/Coaching-Management-System-/frontend/src/components/layout/MobileManagerLayout.jsx';
let layoutContent = fs.readFileSync(layoutFile, 'utf8');

// Replace static TABS with dynamic TABS based on permissions inside the component
layoutContent = layoutContent.replace(
    /const TABS = \[\s*\{ id: "dashboard".*?\s*\];/s,
    '' // Remove static TABS
);

// Insert dynamic tabs inside the component
const layoutTarget = 'const MobileManagerLayout = () => {';
const layoutReplacement = `const MobileManagerLayout = () => {
    const { user, logout } = useContext(AuthContext);
    
    const hasPerm = (featureKey) => {
        const perms = user?.permissions || [];
        return perms.some(p => p === featureKey || p.startsWith(featureKey + '.') || p.startsWith(featureKey + ':') || p === '*');
    };

    const TABS = [
        { id: "dashboard",    label: "Home",       icon: "🏠", path: "/manager/dashboard", show: true },
        { id: "scanner",      label: "Scanner",    icon: "📷", path: "/manager/scanner", show: hasPerm('attendance') },
        { id: "fees",         label: "Fees",       icon: "💰", path: "/manager/fees", show: hasPerm('fees') },
        { id: "attendance",   label: "Attendance", icon: "📊", path: "/manager/attendance", show: hasPerm('attendance') },
        { id: "announcements",label: "Announce",   icon: "📢", path: "/manager/announcements", show: hasPerm('announcements') },
        { id: "profile",      label: "Profile",    icon: "👤", path: "/manager/profile", show: true },
    ].filter(tab => tab.show);
`;

layoutContent = layoutContent.replace(
    'const MobileManagerLayout = () => {\n    const { user, logout } = useContext(AuthContext);',
    layoutReplacement
);

fs.writeFileSync(layoutFile, layoutContent);
console.log('Updated MobileManagerLayout.jsx');

// 2. Update ManagerMobileDashboard.jsx
const dashboardFile = 'd:/Pre Production/Coaching-Management-System-/frontend/src/pages/manager/ManagerMobileDashboard.jsx';
let dashboardContent = fs.readFileSync(dashboardFile, 'utf8');

dashboardContent = dashboardContent.replace(
    '{ icon: "📢", label: "Notices",      nav: "/manager/announcements",  show: true                  },',
    '{ icon: "📢", label: "Notices",      nav: "/manager/announcements",  show: hasPerm("announcements") },'
);

fs.writeFileSync(dashboardFile, dashboardContent);
console.log('Updated ManagerMobileDashboard.jsx');
