import { normalizeRole } from "../../lib/roles.js";
import { historicalRequestClass } from "../../lib/requestHistory.js";
import { auditActivity } from "../../pages/auth/admin/overviewData.js";
import { manilaDateKey } from "../../lib/manilaDate.js";

const recipients = {
  request_decision: ["student"],
  request_updated: ["student"],
  new_request: ["instructor"],
  request_followup: ["instructor"],
  followup_flag: ["program"],
  threshold_warning: ["student", "instructor", "program"],
  threshold_critical: ["student", "instructor", "program"],
  ir_escalation: ["student", "instructor", "program"],
  attendance_warning: ["instructor", "program"],
  attendance_ir: ["instructor", "program"],
  pending_staff_approval: ["admin"],
  class_assignment: ["instructor"],
  program_head_assignment: ["instructor", "program"],
  account_role_changed: ["student", "instructor", "program", "admin"],
  account_status_changed: ["student", "instructor", "program", "admin"],
};

function thresholdDetail(message) {
  const match = String(message).match(/([\d.]+) of ([\d.]+) allowable units; ([\d.]+)% of semester hours remaining before the IR limit/i);
  if (!match) return undefined;
  const used = Number(match[1]);
  const limit = Number(match[2]);
  const percentage = Number(match[3]);
  if (![used, limit, percentage].every(Number.isFinite)) return undefined;
  const remaining = Math.round(Math.max(0, limit - used) * 100) / 100;
  return `${remaining} units and ${percentage}% remaining before the absence limit.`;
}

function notificationLabel(type, message) {
  if (type === "threshold_warning" || type === "attendance_warning") return "Preventive attendance alert";
  if (type === "threshold_critical") return "Critical attendance alert";
  if (type === "ir_escalation" || type === "attendance_ir") return "Drop-limit attendance alert";
  if (type === "request_followup" || type === "followup_flag") return "Follow-up";
  if (["request_decision", "new_request", "request_updated"].includes(type)) {
    const requestType = /\blate\b/i.test(message) ? "Late" : /\babsence\b/i.test(message) ? "Absence" : "Request";
    const outcome = /\b(approved|noted)\b/i.test(message) ? " approved" : /\b(invalid|denied)\b/i.test(message) ? " invalid" : " update";
    return `${requestType}${outcome}`;
  }
  return undefined;
}

function destination(role, requestId, type) {
  const normalized = normalizeRole(role);
  if (["threshold_critical", "ir_escalation", "attendance_ir"].includes(type)) {
    if (normalized === "program") return "/program-head/activity-log?tab=flagged";
  }
  if (["account_role_changed", "account_status_changed"].includes(type)) return "/settings";
  if (type === "pending_staff_approval") return "/user-management";
  if (type === "class_assignment") return "/instructor/class-records";
  if (type === "program_head_assignment") return "/program-head/instructors";
  if (normalized === "instructor") return `/instructor/class-requests${requestId ? `?request=${encodeURIComponent(requestId)}` : ""}`;
  if (normalized === "program") return "/program-head/requests";
  if (normalized === "student") return `/student/records${requestId ? `?request=${encodeURIComponent(requestId)}` : ""}`;
  return "/dashboard";
}

