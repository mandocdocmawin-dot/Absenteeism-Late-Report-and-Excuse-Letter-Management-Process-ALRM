import { ClipboardList, FileText, UsersRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import InstructorPageLayout from "./InstructorPageLayout";

const dashboardCards = [
  {
    label: "Class Records",
    value: "0",
    note: "Attendance records ready for review",
    icon: ClipboardList,
  },
  {
    label: "Class Requests",
    value: "0",
    note: "Student requests awaiting action",
    icon: FileText,
  },
  {
    label: "Students",
    value: "0",
    note: "Students across assigned classes",
    icon: UsersRound,
  },
];

function InstructorDashboard() {
  const { user } = useAuth();

  return (
    <InstructorPageLayout>
      <div className="grid gap-6">
        <section>
          <p className="mb-4 inline-flex bg-slate-50 px-1 text-sm font-black uppercase text-[#0b367f] dark:bg-slate-900 dark:text-blue-300">
            Dashboard
          </p>
          <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-slate-50">
            Welcome back, {user?.name || "Instructor"}!
          </h1>
          <p className="mt-1 text-lg font-medium text-slate-900 dark:text-slate-300">
            Here's your class overview
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {dashboardCards.map((card) => {
            const Icon = card.icon;

            return (
              <Card
                key={card.label}
                className="rounded-[5px] border border-slate-300 bg-slate-50 py-0 shadow-none ring-0 dark:border-slate-800 dark:bg-slate-900"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase text-slate-800 dark:text-slate-300">
                        {card.label}
                      </p>
                      <p className="mt-3 text-3xl font-black leading-none text-slate-950 dark:text-slate-50">
                        {card.value}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-400">
                        {card.note}
                      </p>
                    </div>
                    <Icon className="size-5 text-[#203b82] dark:text-blue-300" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      </div>
    </InstructorPageLayout>
  );
}

export default InstructorDashboard;
