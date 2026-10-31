import schoolLogo from "@/assets/lv-logo-auth.webp";
import schoolPicture from "@/assets/LV_Picture.jpg";

export default function MobileAuthBrand() {
  return <section aria-label="ALRM System" className="relative h-[60svh] min-h-80 shrink-0 overflow-hidden bg-[#132351] text-white sm:hidden">
    <img src={schoolPicture} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover object-center" />
    <div aria-hidden="true" className="absolute inset-0 bg-[#132351]/90" />
    <div className="relative grid justify-items-center gap-[clamp(0.875rem,5vw,1.25rem)] px-6 pt-[16svh] text-center">
      <img src={schoolLogo} alt="La Verdad Christian College logo" width="80" height="80" className="size-[clamp(3.5rem,18.5vw,5rem)] object-contain" />
      <div className="grid justify-items-center gap-1.5">
        <p className="text-[clamp(1.25rem,6.15vw,1.75rem)] font-bold text-white">ALRM SYSTEM</p>
        <p className="max-w-48 text-[clamp(0.625rem,2.6vw,0.75rem)] font-normal leading-snug text-white/90">Absence and Late Report<br />Management System</p>
      </div>
    </div>
  </section>;
}
