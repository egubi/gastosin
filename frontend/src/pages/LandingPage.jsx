import { useNavigate } from 'react-router-dom'
import { useStatement } from '../context/StatementContext'
import UploadZone from '../components/UploadZone'

export default function LandingPage() {
  const navigate = useNavigate()
  const { setTransactions } = useStatement()

  const handleFileProcessed = (transactions) => {
    setTransactions(transactions)
    navigate('/verify')
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white">
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <h1 className="text-5xl font-medium mb-6 leading-tight">
          Know where your money goes.
        </h1>
        <p className="text-xl text-neutral-400 mb-12 max-w-2xl mx-auto">
          Upload your credit card statement. See your spending categorized instantly. Everything stays on your device.
        </p>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-8 text-sm mb-16">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#1D9E75]"></div>
            <span className="text-neutral-400">Client-side processing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#1D9E75]"></div>
            <span className="text-neutral-400">No data stored</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#1D9E75]"></div>
            <span className="text-neutral-400">Open source</span>
          </div>
        </div>

        {/* Upload zone */}
        <UploadZone onFileProcessed={handleFileProcessed} />
      </section>

      {/* How it works */}
      <section id="how" className="max-w-6xl mx-auto px-6 py-20 border-t border-neutral-800">
        <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-12">HOW IT WORKS</h2>
        <div className="grid grid-cols-3 gap-12">
          <div>
            <div className="w-10 h-10 rounded-full bg-[#1D9E75] text-white flex items-center justify-center font-medium mb-4">1</div>
            <h3 className="text-lg font-medium mb-2">Upload</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Drop your PDF statement. Parsed entirely in your browser.
            </p>
          </div>
          <div>
            <div className="w-10 h-10 rounded-full bg-[#1D9E75] text-white flex items-center justify-center font-medium mb-4">2</div>
            <h3 className="text-lg font-medium mb-2">Verify</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Review extracted transactions before anything is processed.
            </p>
          </div>
          <div>
            <div className="w-10 h-10 rounded-full bg-[#1D9E75] text-white flex items-center justify-center font-medium mb-4">3</div>
            <h3 className="text-lg font-medium mb-2">Analyze</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              See spending by category. Export for month-over-month tracking.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}