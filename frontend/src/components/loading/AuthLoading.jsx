import { Spinner } from "@/components/ui/spinner";
import schoolLogo from "@/assets/lv-logo-auth.webp";

export default function AuthLoading({ label = "Signing you in..." }) {
  return <main data-slot="auth-loading" role="status" aria-label={label} aria-busy="true" className="grid min-h-screen place-items-center bg-white px-5 text-slate-900">
    <div className="grid justify-items-center gap-5 text-center">
      <img src={schoolLogo} alt="La Verdad Christian College logo" width="80" height="80" className="size-20 object-contain" />
      <div className="flex flex-col items-center gap-3">
        <Spinner aria-hidden="true" role={undefined} aria-label={undefined} className="size-5 animate-spin text-[#203b82]" />
        <span className="text-sm font-medium text-slate-600">{label}</span>
      </div>
    </div>
  </main>;
}
