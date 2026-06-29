/**
 * Native shell: faculty role only (bundled when VITE_APP_VARIANT=faculty). Teacher app in product docs.
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

const FacultyDashboard = lazy(() => import("../pages/faculty/Dashboard"));
const MarkAttendance = lazy(() => import("../pages/faculty/MarkAttendance"));
const FacultyViewAttendance = lazy(() => import("../pages/faculty/ViewAttendance"));
const FacultySmartAttendance = lazy(() => import("../pages/faculty/MobileSmartAttendance"));
const ScanFacultyQR = lazy(() => import("../pages/faculty/ScanFacultyQR"));
const EnterMarks = lazy(() => import("../pages/faculty/EnterMarks"));
const ViewStudents = lazy(() => import("../pages/faculty/ViewStudents"));
const FacultyAnnouncements = lazy(() => import("../pages/faculty/Announcements"));
const FacultySchedule = lazy(() => import("../pages/faculty/MySchedule"));
const FacultyNotes = lazy(() => import("../pages/faculty/MobileFacultyNotes"));
const FacultyAssignments = lazy(() => import("../pages/faculty/Assignments"));

const PageLoader = () => (
  <div className="page-loader">
    <LoadingSpinner />
  </div>
);

const IS_NATIVE = Capacitor.isNativePlatform();
const FacultyLayout = IS_NATIVE
    ? lazy(() => import("../components/layout/MobileFacultyLayout"))
    : lazy(() => import("../components/layout/FacultyLayout"));

import FeatureGuard from "../components/common/FeatureGuard";

function FacultyArea() {
  return (
    <ProtectedRoute allowedRoles={["faculty"]}>
      <Routes>
        <Route path="/" element={<FacultyLayout />}>
          <Route path="dashboard" element={<FacultyDashboard />} />
          <Route path="attendance" element={
            <FeatureGuard featureKey="attendance" title="Mark Attendance">
              <MarkAttendance />
            </FeatureGuard>
          } />
          <Route path="view-attendance" element={
            <FeatureGuard featureKey="attendance" title="View Attendance">
              <FacultyViewAttendance />
            </FeatureGuard>
          } />
          <Route path="smart-attendance" element={
            <FeatureGuard featureKey="auto_attendance" title="Smart Attendance">
              <FacultySmartAttendance />
            </FeatureGuard>
          } />
          <Route path="scan-attendance" element={<ScanFacultyQR />} />
          <Route path="marks" element={
            <FeatureGuard featureKey="exams" title="Enter Marks">
              <EnterMarks />
            </FeatureGuard>
          } />
          <Route path="students" element={<ViewStudents />} />
          <Route path="announcements" element={
            <FeatureGuard featureKey="announcements" title="Announcements">
              <FacultyAnnouncements />
            </FeatureGuard>
          } />
          <Route path="timetable" element={
            <FeatureGuard featureKey="timetable" title="My Schedule">
              <FacultySchedule />
            </FeatureGuard>
          } />
          <Route path="notes" element={
            <FeatureGuard featureKey="notes" title="Class Notes">
              <FacultyNotes />
            </FeatureGuard>
          } />
          <Route path="assignments" element={
            <FeatureGuard featureKey="notes" title="Assignments">
              <FacultyAssignments />
            </FeatureGuard>
          } />
          <Route path="chat" element={
            <FeatureGuard featureKey="chat" title="Academic Chat">
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

export default function MobileFacultyRoutes() {
  const navigate = useNavigate();
  const home = "/faculty/dashboard";

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
        <Route path="/faculty/*" element={<FacultyArea />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </Suspense>
  );
}
