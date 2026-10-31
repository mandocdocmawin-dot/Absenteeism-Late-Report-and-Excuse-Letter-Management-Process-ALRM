import schoolLogo from "@/assets/lv-logo-auth.webp";
import schoolPicture from "@/assets/LV_Picture.jpg";

export default function SchoolIdentityPanel() {
  return <section aria-label="ALRM System" className="relative hidden min-h-screen place-items-center overflow-hidden bg-[#111c30] text-white sm:grid">
    <img src={schoolPicture} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover" />
    <div aria-hidden="true" className="absolute inset-0 bg-[#111c30]/90" />
    <div className="relative -mt-[clamp(2rem,6.25vw,5rem)] grid justify-items-center gap-[clamp(1rem,2.5vw,2rem)] px-6 py-12 text-center lg:px-8">
      <img src={schoolLogo} alt="La Verdad Christian College logo" width="144" height="144" className="size-[clamp(5rem,10vw,9rem)] object-contain" />
      <div className="grid justify-items-center gap-[clamp(0.5rem,1.25vw,1rem)]">
        <p className="text-[clamp(1.5rem,3.75vw,3rem)] font-black text-white">ALRM SYSTEM</p>
        <p className="max-w-[260px] text-[clamp(0.75rem,1.5625vw,1.25rem)] font-normal leading-snug text-slate-100">Absence and Late Report Management System</p>
      </div>
    </div>
  </section>;
}
