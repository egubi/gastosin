import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStatement } from '../context/StatementContext'
import TransactionTable from '../components/TransactionTable'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { categorizedTransactions } = useStatement()

  useEffect(() => {
    // Redirect if no categorized transactions
    if (!categorizedTransactions || categorizedTransactions.length === 0) {
      navigate('/')
    }
  }, [categorizedTransactions, navigate])

  if (!categorizedTransactions || categorizedTransactions.length === 0) {
    return null
  }

  // Calculate summary statistics
  const totalSpending = categorizedTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0)

  const categoryTotals = categorizedTransactions.reduce((acc, tx) => {
    const cat = tx.category || 'Other'
    acc[cat] = (acc[cat] || 0) + (tx.amount || 0)
    return acc
  }, {})

  const sortedCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([name, amount]) => ({ name, amount }))

  const topCategory = sortedCategories[0]
  const maxAmount = Math.max(...sortedCategories.map(c => c.amount))

  const categoryColors = {
    Food: 'bg-amber-500',
    Transport: 'bg-blue-500',
    Shopping: 'bg-pink-500',
    Bills: 'bg-green-500',
    Other: 'bg-gray-500',
  }

  const handleExport = () => {
    const exportData = {
      version: '1',
      exportedAt: new Date().toISOString(),
      transactions: categorizedTransactions,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gastosin-export-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleUploadAnother = () => {
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-medium mb-2">Your Spending Dashboard</h1>
            <p className="text-neutral-400">
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleUploadAnother}
              className="px-6 py-2.5 rounded-lg text-sm font-medium border border-neutral-700 hover:border-neutral-600 transition-colors"
            >
              Upload another
            </button>
            <button
              onClick={handleExport}
              className="px-6 py-2.5 rounded-lg text-sm font-medium bg-[#1D9E75] hover:bg-[#178763] transition-colors"
            >
              Export data
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-6 mb-12">
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-6">
            <div className="text-sm text-neutral-400 mb-2">Total spending</div>
            <div className="text-4xl font-medium mb-1">₱ {totalSpending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-sm text-neutral-500">{categorizedTransactions.length} transactions</div>
          </div>
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-6">
            <div className="text-sm text-neutral-400 mb-2">Top category</div>
            <div className="text-4xl font-medium mb-1">{topCategory.name}</div>
            <div className="text-sm text-neutral-500">
              ₱ {topCategory.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {Math.round((topCategory.amount / totalSpending) * 100)}%
            </div>
          </div>
        </div>

        {/* Category breakdown chart */}
        <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-6 mb-12">
          <div className="text-sm font-medium mb-8">Spending by category</div>
          <div className="space-y-6">
            {sortedCategories.map((cat, i) => (
              <div key={i}>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>{cat.name}</span>
                  <span className="text-neutral-400">₱ {cat.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="h-8 bg-neutral-700 rounded-lg overflow-hidden">
                  <div 
                    className={`h-full ${categoryColors[cat.name] || categoryColors.Other} rounded-lg`}
                    style={{ width: `${(cat.amount / maxAmount) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transaction list */}
        <div>
          <h2 className="text-lg font-medium mb-4">All Transactions</h2>
          <TransactionTable transactions={categorizedTransactions} />
        </div>
      </div>
    </div>
  )
}
