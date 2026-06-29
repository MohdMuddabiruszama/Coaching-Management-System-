/**
 * Native shell: parent role only (bundled when VITE_APP_VARIANT=parent).
 */

import { Routes, Route, Navigate, useNavigate, Outlet } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import ProtectedRoute from "./ProtectedRoute";
import LoadingSpinner from "../components/common/LoadingSpinner";

const Login = lazy(() => import("../pages/auth/Login"));
const ForgotPassword = lazy(() => import("../pages/auth/ForgotPassword"));
const Terms = lazy(() => import("../pages/public/TermsPage"));
const Privacy = lazy(() => import("../pages/public/PrivacyPage"));
const Profile = lazy(() => import("../pages/admin/Profile"));
const ChatApp = lazy(() => import("../pages/chat/ChatApp"));
const Unauthorized = lazy(() => import("../pages/common/Unauthorized"));

import FeatureGuard from "../components/common/FeatureGuard";

const ParentDashboard = lazy(() => import("../pages/parent/MobileDashboard"));
const ParentMobileTimetable = lazy(() => import("../pages/parent/MobileTimetable"));
const ParentMobileAssignments = lazy(() => import("../pages/parent/MobileAssignments"));
const ParentMobileAttendance = lazy(() => import("../pages/parent/MobileAttendance"));
const ParentMobileMarks = lazy(() => import("../pages/parent/MobileMarks"));
const ParentMobilePerformance = lazy(() => import("../pages/parent/MobilePerformance"));
const ParentMobileFees = lazy(() => import("../pages/parent/MobileFees"));
const ViewAnnouncements = lazy(() => import("../pages/student/ViewAnnouncements"));

const PageLoader = () => (
  <div className="page-loader">
    <LoadingSpinner />
  </div>
);

const IS_NATIVE = Capacitor.isNativePlatform();
const MobileParentLayout = lazy(() => import("../components/layout/MobileParentLayout"));
const ParentLayout = IS_NATIVE ? MobileParentLayout : () => <Outlet />;

function ParentArea() {
  return (
    <ProtectedRoute allowedRoles={["parent"]}>
      <Routes>
        <Route path="/" element={<ParentLayout />}>
          <Route path="dashboard" element={<ParentDashboard />} />
          <Route path="timetable" element={
            <FeatureGuard featureKey="timetable" title="Timetable">
              <ParentMobileTimetable />
            </FeatureGuard>
          } />
          <Route path="assignments" element={
            <FeatureGuard featureKey="notes" title="Assignments">
              <ParentMobileAssignments />
            </FeatureGuard>
          } />
          <Route path="attendance" element={
            <FeatureGuard featureKey="attendance" title="Attendance">
              <ParentMobileAttendance />
            </FeatureGuard>
          } />
          <Route path="marks" element={
            <FeatureGuard featureKey="exams" title="Marks">
              <ParentMobileMarks />
            </FeatureGuard>
          } />
          <Route path="performance" element={
            <FeatureGuard featureKey="exams" title="Performance">
              <ParentMobilePerformance />
            </FeatureGuard>
          } />
          <Route path="fees" element={
            <FeatureGuard featureKey="fees" title="Fees">
              <ParentMobileFees />
            </FeatureGuard>
          } />
          <Route path="announcements" element={
            <FeatureGuard featureKey="announcements" title="Announcements">
              <ViewAnnouncements />
            </FeatureGuard>
          } />
          <Route path="chat" element={
            <FeatureGuard featureKey="chat" title="Messages">
              <ChatApp />
            </FeatureGuard>
          } />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Routes>
    </ProtectedRoute>
  );
}

export default function MobileParentRoutes() {
  const navigate = useNavigate();
  const home = "/parent/dashboard";

  // Listen for API interceptor navigation events
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
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/parent/*" element={<ParentArea />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </Suspense>
  );
}
