import { useMemo, useState } from "react";
import {
  AlertCircle,
  Bell,
  KeyRound,
  Mail,
  Settings as SettingsIcon,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import AdminPageLayout from "./admin/AdminPageLayout";

const ROLE_CONFIG = {
  administrator: {
    pageTitle: "Settings",
    pageDescription: "Manage your administrator profile and system settings.",
    profileTitle: "Admin Profile",
    profileDescription: "Your ALRM administrator account details.",
    preferencesTitle: "Notification Channel",
    preferencesDescription:
      "System notification channels currently supported by the backend.",
  },
  program_head: {
    pageTitle: "Settings",
    pageDescription: "Manage your program profile and preferences.",
    profileTitle: "Program Profile",
    profileDescription: "Your ALRM program account details.",
    preferencesTitle: "Program Preferences",
    preferencesDescription:
      "Notifications related to students, requests, and escalations in your program.",
  },
  instructor: {
    pageTitle: "Settings",
    pageDescription: "Manage your instructor profile and notification settings.",
    profileTitle: "Instructor Profile",
    profileDescription: "Your ALRM instructor account details.",
    preferencesTitle: "Notification Preferences",
    preferencesDescription:
      "Notifications for student excuse letters, late reports, and attendance updates.",
  },
  student: {
    pageTitle: "Settings",
    pageDescription: "Manage your student profile and notification settings.",
    profileTitle: "Student Profile",
    profileDescription: "Your ALRM student account details.",
    preferencesTitle: "Notification Preferences",
    preferencesDescription:
      "Notifications for request updates and attendance-related account activity.",
  },
};

const roleAliases = {
  admin: "administrator",
  administrator: "administrator",
  program: "program_head",
  program_head: "program_head",
  "program-head": "program_head",
  "program head": "program_head",
  instructor: "instructor",
  student: "student",
};

function normalizeRole(role) {
  const key = String(role || "")
    .trim()
    .toLowerCase();

  return roleAliases[key] || null;
}

function formatRole(role) {
  const normalized = normalizeRole(role);

  if (normalized === "administrator") return "Admin";
  if (normalized === "program_head") return "Program";
  if (normalized === "instructor") return "Instructor";
  if (normalized === "student") return "Student";

  return role || "Unknown";
}

function valueOrFallback(value, fallback = "Not available") {
  if (value === null || value === undefined || value === "") return fallback;

  return String(value);
}

function programLabel(user) {
  return (
    user?.program?.program_name ||
    user?.headed_program?.program_name ||
    user?.program_name ||
    (user?.program_id ? `Program ID ${user.program_id}` : "Not assigned")
  );
}

function userInitials(name) {
  const parts = String(name || "ALRM")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function ReadOnlyField({ label, value }) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs font-bold text-slate-700">{label}</Label>
      <Input
        readOnly
        value={valueOrFallback(value)}
        className="h-10 rounded-[5px] border-slate-300 bg-slate-50 text-sm font-medium text-slate-800"
      />
    </div>
  );
}

function SettingsCard({ icon: Icon, title, description, children }) {
  return (
    <Card className="rounded-[6px] border border-slate-200 bg-white py-0 shadow-none ring-0">
      <CardHeader className="border-b border-slate-100 px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[6px] bg-[#203b82]/10 text-[#203b82]">
            <Icon className="size-5" strokeWidth={2.1} />
          </div>
          <div>
            <CardTitle className="text-base font-black text-slate-950">
              {title}
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-slate-600">
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 py-5 sm:px-6">{children}</CardContent>
    </Card>
  );
}

function UnsupportedActionAlert({ notice }) {
  if (!notice) return null;

  return (
    <Alert className="mb-5 border-amber-200 bg-amber-50 text-amber-950">
      <AlertCircle className="size-4" />
      <AlertTitle>{notice.title}</AlertTitle>
      <AlertDescription className="text-amber-900">
        {notice.description}
      </AlertDescription>
    </Alert>
  );
}

