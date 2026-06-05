/**
 * Native shell: student role only (bundled when VITE_APP_VARIANT=student).
 */

import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import ProtectedRoute from "./ProtectedRoute";
import LoadingSpinner from "../components/common/LoadingSpinner";

const Login = lazy(() => import("../pages/auth/Login"));
const ForgotPassword = lazy(() => import("../pages/auth/ForgotPassword"));
const Terms = lazy(() => import("../pages/public/TermsPage"));
const Privacy = lazy(() => import("../pages/public/PrivacyPage"));
const Profile = lazy(() => import("../pages/admin/Profile"));
const ChatApp = lazy(() => import("../pages/chat/ChatApp"));
const Unauthorized = lazy(() => import("../pages/common/Unauthorized"));

const StudentDashboard = lazy(() => import("../pages/student/Dashboard"));
const ViewAttendance = lazy(() => import("../pages/student/ViewAttendance"));
const ViewMarks = lazy(() => import("../pages/student/ViewMarks"));
const ViewAnnouncements = lazy(() => import("../pages/student/ViewAnnouncements"));
const PayFees = lazy(() => import("../pages/student/PayFees"));
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

const StudentLayout = lazy(() => import("../components/layout/StudentLayout"));

function StudentArea() {
  return (
    <ProtectedRoute allowedRoles={["student"]}>
      <Routes>
        <Route path="/" element={<StudentLayout />}>
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="attendance" element={<ViewAttendance />} />
          <Route path="scan-attendance" element={<ScanAttendance />} />
          <Route path="exams" element={<ViewMarks />} />
          <Route path="announcements" element={<ViewAnnouncements />} />
          <Route path="fees" element={<PayFees />} />
          <Route path="buy-plan" element={<Pricing />} />
          <Route path="timetable" element={<StudentTimetable />} />
          <Route path="notes" element={<StudentNotes />} />
          <Route path="assignments" element={<StudentAssignments />} />
          <Route path="chat" element={<ChatApp />} />
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
