import AdminUserForm from "./AdminUserForm";

export default function AddStudent() {
  return <AdminUserForm title="Add Student" subtitle="Pre-register a student for institutional Google sign-in" sectionTitle="Student Information" submitLabel="Add Student" cancelPath="/students" parentLabel="Students" initialRole="student" lockRole />;
}
