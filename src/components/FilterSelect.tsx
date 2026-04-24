"use client";

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="flex min-w-[90px] flex-1 flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full cursor-pointer appearance-none rounded-md border border-border bg-cream2 py-[7px] pl-2.5 pr-6 text-xs text-text outline-none transition-all focus:border-navy focus:bg-white"
      >
        <option value="">Todas</option>
        {options.map(o => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
