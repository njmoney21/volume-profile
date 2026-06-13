import { TIMEZONES } from '@/lib/timezones'

export function TimezoneSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-white/[0.04] border border-white/10 rounded-lg text-xs text-gray-300 px-2 py-1.5 focus:outline-none focus:border-white/30"
    >
      {TIMEZONES.map(tz => (
        <option key={tz.value} value={tz.value} className="bg-black">
          {tz.label}
        </option>
      ))}
    </select>
  )
}