export function notificationActivity(records, role, preferences, userId) {
  const normalizedRole = normalizeRole(role);
  const seen = new Set();
  return records.flatMap(record => {
    if (!record?.id || seen.has(record.id) || !record.message || !Number.isFinite(Date.parse(record.date_sent))) return [];
    if (userId != null && String(record.user_id) !== String(userId)) return [];
    // Preserve generic notices for their recipient; known events follow backend audiences.
    if (Object.hasOwn(recipients, record.type) && !recipients[record.type].includes(normalizedRole)) return [];
    seen.add(record.id);
    const threshold = ["threshold_warning", "threshold_critical", "ir_escalation", "attendance_warning", "attendance_ir"].includes(record.type);
    if (!(threshold ? preferences.thresholdAlerts : preferences.requestUpdates)) return [];
    const message = record.message;
    return [{ id: record.id, type: record.type, requestId: record.request_id, message, detail: threshold ? thresholdDetail(message) : undefined,
      label: notificationLabel(record.type, message), date: record.date_sent, isRead: record.is_read === true, href: destination(role, record.request_id, record.type) }];
  }).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

export function groupNotificationActivity(activity, filter = "all", now = new Date(), readIds) {
  const read = readIds || new Set(activity.filter(item => item.isRead).map(item => item.id));
  const visible = filter === "unread" ? activity.filter(item => !read.has(item.id)) : activity;
  const today = manilaDateKey(now);
  const groups = [
    { label: "Today", items: visible.filter(item => manilaDateKey(item.date) === today) },
    { label: "Earlier", items: visible.filter(item => manilaDateKey(item.date) !== today) },
  ];
  return groups.filter(group => group.items.length);
}

function activityAction(item) {
  if (!item.requestId) return "";
  if (["new_request", "submitted_request"].includes(item.type)) return "Submitted";
  if (item.type === "request_updated") return "Updated";
  if (item.type === "request_followup") return "Followed up";
  if (Object.hasOwn(recipients, item.type) && !["request_decision", "followup_flag"].includes(item.type)) return "";
  const message = item.message || "";
  if (/\bsubmitted\b/i.test(message)) return "Submitted";
  if (/\bupdated\b/i.test(message)) return "Updated";
  if (/\bcancelled\b/i.test(message)) return "Cancelled";
  if (/\bfollowed up\b/i.test(message)) return "Followed up";
  if (/\bapproved\b/i.test(message)) return "Approved";
  if (/\bnoted\b/i.test(message)) return "Approved";
  if (/\b(invalid|denied)\b/i.test(message)) return "Denied";
  if (/\bresolved\b.*\bfollow-up\b/i.test(message)) return "Resolved";
  return "";
}

function isSameAuditEvent(item, row) {
  const itemDate = Date.parse(item.date);
  const rowDate = Date.parse(row.date);
  return String(item.requestId) === String(row.requestId) && activityAction(item) === row.action
    && Number.isFinite(itemDate) && Number.isFinite(rowDate) && Math.abs(itemDate - rowDate) <= 5 * 60 * 1000;
}

export function mergeRequestActivity(activity, requests, user, readIds = new Set()) {
  if (normalizeRole(user.role) !== "instructor") return activity;
  const seen = new Set();
  const combined = activity.filter(item => {
    if (activityAction(item) !== "Submitted") return true;
    if (seen.has(String(item.requestId))) return false;
    seen.add(String(item.requestId));
    return true;
  });
  for (const request of requests) {
    const student = request?.enrollment?.student;
    const course = historicalRequestClass(request);
    if (!request?.id || seen.has(String(request.id)) || !["absence", "late"].includes(request.type)) continue;
    if (!student?.name || !course?.subject_name) continue;
    if (!Number.isFinite(Date.parse(request.date_submitted))) continue;
    seen.add(String(request.id));
    const id = `request-submitted:${request.id}`;
    combined.push({ id, type: "new_request", source: "request", readKey: `instructor:${user.id}`, requestId: request.id,
      message: `${student.name} submitted a new ${request.type} request for ${course.subject_name}.`,
      date: request.date_submitted, isRead: readIds.has(id), href: destination(user.role, request.id),
      readStatusTitle: "Request activity: read status is saved on this browser.",
      unreadTitle: "Unread request activity on this browser",
    });
  }
  return combined.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

function mergeAuditActivity(activity, logs, user, readIds, localKey, href) {
  const combined = [...activity];
  for (const row of auditActivity(logs)) {
    if (row.requestId && combined.some(item => isSameAuditEvent(item, row))) continue;
    const id = `audit-log:${row.id}`;
    const detail = row.subject === "Unavailable" ? "" : ` in ${row.subject}`;
    combined.push({ id, type: "audit_log", source: "audit", readKey: localKey, requestId: row.requestId,
      message: `${row.actor} ${row.description.charAt(0).toLowerCase()}${row.description.slice(1)} for ${row.student}${detail}.`,
      date: row.date, isRead: readIds.has(id), href,
      readStatusTitle: "Activity log notification: read status is saved on this browser.",
      unreadTitle: "Unread admin activity on this browser",
    });
  }
  return combined.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

export function mergeAdminAuditActivity(activity, logs, user, readIds = new Set()) {
  return normalizeRole(user.role) === "admin" ? mergeAuditActivity(activity, logs, user, readIds, `admin-activity:${user.id}`, "/activity-log") : activity;
}

export function mergeProgramAuditActivity(activity, logs, user, readIds = new Set()) {
  return normalizeRole(user.role) === "program" ? mergeAuditActivity(activity, logs, user, readIds, `program-activity:${user.id}`, "/program-head/activity-log") : activity;
}
