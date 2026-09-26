import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Download,
  GraduationCap,
  Users,
  UsersRound,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { normalizeRole } from "@/lib/roles";
import AdminPageLayout from "./auth/admin/AdminPageLayout";
import InstructorDashboard from "./auth/instructor/InstructorDashboard";
import StudentDashboard from "./auth/student/StudentDashboard";

const summaryCards = [
  {
    label: "Total Students",
    value: "142",
    note: "Across 4 sections",
    icon: UsersRound,
  },
  {
    label: "Total Instructors",
    value: "24",
    note: "Active faculty members",
    icon: Users,
  },
  {
    label: "Total Programs",
    value: "6",
    note: "Academic programs",
    icon: GraduationCap,
  },
  {
    label: "Pending Requests",
    value: "6",
    note: "3 excuse notes, 3 late reports",
    icon: CalendarDays,
    highlighted: true,
  },
  {
    label: "Flagged / Escalated Cases",
    value: "9",
    note: "Across all classes today",
    icon: AlertTriangle,
    danger: true,
  },
];

const absenteeismRows = [
  { program: "BSIS", absentee: "18%", requests: 12 },
  { program: "ACT", absentee: "16%", requests: 9 },
  { program: "BSAIS", absentee: "10%", requests: 6 },
  { program: "BSIT", absentee: "8%", requests: 5 },
  { program: "BSEd", absentee: "7%", requests: 3 },
];

function roleLabel(role) {
  if (role === "administrator") return "Admin";
  if (role === "program_head") return "Program";
  if (role === "instructor") return "Instructor";
  if (role === "student") return "Student";

  return role || "User";
}

function AdminDashboard() {
  const { user } = useAuth();

  return (
    <AdminPageLayout>
      <div className="grid gap-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-4 inline-flex bg-slate-50 px-1 text-sm font-black uppercase text-[#0b367f] dark:bg-slate-900 dark:text-blue-300">
              Dashboard
            </p>
            <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-slate-50">
              Welcome back, {user?.name || roleLabel(user?.role)}!
            </h1>
            <p className="mt-1 text-lg font-medium text-slate-900 dark:text-slate-300">
              Here's your class overview
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              className="h-9 justify-start rounded-[5px] border-slate-300 px-3 text-xs font-semibold text-[#0b367f] dark:border-slate-700 dark:text-blue-300"
            >
              <CalendarDays className="size-4" />
              July 12 - July 18, 2026
            </Button>
            <Button
              type="button"
              className="h-9 rounded-[5px] bg-[#203b82] px-4 text-xs font-bold text-white hover:bg-[#172e68]"
            >
              <Download className="size-4" />
              Export
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;

            return (
              <Card
                key={card.label}
                className={[
                  "rounded-[5px] border py-0 shadow-none ring-0",
                  card.highlighted
                    ? "border-[#6aa8ff] bg-[#dcecff] dark:border-blue-500/50 dark:bg-blue-950/40"
                    : "border-slate-300 bg-slate-50 dark:border-slate-800 dark:bg-slate-900",
                ].join(" ")}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p
                        className={[
                          "text-xs font-black uppercase",
                          card.danger ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-300",
                          card.highlighted ? "text-[#0b4bd3]" : "",
                        ].join(" ")}
                      >
                        {card.label}
                      </p>
                      <p
                        className={[
                          "mt-3 text-3xl font-black leading-none",
                          card.danger ? "text-red-600 dark:text-red-400" : "text-slate-950 dark:text-slate-50",
                          card.highlighted ? "text-[#203b82]" : "",
                        ].join(" ")}
                      >
                        {card.value}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-400">
                        {card.note}
                      </p>
                    </div>
                    <Icon
                      className={[
                        "size-5",
                        card.danger ? "text-red-500" : "text-[#203b82]",
                      ].join(" ")}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-950 dark:text-slate-50">
                Absenteeism by Program
              </h2>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Overview of absenteeism rate and pending requests per program
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-8 rounded-[5px] px-2 text-sm font-black text-[#0b4bd3]"
            >
              View All
              <ArrowRight className="size-4" />
            </Button>
          </div>

          <div className="overflow-x-auto rounded-[5px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="min-w-[620px]">
              <div className="grid grid-cols-[1.2fr_1fr_1fr_auto] border-b border-[#9aa9cf] px-4 py-4 text-sm font-black text-[#203b82] dark:border-slate-700 dark:text-blue-300">
                <span>Program</span>
                <span>Absentee %</span>
                <span>Pending Requests</span>
                <span>Action</span>
              </div>
              {absenteeismRows.map((row) => (
                <div
                  key={row.program}
                  className="grid grid-cols-[1.2fr_1fr_1fr_auto] items-center border-b border-slate-200 px-4 py-4 text-sm last:border-b-0 dark:border-slate-800"
                >
                  <span className="font-semibold text-slate-950 dark:text-slate-100">
                    {row.program}
                  </span>
                  <span className="font-medium text-slate-950 dark:text-slate-100">
                    {row.absentee}
                  </span>
                  <span className="font-medium text-slate-950 dark:text-slate-100">
                    {row.requests}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-full text-[#0b4bd3]"
                    aria-label={`View ${row.program}`}
                  >
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AdminPageLayout>
  );
}

function UnsupportedDashboard() {
  const { user } = useAuth();

  return (
    <AdminPageLayout>
      <Alert className="max-w-2xl rounded-[5px] border-amber-200 bg-amber-50 text-amber-950">
        <AlertTriangle className="size-4" />
        <AlertTitle>Dashboard unavailable</AlertTitle>
        <AlertDescription>
          Your account role ({user?.role || "unknown"}) does not have a
          dashboard configured yet.
        </AlertDescription>
      </Alert>
    </AdminPageLayout>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);

  if (role === "student") return <StudentDashboard />;
  if (role === "instructor") return <InstructorDashboard />;
  if (role === "admin") return <AdminDashboard />;

  return <UnsupportedDashboard />;
}
