import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { controlClass, normalizePhoneInput, phoneDigits } from "../utils";

export default function ContactNumberInput({ value, onChange, error, ...props }) {
  function pasteNumber(event) {
    const text = event.clipboardData.getData("text");
    if (!/^(?:639\d{9}|09\d{9}|9\d{9})$/.test(text.replace(/\D/g, ""))) return;
    event.preventDefault();
    onChange(normalizePhoneInput(text));
  }

  return <InputGroup className={controlClass(error, "h-11 rounded-[9px] shadow-none")}>
    <InputGroupAddon className="h-full shrink-0 rounded-l-[8px] border-r border-slate-200 bg-slate-50 px-3 font-semibold text-slate-700">
      <span aria-hidden="true">+63</span>
    </InputGroupAddon>
    <InputGroupInput
      {...props}
      name="contactNumber"
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      minLength={10}
      maxLength={10}
      pattern="9[0-9]{9}"
      aria-label="Contact number, 10 digits after +63, starting with 9"
      aria-invalid={Boolean(error)}
      placeholder="9XX-XXX-YYYY"
      value={phoneDigits(value)}
      onChange={(event) => onChange(normalizePhoneInput(event.target.value))}
      onPaste={pasteNumber}
      className="h-full text-sm text-slate-800"
    />
  </InputGroup>;
}
