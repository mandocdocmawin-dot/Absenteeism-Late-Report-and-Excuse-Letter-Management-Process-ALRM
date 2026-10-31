import { Button } from "@/components/ui/button";

export default function FormNavigation({
  backDisabled,
  nextDisabled,
  nextLabel = "Continue",
  onBack,
  onNext,
  submit,
}) {
  return (
    <div className="mt-2 flex items-center justify-between pt-5">
      <Button
        type="button"
        variant="outline"
        disabled={backDisabled}
        onClick={onBack}
        className={[
          "h-11 rounded-[9px] border-[1.5px] border-slate-200 px-5 text-sm font-bold text-slate-500 hover:text-slate-950",
          backDisabled ? "pointer-events-none opacity-0" : "",
        ].join(" ")}
      >
        Back
      </Button>
      <Button
        type={submit ? "submit" : "button"}
        disabled={nextDisabled}
        onClick={submit ? undefined : onNext}
        className="h-11 rounded-[9px] bg-[#101C4A] px-6 text-sm font-bold text-white hover:bg-[#1B2B6B]"
      >
        {nextLabel}
      </Button>
    </div>
  );
}
