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

const ParentDashboard = lazy(() => import("../pages/parent/Dashboard"));
const ParentTimetable = lazy(() => import("../pages/parent/Timetable"));
const ParentAssignments = lazy(() => import("../pages/parent/Assignments"));

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
          <Route path="timetable" element={<ParentTimetable />} />
          <Route path="assignments" element={<ParentAssignments />} />
          <Route path="chat" element={<ChatApp />} />
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
