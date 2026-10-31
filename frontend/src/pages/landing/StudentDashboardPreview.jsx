import { Bell, ClipboardList, FileText, LayoutDashboard, Settings, UserCircle } from "lucide-react";
import lvLogo from "@/assets/lv-logo-sidebar.webp";
import StudentDashboardHeading from "../auth/student/dashboard/StudentDashboardHeading";
import StudentDashboardMetrics from "../auth/student/StudentDashboardMetrics";
import RecentNotifications from "../auth/student/dashboard/RecentNotifications";

// Presentation components only: no authenticated layout, account, or API loaders.
const emptyResource = { data: [], loading: false, error: "" };

export default function StudentDashboardPreview() {
  return <figure className="landing-dashboard-preview" aria-label="Student dashboard preview with anonymous empty data">
    <div className="landing-preview-stage">
      <div className="landing-preview-window" inert aria-hidden="true">
        <aside className="landing-preview-sidebar">
          <img src={lvLogo} alt="" width="48" height="48" />
          {[LayoutDashboard, ClipboardList, FileText, Settings].map((Icon, index) => <span key={index} className={index === 0 ? "is-active" : ""}><Icon size={22} /></span>)}
        </aside>
        <div className="landing-preview-workspace">
          <header className="landing-preview-header"><span>Dashboard</span><div><Bell size={18} /><UserCircle size={26} /><span>Student</span></div></header>
          <div className="@container landing-preview-content">
            <StudentDashboardHeading user={null} classes={emptyResource} />
            <StudentDashboardMetrics requests={emptyResource} attendance={emptyResource} classes={emptyResource} />
            <RecentNotifications requests={[]} />
          </div>
        </div>
      </div>
    </div>
  </figure>;
}
