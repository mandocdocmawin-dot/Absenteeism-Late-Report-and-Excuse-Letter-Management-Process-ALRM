# School ID Number Profile Design

## Intent

Use the backend `User.school_id_number` contract for the human-entered school identifier. Instructors enter this value as “Instructor ID”; students continue to see “Student ID”. Internal user UUIDs must not appear as editable identity values.

## Constraints

- The backend model, resource, controller, migration, and feature tests already implement `school_id_number`; do not add another database field.
- Program Heads continue to skip profile setup after login.
- Use JavaScript/JSX and existing form components.
- Preserve backend uniqueness and validation errors.

## Approach

Align the frontend with the renamed backend field everywhere it consumes or sends a school ID. The profile form uses one `schoolIdNumber` state value, labels it by role, requires it for students and instructors, sends `school_id_number`, and maps backend errors to the same input. Student/admin display consumers read the renamed response property.

Compatibility aliases were rejected because the backend migration and resource intentionally remove `school_student_id`; retaining the obsolete name would hide contract drift and keep profile completion broken.

## Success Criteria

- Instructors type an actual Instructor ID instead of seeing the database UUID.
- Successful profile submission sends `school_id_number` to the backend.
- Students and existing school-ID displays continue to work with the renamed response field.
- Program Heads still bypass profile setup.
