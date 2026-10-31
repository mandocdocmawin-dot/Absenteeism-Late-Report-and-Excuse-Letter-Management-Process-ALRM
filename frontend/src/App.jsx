import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import AppErrorBoundary from "./components/AppErrorBoundary";
import AuthLoading from "./components/loading/AuthLoading";
import SessionShellSkeleton from "./components/loading/SessionShellSkeleton";
import "./App.css";

const Login = lazy(() => import("./pages/login"));
const Home = lazy(() => import("./pages/Home"));
const SignedOut = lazy(() => import("./pages/auth/SignedOut"));
const AuthCallback = lazy(() => import("./pages/AuthCallback").then(module => ({ default: module.AuthCallback })));
const Dashboard = lazy(() => import("./pages/Dashboard").then(module => ({ default: module.Dashboard })));
const OtpVerification = lazy(() => import("./pages/OtpVerification"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const AddInstructor = lazy(() => import("./pages/auth/admin/AddInstructor"));
const AddStudent = lazy(() => import("./pages/auth/admin/AddStudent"));
const Instructors = lazy(() => import("./pages/auth/admin/Instructors"));
const AdminPageLayout = lazy(() => import("./pages/auth/admin/AdminPageLayout"));
const AdminWorkspace = lazy(() => import("./pages/auth/admin/AdminDashboard").then(module => ({ default: module.AdminDashboard })));
const AdminUserManagement = lazy(() => import("./pages/auth/admin/AdminUserManagement"));
const AdminProgramOverview = lazy(() => import("./pages/auth/admin/AdminProgramOverview"));
const AdminActivityLog = lazy(() => import("./pages/auth/admin/AdminActivityLog"));
const AdminManage = lazy(() => import("./pages/auth/admin/AdminManage"));
const StudentProfile = lazy(() => import("./pages/auth/admin/StudentProfile"));
const Students = lazy(() => import("./pages/auth/admin/Students"));
const Settings = lazy(() => import("./pages/auth/Settings"));
const Notifications = lazy(() => import("./pages/auth/Notifications"));
const InstructorClassRecords = lazy(() => import("./pages/auth/instructor/InstructorClassRecords"));
const InstructorRequests = lazy(() => import("./pages/auth/instructor/InstructorRequests"));
const ProgramHeadWorkspace = lazy(() => import("./pages/auth/programHead/ProgramHeadDashboard").then(module => ({ default: module.ProgramHeadDashboard })));
const ProgramHeadInstructors = lazy(() => import("./pages/auth/programHead/ProgramHeadInstructors").then(module => ({ default: module.ProgramHeadInstructors })));
const ProgramHeadInstructorDetail = lazy(() => import("./pages/auth/programHead/ProgramHeadInstructors").then(module => ({ default: module.ProgramHeadInstructorDetail })));
const ProgramHeadReports = lazy(() => import("./pages/auth/programHead/ProgramHeadReports").then(module => ({ default: module.ProgramHeadReports })));
const ProgramHeadPageLayout = lazy(() => import("./pages/auth/programHead/ProgramHeadPageLayout"));
const ProgramHeadActivityLog = lazy(() => import("./pages/auth/programHead/ProgramHeadActivityLog"));
const StudentRecords = lazy(() => import("./pages/auth/student/StudentRecords"));
const StudentNotificationsPage = lazy(() => import("./pages/auth/student/StudentNotificationsPage"));
const StudentRequestForm = lazy(() => import("./pages/auth/student/StudentRequestForm"));
const HttpErrorPage = lazy(() => import("./pages/HttpErrorPage"));

function RouteFallback() {
  const { pathname } = useLocation();
  const authPath = /^\/(login|verify-otp)\/*$/.test(pathname) || pathname.startsWith("/auth/");
  return authPath ? <AuthLoading label="Loading page..." /> : <SessionShellSkeleton />;
}

function App() {
  return (
    <BrowserRouter>
        <AuthProvider>
          <AppErrorBoundary><Suspense fallback={<RouteFallback />}>
            <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signed-out" element={<SignedOut />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/verify-otp" element={<OtpVerification />} />
          <Route path="/auth/otp" element={<OtpVerification />} />
          <Route
            path="/complete-profile"
            element={
              <ProtectedRoute allowedIncompleteProfile>
                <ProfileSetup />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Home />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/instructors"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Instructors />
              </ProtectedRoute>
            }
          />
          <Route path="/user-management" element={<ProtectedRoute allowedRoles={["admin"]}><AdminPageLayout><AdminUserManagement /></AdminPageLayout></ProtectedRoute>} />
          <Route path="/program-overview" element={<ProtectedRoute allowedRoles={["admin"]}><AdminPageLayout><AdminProgramOverview /></AdminPageLayout></ProtectedRoute>} />
          <Route path="/activity-log" element={<ProtectedRoute allowedRoles={["admin"]}><AdminPageLayout><AdminActivityLog /></AdminPageLayout></ProtectedRoute>} />
          <Route path="/manage" element={<ProtectedRoute allowedRoles={["admin"]}><AdminPageLayout><AdminManage /></AdminPageLayout></ProtectedRoute>} />
          <Route path="/programs" element={<ProtectedRoute allowedRoles={["admin"]}><AdminPageLayout><AdminWorkspace view="programs" /></AdminPageLayout></ProtectedRoute>} />
          <Route path="/classes" element={<ProtectedRoute allowedRoles={["admin"]}><AdminPageLayout><AdminWorkspace view="classes" /></AdminPageLayout></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute allowedRoles={["admin"]}><AdminPageLayout><AdminWorkspace view="reports" /></AdminPageLayout></ProtectedRoute>} />
          <Route path="/program-head/requests" element={<ProtectedRoute allowedRoles={["program"]}><ProgramHeadPageLayout><ProgramHeadWorkspace view="requests" /></ProgramHeadPageLayout></ProtectedRoute>} />
          <Route path="/program-head/flagged" element={<ProtectedRoute allowedRoles={["program"]}><ProgramHeadPageLayout><ProgramHeadWorkspace view="flagged" /></ProgramHeadPageLayout></ProtectedRoute>} />
          <Route path="/program-head/instructors" element={<ProtectedRoute allowedRoles={["program"]}><ProgramHeadPageLayout><ProgramHeadInstructors /></ProgramHeadPageLayout></ProtectedRoute>} />
          <Route path="/program-head/instructors/:instructorId" element={<ProtectedRoute allowedRoles={["program"]}><ProgramHeadPageLayout><ProgramHeadInstructorDetail /></ProgramHeadPageLayout></ProtectedRoute>} />
          <Route path="/program-head/reports" element={<ProtectedRoute allowedRoles={["program"]}><ProgramHeadPageLayout><ProgramHeadReports /></ProgramHeadPageLayout></ProtectedRoute>} />
          <Route path="/program-head/activity-log" element={<ProtectedRoute allowedRoles={["program"]}><ProgramHeadPageLayout><ProgramHeadActivityLog /></ProgramHeadPageLayout></ProtectedRoute>} />
          <Route
            path="/instructors/add"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AddInstructor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/students"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Students />
              </ProtectedRoute>
            }
          />
          <Route
            path="/students/add"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AddStudent />
              </ProtectedRoute>
            }
          />
          <Route
            path="/students/:studentId"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <StudentProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/instructor/class-records"
            element={
              <ProtectedRoute allowedRoles={["instructor"]}>
                <InstructorClassRecords />
              </ProtectedRoute>
            }
          />
          <Route path="/instructor/class-records/:classId" element={<ProtectedRoute allowedRoles={["instructor"]}><InstructorClassRecords /></ProtectedRoute>} />
          <Route
            path="/instructor/class-requests"
            element={
              <ProtectedRoute allowedRoles={["instructor"]}>
                <InstructorRequests />
              </ProtectedRoute>
            }
          />
          <Route path="/instructor/class-requests/:classId" element={<ProtectedRoute allowedRoles={["instructor"]}><InstructorRequests /></ProtectedRoute>} />
          <Route
            path="/student/records"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentRecords />
              </ProtectedRoute>
            }
          />
          <Route path="/student/notifications" element={<ProtectedRoute allowedRoles={["student"]}><StudentNotificationsPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route
            path="/student/request"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentRequestForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
              <Route path="/400" element={<HttpErrorPage status={400} />} />
              <Route path="/401" element={<HttpErrorPage status={401} />} />
              <Route path="/403" element={<HttpErrorPage status={403} />} />
              <Route path="/404" element={<HttpErrorPage status={404} />} />
              <Route path="/500" element={<HttpErrorPage status={500} />} />
              <Route path="/503" element={<HttpErrorPage status={503} />} />
              <Route path="*" element={<HttpErrorPage status={404} />} />
            </Routes>
          </Suspense></AppErrorBoundary>
        </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
