import { CalendarDays, GraduationCap, UsersRound } from "lucide-react";
import FilterMenu, { RadioFilterGroup as FilterGroup } from "@/components/common/FilterMenu";
import { ROLE_LABELS } from "./userManagementData.js";
import { getSelectablePrograms } from "@/lib/programs";

const yearOptions = [{ value: "", label: "All years" }, { value: "1", label: "1st year" }, { value: "2", label: "2nd year" }, { value: "3", label: "3rd year" }, { value: "4", label: "4th year" }];
const statusOptions = [{ value: "", label: "All accounts" }, { value: "pending", label: "Awaiting first sign-in" }, { value: "approved", label: "Active accounts" }, { value: "deactivated", label: "Deactivated accounts" }];

export function UserFilterOptions({ filters, programs, loading, programError, disabled, onChange }) {
  return <div className="grid gap-3 divide-y divide-slate-100 [&>fieldset:not(:first-child)]:pt-3">
    <FilterGroup name="role" label="Role" value={filters.role} disabled={disabled} onChange={onChange}
      options={[{ value: "", label: "All roles" }, ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))]} />
    <FilterGroup name="program" label="Program" value={filters.program} disabled={disabled} onChange={onChange}
      options={[{ value: "", label: "All programs" }, ...getSelectablePrograms(programs).map(program => ({ value: String(program.id), label: program.program_name || program.name || "Unnamed program", disabled: loading || Boolean(programError) }))]} />
    {loading && <p role="status" className="text-xs text-slate-500">Loading programs…</p>}
    {programError && <p role="status" className="text-xs text-red-700">Programs could not be loaded.</p>}
    {filters.role === "student" && <FilterGroup name="year" label="Year" value={filters.year} disabled={disabled} onChange={onChange}
      options={yearOptions} />}
    <FilterGroup name="status" label="Account status" value={filters.status} disabled={disabled} onChange={onChange}
      options={statusOptions} />
  </div>;
}

export default function UserManagementFilters(props) {
  const { filters, programs, disabled, onChange } = props;
  const program = programs.find(program => String(program.id) === String(filters.program));
  const chips = [
    filters.role && { name: "role", label: `Role: ${ROLE_LABELS[filters.role] || filters.role}`, Icon: UsersRound },
    filters.program && { name: "program", label: `Program: ${program?.program_name || program?.name || "Selected program"}`, Icon: GraduationCap },
    filters.role === "student" && filters.year && { name: "year", label: `Year: ${yearOptions.find(option => option.value === filters.year)?.label || filters.year}`, Icon: CalendarDays },
    filters.status && { name: "status", label: statusOptions.find(option => option.value === filters.status)?.label || filters.status, reset: "", Icon: UsersRound },
  ].filter(Boolean);
  return <FilterMenu chips={chips} disabled={disabled} onChange={onChange}><UserFilterOptions {...props} /></FilterMenu>;
}
