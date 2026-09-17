import { createStudent } from "@/api/adminUsers";
import { AdminUserForm, emailPattern, IdCard, Mail, User } from "./AdminUserForm";

const initialValues = {
  fullName: "",
  email: "",
  studentId: "",
  programId: "",
  yearLevel: "",
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
    name: "studentId",
    label: "Student ID",
    placeholder: "Enter student ID",
    icon: IdCard,
  },
  {
    name: "programId",
    label: "Program",
    type: "program",
  },
  {
    name: "yearLevel",
    label: "Year Level",
    placeholder: "Enter year level",
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
  if (!values.studentId.trim()) errors.studentId = "Student ID is required.";
  if (!values.programId) errors.programId = "Program is required.";
  if (!values.yearLevel.trim()) errors.yearLevel = "Year level is required.";
  if (!values.status) errors.status = "Account status is required.";

  return errors;
}

function AddStudent() {
  return (
    <AdminUserForm
      title="Add Student"
      subtitle="Create a new student account"
      sectionTitle="Student Information"
      submitLabel="Add Student"
      cancelPath="/students"
      initialValues={initialValues}
      fields={fields}
      validate={validate}
      createUser={createStudent}
    />
  );
}

export default AddStudent;
