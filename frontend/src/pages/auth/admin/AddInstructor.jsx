import AdminUserForm from "./AdminUserForm";

export default function AddInstructor() {
  return <AdminUserForm title="Add Instructor" subtitle="Pre-register an instructor for institutional Google sign-in" sectionTitle="Instructor Information" submitLabel="Add Instructor" cancelPath="/instructors" parentLabel="Instructors" initialRole="instructor" lockRole />;
}
