'use client'

const OPTIONS = ['STITCHED', 'UNSTITCHED'] as const
type StitchingOption = typeof OPTIONS[number]

interface Props {
  value: string[]
  onChange: (value: string[]) => void
}

export default function StitchingOptionsSelector({ value, onChange }: Props) {
  function toggle(opt: StitchingOption) {
    if (value.includes(opt)) {
      onChange(value.filter(v => v !== opt))
    } else {
      onChange([...value, opt])
    }
  }

  return (
    <div className="flex gap-3">
      {OPTIONS.map(opt => (
        <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={value.includes(opt)}
            onChange={() => toggle(opt)}
            className="accent-[#c9a465]"
          />
          <span>{opt.charAt(0) + opt.slice(1).toLowerCase()}</span>
        </label>
      ))}
    </div>
  )
}
