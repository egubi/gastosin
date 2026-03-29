import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStatement } from '../context/StatementContext'
import TransactionTable from '../components/TransactionTable'

export default function VerifyPage() {
  const navigate = useNavigate()
  const { transactions, setCategorizedTransactions } = useStatement()

  useEffect(() => {
    // Redirect if no transactions
    if (!transactions || transactions.length === 0) {
      navigate('/')
    }
  }, [transactions, navigate])

  const handleConfirm = async () => {
    try {
      // Call categorization API
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
    } catch (error) {
      console.error('Categorization error:', error)
      alert('Failed to categorize transactions. Please try again.')
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

        <div className="flex items-center justify-between mt-8">
          <button
            onClick={handleReUpload}
            className="px-6 py-2.5 rounded-lg text-sm font-medium border border-neutral-700 hover:border-neutral-600 transition-colors"
          >
            Re-upload
          </button>
          <button
            onClick={handleConfirm}
            className="px-8 py-2.5 rounded-lg text-sm font-medium bg-[#1D9E75] hover:bg-[#178763] transition-colors"
          >
            Confirm & Categorize
          </button>
        </div>
      </div>
    </div>
  )
}
