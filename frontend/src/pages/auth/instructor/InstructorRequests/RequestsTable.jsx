import StatusBadge from "@/components/dashboard/StatusBadge";
import ClassRecordsTable from "../InstructorClassRecords/ClassRecordsTable";
import { dueDate, formatDate, occurrenceDate, submittedDate } from "./requestData";

const columns = [
  { label: "Student" },
  { label: "Date of Occurrence" },
  { label: "Type" },
  { label: "Submitted" },
  { label: "Date of Due" },
  { label: "Request" },
  { label: "Action" },
];

export default function RequestsTable({ records, onReview, caption = "Class requests" }) {
  return <ClassRecordsTable columns={columns} caption={caption} empty={!records.length && "No requests match these filters."}>
    {records.map(record => <tr key={record.id} className="hover:bg-slate-50">
      <td className="break-words px-3 py-3">{record.enrollment?.student?.name || "Name unavailable"}</td>
      <td className="px-3 py-3">{formatDate(occurrenceDate(record))}</td>
      <td className="px-3 py-3">{record.type === "absence" ? "Absent" : "Late"}</td>
      <td className="px-3 py-3">{formatDate(submittedDate(record))}</td>
      <td className="px-3 py-3 text-sm font-normal text-slate-950">{formatDate(dueDate(record))}</td>
      <td className="px-3 py-3"><StatusBadge value={record.status} /></td>
      <td className="px-3 py-3"><button type="button" onClick={() => onReview(record)} aria-label={`View request for ${record.enrollment?.student?.name || "student"}`} className="inline-flex min-h-8 w-24 items-center justify-center rounded-[4px] bg-[#203B82] px-3 text-xs font-semibold text-white hover:bg-[#172B63] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">View</button></td>
    </tr>)}
  </ClassRecordsTable>;
}
