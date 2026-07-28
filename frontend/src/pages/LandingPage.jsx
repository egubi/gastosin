import { useNavigate } from 'react-router-dom'
import { useStatement } from '../context/StatementContext'
import UploadZone from '../components/UploadZone'
import SupportedBanks from '../components/SupportedBanks'
import PasswordProtectedHint from '../components/PasswordProtectedHint'

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
        <div className="max-w-3xl mx-auto">
          <UploadZone onFileProcessed={handleFileProcessed} />
          <PasswordProtectedHint />
          <SupportedBanks />
        </div>
      </section>

      {/* How we read your statement */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-xl font-medium mb-8 text-center">How we read your statement</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Card 1 — Privacy first */}
          <div className="border border-neutral-700 rounded-xl px-6 py-8">
            <svg className="w-7 h-7 mb-4 text-[#1D9E75]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 10.5c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <h3 className="font-medium mb-2">Privacy first</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">Your file never leaves your device. Parsing happens entirely in your browser.</p>
          </div>

          {/* Card 2 — Community-verified */}
          <div className="border border-neutral-700 rounded-xl px-6 py-8">
            <svg className="w-7 h-7 mb-4 text-[#1D9E75]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <h3 className="font-medium mb-2">Community-verified</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">The rules for reading each bank's format are written and checked by real users.</p>
          </div>

          {/* Card 3 — Fully transparent */}
          <div className="border border-neutral-700 rounded-xl px-6 py-8">
            <svg className="w-7 h-7 mb-4 text-[#1D9E75]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
            <h3 className="font-medium mb-2">Fully transparent</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">Anyone can inspect exactly how their statement is read. Nothing is hidden.</p>
            <a
              href="https://github.com/null-pointer-labs/gastosin-adapters"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              See the code →
            </a>
          </div>

        </div>
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