function ProfileCard({ user, config, role, onUnsupported }) {
  const normalizedRole = normalizeRole(role);
  const fields = [
    { label: "Name", value: user?.name },
    { label: "Email", value: user?.email },
    { label: "Role", value: formatRole(user?.role) },
    { label: "Account Status", value: user?.status },
  ];

  if (normalizedRole === "program_head") {
    fields.push({ label: "Program", value: programLabel(user) });
  }

  if (normalizedRole === "instructor") {
    fields.push({ label: "Instructor ID", value: user?.employee_id || user?.id });
    fields.push({ label: "Program", value: programLabel(user) });
  }

  if (normalizedRole === "student") {
    fields.push({ label: "Student ID", value: user?.student_id || user?.id });
    fields.push({ label: "Program / Section", value: programLabel(user) });
    fields.push({ label: "Year Level", value: user?.year_level });
  }

  return (
    <SettingsCard
      icon={UserRound}
      title={config.profileTitle}
      description={config.profileDescription}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 bg-slate-100 text-slate-700">
            <AvatarFallback className="text-lg font-black">
              {userInitials(user?.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-black text-slate-950">
              {valueOrFallback(user?.name, "Current user")}
            </p>
            <p className="text-sm font-medium text-slate-600">
              {valueOrFallback(user?.email)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-[5px] border-slate-300 font-bold text-[#0b367f]"
            onClick={() =>
              onUnsupported(
                "Profile editing unavailable",
                "The backend currently exposes GET /api/me for reading the current user, but no profile update endpoint is registered."
              )
            }
          >
            Change Profile
          </Button>
          <Button
            type="button"
            className="h-9 rounded-[5px] bg-[#0b4bd3] font-bold text-white hover:bg-[#083da9]"
            onClick={() =>
              onUnsupported(
                "Profile editing unavailable",
                "No backend route is available for updating the current user's profile from Settings."
              )
            }
          >
            Edit Profile
          </Button>
        </div>
      </div>

      <Separator className="my-5" />

      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <ReadOnlyField key={field.label} label={field.label} value={field.value} />
        ))}
      </div>
    </SettingsCard>
  );
}

function AdminPolicyCard() {
  const policies = [
    {
      label: "Late conversion",
      value: "3 late reports = 1 converted absence",
    },
    {
      label: "Warning threshold",
      value: "2 converted absences",
    },
    {
      label: "IR threshold",
      value: "3 converted absences",
    },
    {
      label: "Policy management",
      value: "Read-only in frontend",
    },
  ];

  return (
    <SettingsCard
      icon={SettingsIcon}
      title="Absenteeism & Late Policy"
      description="Current attendance policy behavior enforced by the backend."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {policies.map((policy) => (
          <div
            key={policy.label}
            className="rounded-[5px] border border-slate-200 bg-slate-50 p-4"
          >
            <p className="text-xs font-bold uppercase text-slate-500">
              {policy.label}
            </p>
            <p className="mt-1 text-sm font-black text-slate-950">
              {policy.value}
            </p>
          </div>
        ))}
      </div>
      <Alert className="mt-4 border-slate-200 bg-white">
        <AlertCircle className="size-4" />
        <AlertTitle>Policy settings endpoint not exposed</AlertTitle>
        <AlertDescription>
          These values were verified from the existing backend attendance logic.
          There is no registered API route for editing policy settings.
        </AlertDescription>
      </Alert>
    </SettingsCard>
  );
}

function NotificationCard({ config, onUnsupported }) {
  const channels = [
    {
      label: "In-app Notifications",
      description: "Alerts inside the ALRM system.",
    },
    {
      label: "School Email",
      description: "Messages sent to the authenticated LV email account.",
    },
  ];

  return (
    <SettingsCard
      icon={Bell}
      title={config.preferencesTitle}
      description={config.preferencesDescription}
    >
      <div className="grid gap-3">
        {channels.map((channel) => (
          <div
            key={channel.label}
            className="flex flex-col gap-3 rounded-[5px] border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-black text-slate-950">
                {channel.label}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {channel.description}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500">
                Managed by system
              </span>
              <Switch checked={false} disabled aria-label={channel.label} />
            </div>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        className="mt-4 h-9 rounded-[5px] border-slate-300 font-bold text-[#0b367f]"
        onClick={() =>
          onUnsupported(
            "Notification preferences unavailable",
            "The backend has notification records, but no preference endpoint is registered for reading or saving per-user notification channels."
          )
        }
      >
        Manage Notifications
      </Button>
    </SettingsCard>
  );
}

function SecurityCard({ user, onUnsupported }) {
  return (
    <SettingsCard
      icon={ShieldCheck}
      title="Account & Security"
      description="Security information for your authenticated ALRM session."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[5px] border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-950">
            <Mail className="size-4 text-[#203b82]" />
            <p className="text-sm font-black">Google Account</p>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {valueOrFallback(user?.email)} is managed through LV Google OAuth.
          </p>
        </div>

        <div className="rounded-[5px] border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-950">
            <KeyRound className="size-4 text-[#203b82]" />
            <p className="text-sm font-black">Password</p>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Password changes are handled by the LV Google account provider.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-[5px] border-slate-300 font-bold text-[#0b367f]"
          onClick={() =>
            onUnsupported(
              "Password change unavailable",
              "No change-password API route exists in the current backend. This login flow uses Google OAuth."
            )
          }
        >
          Change Password
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-[5px] border-slate-300 font-bold text-[#0b367f]"
          onClick={() =>
            onUnsupported(
              "Security settings unavailable",
              "No account-security settings endpoint is registered for the frontend to update."
            )
          }
        >
          Account Security
        </Button>
      </div>
    </SettingsCard>
  );
}

function UnknownRoleState({ role }) {
  return (
    <AdminPageLayout>
      <div className="max-w-3xl">
        <h1 className="text-2xl font-black tracking-normal text-slate-950">
          Settings
        </h1>
        <Alert variant="destructive" className="mt-5">
          <AlertCircle className="size-4" />
          <AlertTitle>Settings unavailable</AlertTitle>
          <AlertDescription>
            Your account role ({valueOrFallback(role, "unknown")}) is not
            supported by the Settings page. Please contact an administrator.
          </AlertDescription>
        </Alert>
      </div>
    </AdminPageLayout>
  );
}

function Settings() {
  const { user, loading } = useAuth();
  const [notice, setNotice] = useState(null);

  const normalizedRole = useMemo(() => normalizeRole(user?.role), [user?.role]);
  const config = normalizedRole ? ROLE_CONFIG[normalizedRole] : null;

  function showUnsupported(title, description) {
    setNotice({ title, description });
  }

  if (loading) {
    return (
      <AdminPageLayout>
        <p className="text-sm font-medium text-slate-600">
          Loading settings...
        </p>
      </AdminPageLayout>
    );
  }

  if (!config) {
    return <UnknownRoleState role={user?.role} />;
  }

  return (
    <AdminPageLayout>
      <div className="mx-auto grid max-w-6xl gap-5">
        <div>
          <h1 className="text-2xl font-black tracking-normal text-slate-950">
            {config.pageTitle}
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-600">
            {config.pageDescription}
          </p>
        </div>

        <UnsupportedActionAlert notice={notice} />

        <div className="grid gap-5">
          <ProfileCard
            user={user}
            role={user?.role}
            config={config}
            onUnsupported={showUnsupported}
          />

          {normalizedRole === "administrator" && <AdminPolicyCard />}

          <NotificationCard
            config={config}
            onUnsupported={showUnsupported}
          />

          <SecurityCard user={user} onUnsupported={showUnsupported} />
        </div>
      </div>
    </AdminPageLayout>
  );
}

export default Settings;
