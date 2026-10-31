import { cn } from "@/lib/utils";
import StudentDashboardPlaceholder from "./StudentDashboardPlaceholder";
import StaffDashboardPlaceholder from "./StaffDashboardPlaceholder";
import InstructorDashboardPlaceholder from "./InstructorDashboardPlaceholder";

export default function DashboardSkeleton({ variant = "student", label = "Loading dashboard...", className }) {
  return <div data-slot="dashboard-skeleton" data-variant={variant} role="status" aria-label={label} aria-busy="true" className={cn("@container w-full min-w-0", className)}>
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="min-w-0">
      {variant === "student" ? <StudentDashboardPlaceholder /> : variant === "instructor" ? <InstructorDashboardPlaceholder /> : <StaffDashboardPlaceholder variant={variant} />}
    </div>
  </div>;
}
