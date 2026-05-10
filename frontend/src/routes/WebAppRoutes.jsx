/**
 * Full web + all roles (loaded only when VITE_APP_VARIANT is web / unset).
 */

import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import ProtectedRoute from "./ProtectedRoute";
import LoadingSpinner from "../components/common/LoadingSpinner";

const Home = lazy(() => import("../pages/public/Home"));
const Pricing = lazy(() => import("../pages/public/PricingPage"));
const Contact = lazy(() => import("../pages/public/ContactPage"));
const PaymentAndCheckout = lazy(() => import("../pages/public/PaymentPage"));
const Terms = lazy(() => import("../pages/public/TermsPage"));
const Privacy = lazy(() => import("../pages/public/PrivacyPage"));
const InstitutePage = lazy(() => import("../pages/public/InstitutePage"));

const Login = lazy(() => import("../pages/auth/Login"));
const Register = lazy(() => import("../pages/public/RegisterPage"));
const ForgotPassword = lazy(() => import("../pages/auth/ForgotPassword"));
const SuspendedPage = lazy(() => import("../pages/public/SuspendedPage"));
const ChangePassword = lazy(() => import("../pages/auth/ChangePassword"));

const SuperAdminDashboard = lazy(() => import("../pages/superadmin/Dashboard"));
const Institutes = lazy(() => import("../pages/superadmin/Institutes"));
const Plans = lazy(() => import("../pages/superadmin/Plans"));
const Subscriptions = lazy(() => import("../pages/superadmin/Subscriptions"));
const Analytics = lazy(() => import("../pages/superadmin/Analytics"));
const Revenue = lazy(() => import("../pages/superadmin/Revenue"));
const SuperAdminSettings = lazy(() => import("../pages/superadmin/Settings"));
const SuperAdminExpenses = lazy(() => import("../pages/superadmin/Expenses"));
const LandingPage = lazy(() => import("../pages/superadmin/LandingPage"));
const InstituteLimits = lazy(() => import("../pages/superadmin/InstituteLimits"));

const AdminDashboard = lazy(() => import("../pages/admin/Dashboard"));
const Students = lazy(() => import("../pages/admin/Students"));
const Faculty = lazy(() => import("../pages/admin/Faculty"));
const Classes = lazy(() => import("../pages/admin/Classes"));
const Subjects = lazy(() => import("../pages/admin/Subjects"));
const Attendance = lazy(() => import("../pages/admin/Attendance"));
const Reports = lazy(() => import("../pages/admin/Reports"));
const Fees = lazy(() => import("../pages/admin/Fees"));
const Announcements = lazy(() => import("../pages/admin/Announcements"));
const Exams = lazy(() => import("../pages/admin/Exams"));
const Settings = lazy(() => import("../pages/admin/Settings"));
const Profile = lazy(() => import("../pages/admin/Profile"));
const Parents = lazy(() => import("../pages/admin/Parents"));
const AdminNotes = lazy(() => import("../pages/admin/AdminNotes"));
const ManageAdmins = lazy(() => import("../pages/admin/ManageAdmins"));
const AdminSmartAttendance = lazy(() => import("../pages/admin/SmartAttendance"));
const AdminExpenses = lazy(() => import("../pages/admin/Expenses"));
const AdminTimetable = lazy(() => import("../pages/admin/Timetable"));
const FinanceDashboard = lazy(() => import("../pages/admin/Finance"));
const FacultySalary = lazy(() => import("../pages/admin/FacultySalary"));
const AdminFacultyAttendance = lazy(() => import("../pages/admin/FacultyAttendance"));
const AdminFacultyViewAttendance = lazy(() => import("../pages/admin/AdminFacultyViewAttendance"));
const AdminManageFacultyAttendance = lazy(() => import("../pages/admin/AdminManageFacultyAttendance"));
const AdminBiometric = lazy(() => import("../pages/admin/Biometric"));
const AdminAssignments = lazy(() => import("../pages/admin/AdminAssignments"));
const AdminPublicPage = lazy(() => import("../pages/admin/PublicPage"));
const LifetimeAccess = lazy(() => import("../pages/admin/LifetimeAccess"));
const FacultyViewAttendance = lazy(() => import("../pages/faculty/ViewAttendance"));

