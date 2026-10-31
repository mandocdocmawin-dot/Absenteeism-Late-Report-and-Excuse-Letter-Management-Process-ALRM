function numberValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function AttendanceGauge({ used, limit, color }) {
  const usedValue = numberValue(used);
  const limitValue = numberValue(limit);
  const hasData = usedValue !== null && limitValue !== null && limitValue > 0;
  const percent = hasData ? Math.min(Math.max(usedValue / limitValue, 0), 1) * 100 : 0;
  const circumference = 2 * Math.PI * 48;

  return <div role="progressbar" aria-label="Backend attendance contact-hour usage" aria-valuemin={0} aria-valuemax={limitValue ?? undefined} aria-valuenow={usedValue ?? undefined} aria-valuetext={hasData ? `${usedValue} of ${limitValue} contact hours used` : "Attendance threshold unavailable"} className="relative size-[108px] shrink-0">
    <svg aria-hidden="true" viewBox="0 0 108 108" className="size-[108px] [--gauge-track:#eceaea] dark:[--gauge-track:#334155]">
      <circle cx={54} cy={54} r={48} fill="none" stroke="var(--gauge-track)" strokeWidth={11} />
      {percent > 0 && <circle cx={54} cy={54} r={48} fill="none" stroke={color} strokeWidth={11} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percent / 100)} transform="rotate(-90 54 54)" />}
    </svg>
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <span className="text-[18px] font-bold leading-5">{hasData ? `${Math.round(percent)}%` : "—"}</span>
      <span className="mt-0.5 text-[10px] leading-3">of backend limit</span>
    </div>
  </div>;
}
