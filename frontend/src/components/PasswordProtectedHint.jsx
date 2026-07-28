import { useState } from 'react'

const STEPS = [
  {
    label: 'Open in browser',
    desc: 'Drag the PDF into Chrome or Safari — it will open in the built-in viewer.',
  },
  {
    label: 'Open print dialog',
    desc: 'Press Ctrl+P (or Cmd+P on Mac) to open the print dialog.',
  },
  {
    label: 'Save as PDF',
    desc: 'Set destination to "Save as PDF" and save — the new file has no password.',
  },
]

export default function PasswordProtectedHint() {
  const [open, setOpen] = useState(false)

  return (
    <div className="max-w-3xl mx-auto mt-3">
      {/* Trigger row */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-500 transition-colors py-1 select-none"
      >
        {/* Lock icon */}
        <svg
          className="w-3.5 h-3.5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
        <span>
          Password-protected PDF?&nbsp;&nbsp;Remove it in 3 steps
        </span>
        <span
          className="inline-block transition-transform duration-200 leading-none"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden="true"
        >
          ↓
        </span>
      </button>

      {/* Accordion panel */}
      <div
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: open ? '260px' : '0px' }}
      >
        <div className="pt-5 pb-3 px-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {STEPS.map((step, i) => (
              <div
                key={i}
                className="flex flex-row sm:flex-col items-start sm:items-center gap-3 sm:gap-2 sm:text-center"
              >
                <span className="flex items-center justify-center w-6 h-6 rounded-full border border-neutral-700 text-neutral-600 text-xs font-medium shrink-0">
                  {i + 1}
                </span>
                <div>
                  <p className="text-xs font-semibold text-neutral-500">{step.label}</p>
                  <p className="text-xs text-neutral-700 mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