const FacultyDashboard = lazy(() => import("../pages/faculty/Dashboard"));
const MarkAttendance = lazy(() => import("../pages/faculty/MarkAttendance"));
const EnterMarks = lazy(() => import("../pages/faculty/EnterMarks"));
const ViewStudents = lazy(() => import("../pages/faculty/ViewStudents"));
const FacultySmartAttendance = lazy(() => import("../pages/admin/SmartAttendance"));
const FacultyAnnouncements = lazy(() => import("../pages/faculty/Announcements"));
const FacultySchedule = lazy(() => import("../pages/faculty/MySchedule"));
const ScanFacultyQR = lazy(() => import("../pages/faculty/ScanFacultyQR"));
const FacultyNotes = lazy(() => import("../pages/faculty/FacultyNotes"));
const FacultyAssignments = lazy(() => import("../pages/faculty/Assignments"));
const ChatApp = lazy(() => import("../pages/chat/ChatApp"));

const StudentDashboard = lazy(() => import("../pages/student/Dashboard"));
const ViewAttendance = lazy(() => import("../pages/student/ViewAttendance"));
const ViewMarks = lazy(() => import("../pages/student/ViewMarks"));
const ViewAnnouncements = lazy(() => import("../pages/student/ViewAnnouncements"));
const PayFees = lazy(() => import("../pages/student/PayFees"));
const ScanAttendance = lazy(() => import("../pages/student/ScanAttendance"));
const StudentTimetable = lazy(() => import("../pages/student/Timetable"));
const StudentNotes = lazy(() => import("../pages/student/StudentNotes"));
const StudentAssignments = lazy(() => import("../pages/student/Assignments"));

const ParentDashboard = lazy(() => import("../pages/parent/Dashboard"));
const ParentTimetable = lazy(() => import("../pages/parent/Timetable"));
const ParentAssignments = lazy(() => import("../pages/parent/Assignments"));

const NotFound = lazy(() => import("../pages/common/NotFound"));
const Unauthorized = lazy(() => import("../pages/common/Unauthorized"));

import { Capacitor } from "@capacitor/core";

const PageLoader = () => (
  <div className="page-loader">
    <LoadingSpinner />
  </div>
);

