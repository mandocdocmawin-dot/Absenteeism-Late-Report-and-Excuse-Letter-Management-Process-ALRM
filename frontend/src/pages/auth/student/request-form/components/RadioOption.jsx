import OptionLabel from "./OptionLabel";

// Radio na pwedeng i-unselect kapag na-click ulit (same behavior as before).
export default function RadioOption({
  name,
  value,
  label,
  checked,
  onToggle,
  onChange,
}) {
  return (
    <OptionLabel>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onClick={(event) => onToggle(name, value, event)}
        onChange={(event) => onChange(name, event.target.value)}
        className="size-3.5 shrink-0 appearance-none rounded-full border border-slate-300 bg-white checked:border-[#203b82] checked:bg-[#203b82] checked:shadow-[inset_0_0_0_3px_white] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#203b82] disabled:opacity-100 forced-colors:appearance-auto forced-colors:shadow-none"
      />
      {label ?? value}
    </OptionLabel>
  );
}
