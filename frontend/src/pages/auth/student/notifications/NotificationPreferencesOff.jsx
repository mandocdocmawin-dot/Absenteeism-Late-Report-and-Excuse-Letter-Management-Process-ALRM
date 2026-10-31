import { Link } from "react-router-dom";

export default function NotificationPreferencesOff({ onClose }) {
  return <div className="py-4 text-sm">
    <p className="text-slate-600 dark:text-slate-400">Request updates are turned off.</p>
    <Link to="/settings" onClick={onClose} className="mt-3 inline-block font-semibold text-blue-700 hover:underline dark:text-blue-300">Manage notification preferences</Link>
  </div>;
}
