import { createInstructor } from "@/api/adminUsers";
import { AdminUserForm, emailPattern, IdCard, Mail, User } from "./AdminUserForm";

const initialValues = {
  fullName: "",
  email: "",
  employeeId: "",
  programId: "",
  subjectHandled: "",
  status: "active",
};

const fields = [
  {
    name: "fullName",
    label: "Full Name",
    placeholder: "Enter full name",
    icon: User,
  },
  {
    name: "email",
    label: "Email Address",
    placeholder: "Enter email address",
    type: "email",
    icon: Mail,
  },
  {
    name: "employeeId",
    label: "Employee/Instructor ID",
    placeholder: "Enter instructor ID",
    icon: IdCard,
  },
  {
    name: "programId",
    label: "Program",
    type: "program",
  },
  {
    name: "subjectHandled",
    label: "Subject Handled",
    placeholder: "Enter subject handled",
  },
  {
    name: "status",
    label: "Account Status",
    type: "select",
    options: [
      { label: "Active", value: "active" },
      { label: "Inactive", value: "inactive" },
    ],
  },
];

function validate(values) {
  const errors = {};

  if (!values.fullName.trim()) errors.fullName = "Full name is required.";
  if (!values.email.trim()) {
    errors.email = "Email address is required.";
  } else if (!emailPattern.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!values.employeeId.trim()) {
    errors.employeeId = "Employee or instructor ID is required.";
  }
  if (!values.programId) errors.programId = "Program is required.";
  if (!values.subjectHandled.trim()) {
    errors.subjectHandled = "Subject handled is required.";
  }
  if (!values.status) errors.status = "Account status is required.";

  return errors;
}

function AddInstructor() {
  return (
    <AdminUserForm
      title="Add Instructor"
      subtitle="Create a new instructor account"
      sectionTitle="Instructor Information"
      submitLabel="Add Instructor"
      cancelPath="/instructors"
      initialValues={initialValues}
      fields={fields}
      validate={validate}
      createUser={createInstructor}
    />
  );
}

export default AddInstructor;
