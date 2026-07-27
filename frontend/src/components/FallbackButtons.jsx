export default function FallbackButtons({ className = '' }) {
  return (
    <div className={`flex gap-2.5 flex-wrap ${className}`}>
      <button className="flex-1 min-w-[180px] bg-transparent border border-[#3a3a3a] rounded-lg p-2.5 text-left">
        <div className="text-[13px] font-bold text-neutral-200">Import a CSV instead</div>
        <div className="text-[11.5px] text-neutral-500 mt-0.5">
          Most banks let you export one from online banking
        </div>
      </button>
      <button className="flex-1 min-w-[180px] bg-transparent border border-[#3a3a3a] rounded-lg p-2.5 text-left">
        <div className="text-[13px] font-bold text-neutral-200">Request your bank</div>
        <div className="text-[11.5px] text-neutral-500 mt-0.5">Takes 5 seconds — no file needed</div>
      </button>
    </div>
  )
}
