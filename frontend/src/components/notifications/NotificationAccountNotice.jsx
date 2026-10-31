import { previewRoleLabel } from "@/lib/previewRole";

export default function NotificationAccountNotice({ user, audience }) {
  const required = previewRoleLabel(audience);
  return <div role="status" className="grid gap-2 border-l-4 border-blue-600 bg-blue-50 p-4 text-sm leading-relaxed text-slate-800">
    <p className="font-semibold">{required} account required</p>
    <p>Your signed-in account is {previewRoleLabel(user?.role)}. Dashboard previews do not change the account that receives notifications. Sign in with a {required.toLowerCase()} account to view this inbox.</p>
  </div>;
}
