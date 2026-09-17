import { useNavigate } from "react-router-dom";
import { Plus, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import AdminPageLayout from "./AdminPageLayout";

function Instructors() {
  const navigate = useNavigate();

  return (
    <AdminPageLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-normal text-slate-950">
            Instructors
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-600">
            Manage instructor accounts and assignments
          </p>
        </div>
        <Button
          type="button"
          onClick={() => navigate("/instructors/add")}
          className="h-9 rounded-[5px] bg-[#0b4bd3] px-4 font-bold text-white hover:bg-[#083da9]"
        >
          <Plus className="size-4" />
          Add Instructor
        </Button>
      </div>

      <Card className="max-w-[960px] rounded-[5px] border border-slate-300 py-0 shadow-none ring-0">
        <CardContent className="grid gap-4 px-5 py-7 sm:px-8">
          <Users className="size-10 text-[#203b82]" />
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Instructor directory
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Use the add button to create an instructor account. The current
              backend exposes pending-user approval and program endpoints, but
              not a complete instructor listing endpoint yet.
            </p>
          </div>
          <Alert>
            <AlertTitle>Backend endpoint needed for full listing</AlertTitle>
            <AlertDescription>
              Expected future endpoint: GET /api/admin/users?role=instructor or
              equivalent.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </AdminPageLayout>
  );
}

export default Instructors;
