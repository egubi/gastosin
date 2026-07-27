import FallbackButtons from './FallbackButtons'

const BANKS = [
  { name: 'UnionBank', status: 'supported' },
  { name: 'Citi Philippines', status: 'supported' },
  { name: 'BPI', status: 'planned' },
  { name: 'BDO', status: 'planned' },
  { name: 'Metrobank', status: 'planned' },
  { name: 'RCBC', status: 'planned' },
  { name: 'Security Bank', status: 'planned' },
]

export default function SupportedBanks() {
  return (
    <div className="bg-[#1f1f1f] border border-[#333]/50 rounded-xl p-5 mt-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-wide text-neutral-500 font-semibold">
          Supported Statements
        </span>
        <span className="text-[12px] text-neutral-500">2 banks · more coming</span>
      </div>

      {/* Bank chips */}
      <div className="flex flex-wrap gap-2">
        {BANKS.map((bank) =>
          bank.status === 'supported' ? (
            <span
              key={bank.name}
              className="rounded-full px-3 py-1.5 text-[13px] flex items-center gap-1.5 bg-[#1D9E75]/12 border border-[#1D9E75]/40 text-neutral-100"
            >
              <span style={{ color: '#1D9E75' }}>✓</span>
              {bank.name}
            </span>
          ) : (
            <span
              key={bank.name}
              className="rounded-full px-3 py-1.5 text-[13px] flex items-center gap-1.5 border border-[#333] text-neutral-500"
            >
              <span>+</span>
              {bank.name}
            </span>
          )
        )}
      </div>

      {/* Note */}
      <div className="border-t border-[#2e2e2e] pt-3 mt-3 text-[12.5px] text-neutral-500">
        Greyed-out banks aren't parsed yet — GastosIn is built by one person with one statement per bank.{' '}
        <a href="#request" className="text-[#1D9E75] hover:underline">
          Help add yours →
        </a>
      </div>

      {/* Fallback buttons */}
      <FallbackButtons className="mt-3.5" />
    </div>
  )
}