export default function WebAppRoutes() {
  const isNative  = Capacitor.isNativePlatform();
  const navigate  = useNavigate();

  /**
   * Global navigation handler — listens for 'app_navigate' events dispatched
   * by api.js interceptors so ALL redirects (401 logout, 402 checkout, 403
   * suspend) flow through React Router instead of window.location.href.
   * This is critical for Capacitor WebView which breaks on hard location assigns.
   */
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
        <Route path="/" element={isNative ? <Navigate to="/login" replace /> : <Home />} />
        <Route path="/pricing" element={isNative ? <Navigate to="/login" replace /> : <Home />} />
        <Route path="/renew-plan" element={isNative ? <Navigate to="/login" replace /> : <Home />} />
        <Route path="/checkout" element={isNative ? <Navigate to="/login" replace /> : <PaymentAndCheckout />} />
        <Route path="/features" element={isNative ? <Navigate to="/login" replace /> : <Home />} />
        <Route path="/about" element={isNative ? <Navigate to="/login" replace /> : <Home />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/suspended" element={<SuspendedPage />} />
        <Route path="/student/change-password" element={
          <ProtectedRoute allowedRoles={["student"]} skipFirstLoginCheck={true}>
            <ChangePassword />
          </ProtectedRoute>
        } />
        <Route path="/i/:slug" element={<InstitutePage />} />

        <Route
          path="/superadmin/*"
          element={
            <ProtectedRoute allowedRoles={["super_admin"]}>
              <Routes>
                <Route path="dashboard" element={<SuperAdminDashboard />} />
                <Route path="institutes" element={<Institutes />} />
                <Route path="plans" element={<Plans />} />
                <Route path="subscriptions" element={<Subscriptions />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="revenue" element={<Revenue />} />
                <Route path="expenses" element={<SuperAdminExpenses />} />
                <Route path="settings" element={<SuperAdminSettings />} />
                <Route path="landing-page" element={<LandingPage />} />
                <Route path="institute-limits" element={<InstituteLimits />} />
                <Route path="*" element={<Navigate to="/superadmin/dashboard" />} />
              </Routes>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={["admin", "manager"]}>
              <Routes>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="admins" element={<ManageAdmins />} />
                <Route path="parents" element={<Parents />} />
                <Route path="students" element={<Students />} />
                <Route path="faculty" element={<Faculty />} />
                <Route path="classes" element={<Classes />} />
                <Route path="subjects" element={<Subjects />} />
                <Route path="attendance" element={<Attendance />} />
                <Route path="faculty-attendance" element={<AdminManageFacultyAttendance />} />
                <Route path="scan-faculty-qr" element={<AdminFacultyAttendance />} />
                <Route path="view-faculty-attendance" element={<AdminFacultyViewAttendance />} />
                <Route path="view-attendance" element={<FacultyViewAttendance />} />
                <Route path="smart-attendance" element={<AdminSmartAttendance />} />
                <Route path="reports" element={<Reports />} />
                <Route path="fees" element={<Fees />} />
                <Route path="announcements" element={<Announcements />} />
                <Route path="exams" element={<Exams />} />
                <Route path="timetable" element={<AdminTimetable />} />
                <Route path="expenses" element={<AdminExpenses />} />
                <Route path="finance" element={<FinanceDashboard />} />
                <Route path="salary" element={<FacultySalary />} />
                <Route path="settings" element={<Settings />} />
                <Route path="notes" element={<AdminNotes />} />
                <Route path="assignments" element={<AdminAssignments />} />
                <Route path="biometric" element={<AdminBiometric />} />
                <Route path="public-page" element={<AdminPublicPage />} />
                <Route path="chat-monitor" element={<ChatApp />} />
                <Route path="profile" element={<Profile />} />
                <Route path="lifetime" element={<LifetimeAccess />} />
                <Route path="*" element={<Navigate to="/admin/dashboard" />} />
              </Routes>
            </ProtectedRoute>
          }
        />

        <Route
          path="/faculty/*"
          element={
            <ProtectedRoute allowedRoles={["faculty"]}>
              <Routes>
                <Route path="dashboard" element={<FacultyDashboard />} />
                <Route path="attendance" element={<MarkAttendance />} />
                <Route path="view-attendance" element={<FacultyViewAttendance />} />
                <Route path="smart-attendance" element={<FacultySmartAttendance />} />
                <Route path="scan-attendance" element={<ScanFacultyQR />} />
                <Route path="marks" element={<EnterMarks />} />
                <Route path="students" element={<ViewStudents />} />
                <Route path="announcements" element={<FacultyAnnouncements />} />
                <Route path="timetable" element={<FacultySchedule />} />
                <Route path="notes" element={<FacultyNotes />} />
                <Route path="assignments" element={<FacultyAssignments />} />
                <Route path="chat" element={<ChatApp />} />
                <Route path="profile" element={<Profile />} />
                <Route path="*" element={<Navigate to="/faculty/dashboard" />} />
              </Routes>
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/*"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <Routes>
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
                <Route path="*" element={<Navigate to="/student/dashboard" />} />
              </Routes>
            </ProtectedRoute>
          }
        />

        <Route
          path="/parent/*"
          element={
            <ProtectedRoute allowedRoles={["parent"]}>
              <Routes>
                <Route path="dashboard" element={<ParentDashboard />} />
                <Route path="timetable" element={<ParentTimetable />} />
                <Route path="assignments" element={<ParentAssignments />} />
                <Route path="chat" element={<ChatApp />} />
                <Route path="profile" element={<Profile />} />
                <Route path="*" element={<Navigate to="/parent/dashboard" />} />
              </Routes>
            </ProtectedRoute>
          }
        />

        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
