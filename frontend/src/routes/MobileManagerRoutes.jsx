/**
 * MobileManagerRoutes.jsx
 * Native shell: manager role — bundled when VITE_APP_VARIANT=manager.
 * Pattern mirrors MobileFacultyRoutes.jsx exactly.
 * Web manager dashboard is completely untouched by this file.
 */

import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import ProtectedRoute from "./ProtectedRoute";
import LoadingSpinner from "../components/common/LoadingSpinner";

const Login          = lazy(() => import("../pages/auth/Login"));
const ForgotPassword = lazy(() => import("../pages/auth/ForgotPassword"));
const Terms          = lazy(() => import("../pages/public/TermsPage"));
const Privacy        = lazy(() => import("../pages/public/PrivacyPage"));
const Profile        = lazy(() => import("../pages/admin/Profile"));
const Unauthorized   = lazy(() => import("../pages/common/Unauthorized"));

// Manager-specific pages (lightweight mobile views only)
const ManagerDashboard   = lazy(() => import("../pages/manager/ManagerMobileDashboard"));
const ManagerQRScanner   = lazy(() => import("../pages/faculty/MobileSmartAttendance"));
const ManagerScanFaculty = lazy(() => import("../pages/manager/MobileFacultySmartAttendance"));
const ManagerPendingFees = lazy(() => import("../pages/manager/ManagerPendingFees"));
const ManagerAttendance  = lazy(() => import("../pages/faculty/ViewAttendance"));
const ManagerMarkAttendance = lazy(() => import("../pages/faculty/MobileMarkAttendance"));
const ManagerMarkFaculty = lazy(() => import("../pages/manager/MobileMarkFacultyAttendance"));
const ManagerAnnouncements = lazy(() => import("../pages/manager/ManagerAnnouncements"));

const PageLoader = () => (
    <div className="page-loader">
        <LoadingSpinner />
    </div>
);

// Use native bottom-nav layout on device, standard layout on web browser
const IS_NATIVE = Capacitor.isNativePlatform();
const ManagerLayout = IS_NATIVE
    ? lazy(() => import("../components/layout/MobileManagerLayout"))
    : lazy(() => import("../components/layout/MobileManagerLayout")); // same layout on web for manager mobile app

import FeatureGuard from "../components/common/FeatureGuard";

export function ManagerArea() {
    return (
        <ProtectedRoute allowedRoles={["manager"]}>
            <Routes>
                <Route path="/" element={<ManagerLayout />}>
                    {/* Home */}
                    <Route path="dashboard" element={<ManagerDashboard />} />

                    {/* QR Scanner — requires attendance feature */}
                    <Route path="scanner" element={
                        <FeatureGuard featureKey="attendance" title="QR Scanner">
                            <ManagerQRScanner />
                        </FeatureGuard>
                    } />
                    
                    {/* Faculty QR Scanner */}
                    <Route path="scan-faculty" element={
                        <FeatureGuard featureKey="attendance" title="Scan Faculty">
                            <ManagerScanFaculty />
                        </FeatureGuard>
                    } />

                    {/* Fees — requires fees feature */}
                    <Route path="fees" element={
                        <FeatureGuard featureKey="fees" title="Pending Fees">
                            <ManagerPendingFees />
                        </FeatureGuard>
                    } />

                    {/* Attendance Stats — requires attendance feature */}
                    <Route path="attendance" element={
                        <FeatureGuard featureKey="attendance" title="Attendance Stats">
                            <ManagerAttendance />
                        </FeatureGuard>
                    } />

                    {/* Mark Attendance — requires attendance feature */}
                    <Route path="mark-attendance" element={
                        <FeatureGuard featureKey="attendance" title="Mark Attendance">
                            <ManagerMarkAttendance />
                        </FeatureGuard>
                    } />
                    
                    {/* Mark Faculty Attendance */}
                    <Route path="mark-faculty-attendance" element={
                        <FeatureGuard featureKey="attendance" title="Mark Faculty">
                            <ManagerMarkFaculty />
                        </FeatureGuard>
                    } />

                    {/* Announcements */}
                    <Route path="announcements" element={
                        <FeatureGuard featureKey="announcements" title="Announcements">
                            <ManagerAnnouncements />
                        </FeatureGuard>
                    } />

                    {/* Profile — reuses existing admin Profile page */}
                    <Route path="profile" element={<Profile />} />

                    {/* Catch-all → dashboard */}
                    <Route path="*" element={<Navigate to="dashboard" replace />} />
                </Route>
            </Routes>
        </ProtectedRoute>
    );
}

export default function MobileManagerRoutes() {
    const navigate = useNavigate();
    const home = "/manager/dashboard";

    // Listen for API interceptor navigation events (same as other mobile routes)
    useEffect(() => {
        const handler = (e) => {
            const { path, clearSession } = e.detail || {};
            if (!path) return;
            if (clearSession) sessionStorage.clear();
            navigate(path, { replace: true });
        };
        window.addEventListener("app_navigate", handler);
        return () => window.removeEventListener("app_navigate", handler);
    }, [navigate]);

    return (
        <Suspense fallback={<PageLoader />}>
            <Routes>
                <Route path="/"                element={<Navigate to="/login" replace />} />
                <Route path="/login"           element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/terms"           element={<Terms />} />
                <Route path="/privacy"         element={<Privacy />} />
                <Route path="/manager/*"       element={<ManagerArea />} />
                <Route path="/unauthorized"    element={<Unauthorized />} />
                <Route path="*"               element={<Navigate to={home} replace />} />
            </Routes>
        </Suspense>
    );
}
