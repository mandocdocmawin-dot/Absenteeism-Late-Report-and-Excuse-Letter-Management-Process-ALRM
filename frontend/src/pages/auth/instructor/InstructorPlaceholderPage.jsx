import { Card, CardContent } from "@/components/ui/card";
import InstructorPageLayout from "./InstructorPageLayout";

function InstructorPlaceholderPage({ description, title }) {
  return (
    <InstructorPageLayout>
      <div className="grid gap-6">
        <section>
          <p className="mb-4 inline-flex bg-slate-50 px-1 text-sm font-black uppercase text-[#0b367f] dark:bg-slate-900 dark:text-blue-300">
            {title}
          </p>
          <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-slate-50">
            {title}
          </h1>
          <p className="mt-1 text-lg font-medium text-slate-900 dark:text-slate-300">
            {description}
          </p>
        </section>

        <Card className="rounded-[5px] border border-slate-300 bg-slate-50 py-0 shadow-none ring-0 dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-5 text-sm font-medium text-slate-700 dark:text-slate-300">
            This instructor section is ready for real class data from the
            backend.
          </CardContent>
        </Card>
      </div>
    </InstructorPageLayout>
  );
}

export default InstructorPlaceholderPage;
