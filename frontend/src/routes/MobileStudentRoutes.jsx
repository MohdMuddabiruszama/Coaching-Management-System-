/**
 * Native shell: student role only (bundled when VITE_APP_VARIANT=student).
 * Phase 1C: Uses MobileStudentLayout (bottom tabs) on native, StudentLayout (sidebar) on web.
 */

import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
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

const StudentDashboard = lazy(() => import("../pages/student/MobileDashboard"));
const ViewAttendance = lazy(() => import("../pages/student/MobileAttendance"));
const ViewMarks = lazy(() => import("../pages/student/ViewMarks"));
const ViewAnnouncements = lazy(() => import("../pages/student/ViewAnnouncements"));
const PayFees = lazy(() => import("../pages/student/PayFees"));
const StudentPerformance = lazy(() => import("../pages/student/Performance"));
const ScanAttendance = lazy(() => import("../pages/student/ScanAttendance"));
const StudentTimetable = lazy(() => import("../pages/student/Timetable"));
const StudentNotes = lazy(() => import("../pages/student/StudentNotes"));
const StudentAssignments = lazy(() => import("../pages/student/Assignments"));
const Pricing = lazy(() => import("../pages/public/PricingPage"));

const PageLoader = () => (
  <div className="page-loader">
    <LoadingSpinner />
  </div>
);

// Phase 1C: Select layout based on platform
const IS_NATIVE = Capacitor.isNativePlatform();
const StudentLayout = IS_NATIVE
    ? lazy(() => import("../components/layout/MobileStudentLayout"))
    : lazy(() => import("../components/layout/StudentLayout"));

import FeatureGuard from "../components/common/FeatureGuard";

function StudentArea() {
  return (
    <ProtectedRoute allowedRoles={["student"]}>
      <Routes>
        <Route path="/" element={<StudentLayout />}>
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="attendance" element={
            <FeatureGuard featureKey="attendance" title="Attendance Tracker">
              <ViewAttendance />
            </FeatureGuard>
          } />
          <Route path="scan-attendance" element={
            <FeatureGuard featureKey="attendance" title="QR Attendance">
              <ScanAttendance />
            </FeatureGuard>
          } />
          <Route path="exams" element={
            <FeatureGuard featureKey="exams" title="Examination Marks">
              <ViewMarks />
            </FeatureGuard>
          } />
          <Route path="announcements" element={
            <FeatureGuard featureKey="announcements" title="Notices & Announcements">
              <ViewAnnouncements />
            </FeatureGuard>
          } />
          <Route path="fees" element={
            <FeatureGuard featureKey="fees" title="Fee Management">
              <PayFees />
            </FeatureGuard>
          } />
          <Route path="buy-plan" element={<Pricing />} />
          <Route path="timetable" element={
            <FeatureGuard featureKey="timetable" title="Master Timetable">
              <StudentTimetable />
            </FeatureGuard>
          } />
          <Route path="notes" element={
            <FeatureGuard featureKey="notes" title="Study Material & Notes">
              <StudentNotes />
            </FeatureGuard>
          } />
          <Route path="assignments" element={
            <FeatureGuard featureKey="notes" title="Assignments">
              <StudentAssignments />
            </FeatureGuard>
          } />
          <Route path="performance" element={
            <FeatureGuard featureKey="exams" title="Performance Analytics">
              <StudentPerformance />
            </FeatureGuard>
          } />
          <Route path="chat" element={
            <FeatureGuard featureKey="chat" title="Subject Chat Rooms">
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

export default function MobileStudentRoutes() {
  const navigate = useNavigate();
  const home = "/student/dashboard";

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
        <Route path="/student/*" element={<StudentArea />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </Suspense>
  );
}
