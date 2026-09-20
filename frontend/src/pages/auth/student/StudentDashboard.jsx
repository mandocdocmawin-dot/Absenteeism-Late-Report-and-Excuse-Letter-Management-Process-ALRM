import { CalendarDays, ClipboardList, FileText, Settings } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import StudentPageLayout from "./StudentPageLayout";

const dashboardCards = [
  {
    label: "My Records",
    value: "0",
    note: "Attendance entries available for review",
    icon: ClipboardList,
  },
  {
    label: "Pending Requests",
    value: "0",
    note: "Excuse or late requests awaiting review",
    icon: FileText,
  },
  {
    label: "This Week",
    value: "0",
    note: "Recorded absence or late items",
    icon: CalendarDays,
  },
  {
    label: "Settings",
    value: "Ready",
    note: "Manage account preferences",
    icon: Settings,
  },
];

function StudentDashboard() {
  const { user } = useAuth();

  return (
    <StudentPageLayout>
      <div className="grid gap-6">
        <section>
          <p className="mb-4 inline-flex bg-slate-50 px-1 text-sm font-black uppercase text-[#0b367f]">
            Dashboard
          </p>
          <h1 className="text-2xl font-black tracking-normal text-slate-950">
            Welcome back, {user?.name || "Student"}!
          </h1>
          <p className="mt-1 text-lg font-medium text-slate-900">
            Here's your student overview
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {dashboardCards.map((card) => {
            const Icon = card.icon;

            return (
              <Card
                key={card.label}
                className="rounded-[5px] border border-slate-300 bg-slate-50 py-0 shadow-none ring-0"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase text-slate-800">
                        {card.label}
                      </p>
                      <p className="mt-3 text-3xl font-black leading-none text-slate-950">
                        {card.value}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-700">
                        {card.note}
                      </p>
                    </div>
                    <Icon className="size-5 text-[#203b82]" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      </div>
    </StudentPageLayout>
  );
}

export default StudentDashboard;
