import { Card, CardContent } from "@/components/ui/card";
import StudentPageLayout from "./StudentPageLayout";

function StudentPlaceholderPage({ description, title }) {
  return (
    <StudentPageLayout>
      <div className="grid gap-6">
        <section>
          <p className="mb-4 inline-flex bg-slate-50 px-1 text-sm font-black uppercase text-[#0b367f]">
            {title}
          </p>
          <h1 className="text-2xl font-black tracking-normal text-slate-950">
            {title}
          </h1>
          <p className="mt-1 text-lg font-medium text-slate-900">
            {description}
          </p>
        </section>

        <Card className="rounded-[5px] border border-slate-300 bg-slate-50 py-0 shadow-none ring-0">
          <CardContent className="p-5 text-sm font-medium text-slate-700">
            This student section is ready for real records from the backend.
          </CardContent>
        </Card>
      </div>
    </StudentPageLayout>
  );
}

export default StudentPlaceholderPage;
