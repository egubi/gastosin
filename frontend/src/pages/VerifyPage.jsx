import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStatement } from '../context/StatementContext'
import TransactionTable from '../components/TransactionTable'

export default function VerifyPage() {
  const navigate = useNavigate()
  const { transactions, setCategorizedTransactions } = useStatement()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Redirect if no transactions
    if (!transactions || transactions.length === 0) {
      navigate('/')
    }
  }, [transactions, navigate])

  const handleConfirm = async () => {
    setIsAnalyzing(true)
    setError(null)
    try {
      const response = await fetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
      })

      if (!response.ok) {
        throw new Error('Categorization failed')
      }

      const data = await response.json()
      setCategorizedTransactions(data.transactions)
      navigate('/dashboard')
    } catch (err) {
      console.error('Categorization error:', err)
      setError('Something went wrong while categorizing. Please try again.')
      setIsAnalyzing(false)
    }
  }

  const handleReUpload = () => {
    navigate('/')
  }

  if (!transactions || transactions.length === 0) {
    return null
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white">
      {/* Analyzing overlay */}
      {isAnalyzing && (
        <div className="fixed inset-0 bg-neutral-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-5">
          <div className="w-12 h-12 rounded-full border-4 border-neutral-700 border-t-[#1D9E75] animate-spin" />
          <div className="text-center">
            <p className="text-lg font-medium text-white">Analyzing your transactions</p>
            <p className="text-sm text-neutral-400 mt-1">This may take a few seconds…</p>
          </div>
          <div className="flex gap-1 mt-2">
            {transactions.map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[#1D9E75] animate-pulse"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="mb-8">
          <h1 className="text-3xl font-medium mb-2">Verify Your Transactions</h1>
          <p className="text-neutral-400">
            Review the extracted data before we categorize it. Nothing is sent to our server until you confirm.
          </p>
        </div>

        <TransactionTable
          transactions={transactions}
          title="Extracted transactions"
          foundCount={`${transactions.length}`}
        />

        {error && (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        )}

        <div className="flex items-center justify-between mt-8">
          <button
            onClick={handleReUpload}
            disabled={isAnalyzing}
            className="px-6 py-2.5 rounded-lg text-sm font-medium border border-neutral-700 hover:border-neutral-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Re-upload
          </button>
          <button
            onClick={handleConfirm}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-8 py-2.5 rounded-lg text-sm font-medium bg-[#1D9E75] hover:bg-[#178763] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Analyzing…
              </>
            ) : (
              'Confirm & Categorize'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
