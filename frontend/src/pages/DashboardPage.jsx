import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStatement } from '../context/StatementContext'
import TransactionTable from '../components/TransactionTable'

const PALETTE = [
  '#3B82F6',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#8B5CF6',
  '#F97316',
  '#06B6D4',
  '#EF4444',
  '#84CC16',
  '#6B7280',
]

const CX = 160
const CY = 160
const R = 128
const R_ACTIVE = 140
const INNER_R = 54

function polarToCartesian(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function buildSlicePath(cx, cy, r, start, end) {
  // Clamp to avoid degenerate full-circle arc
  const sweep = Math.min(end - start, 359.9999)
  const s = polarToCartesian(cx, cy, r, start)
  const e = polarToCartesian(cx, cy, r, start + sweep)
  const largeArc = sweep > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y} Z`
}

function sliceTranslate(cx, cy, start, end, offset) {
  const mid = (start + end) / 2
  const rad = ((mid - 90) * Math.PI) / 180
  return `translate(${offset * Math.cos(rad)}, ${offset * Math.sin(rad)})`
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { categorizedTransactions } = useStatement()
  const [hoveredCat, setHoveredCat] = useState(null)
  const [activeCat, setActiveCat] = useState(null)

  useEffect(() => {
    if (!categorizedTransactions || categorizedTransactions.length === 0) {
      navigate('/')
    }
  }, [categorizedTransactions, navigate])

  if (!categorizedTransactions || categorizedTransactions.length === 0) {
    return null
  }

  const totalSpending = categorizedTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0)

  // Only positive amounts contribute to the pie
  const categoryTotals = categorizedTransactions.reduce((acc, tx) => {
    if ((tx.amount || 0) > 0) {
      const cat = tx.category || 'Other'
      acc[cat] = (acc[cat] || 0) + tx.amount
    }
    return acc
  }, {})

  const pieTotal = Object.values(categoryTotals).reduce((s, v) => s + v, 0)

  const categories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([name, amount], i) => ({
      name,
      amount,
      color: PALETTE[i % PALETTE.length],
      pct: pieTotal > 0 ? (amount / pieTotal) * 100 : 0,
    }))

  // Build slice angle ranges
  let cursor = 0
  const slices = categories.map(cat => {
    const start = cursor
    const sweep = (cat.amount / pieTotal) * 360
    cursor += sweep
    return { ...cat, start, end: cursor }
  })

  const topCategory = categories[0]

  const displayCat = hoveredCat ?? activeCat
  const displayCatData = displayCat ? categories.find(c => c.name === displayCat) : null
  const catTransactions = displayCat
    ? categorizedTransactions.filter(tx => (tx.category || 'Other') === displayCat)
    : []

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

  return (
    <div className="min-h-screen bg-neutral-900 text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-medium mb-2">Your Spending Dashboard</h1>
            <p className="text-neutral-400">
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/')}
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
            <div className="text-4xl font-medium mb-1">
              ₱ {totalSpending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-neutral-500">{categorizedTransactions.length} transactions</div>
          </div>
          {topCategory && (
            <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-6">
              <div className="text-sm text-neutral-400 mb-2">Top category</div>
              <div className="text-4xl font-medium mb-1">{topCategory.name}</div>
              <div className="text-sm text-neutral-500">
                ₱ {topCategory.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {Math.round(topCategory.pct)}%
              </div>
            </div>
          )}
        </div>

        {/* Pie chart + breakdown */}
        <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-6 mb-12">
          <div className="text-sm font-medium mb-6">Spending by category</div>
          <div className="flex gap-10 items-start">

            {/* Donut SVG */}
            <div className="flex-shrink-0">
              <svg
                width="320"
                height="320"
                viewBox="0 0 320 320"
                onMouseLeave={() => setHoveredCat(null)}
              >
                {slices.map(slice => {
                  const isActive = slice.name === displayCat
                  const radius = isActive ? R_ACTIVE : R
                  return (
                    <path
                      key={slice.name}
                      d={buildSlicePath(CX, CY, radius, slice.start, slice.end)}
                      fill={slice.color}
                      opacity={displayCat && !isActive ? 0.3 : 1}
                      transform={isActive ? sliceTranslate(CX, CY, slice.start, slice.end, 7) : undefined}
                      style={{ transition: 'opacity 0.15s ease, transform 0.15s ease', cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredCat(slice.name)}
                      onClick={() => setActiveCat(prev => prev === slice.name ? null : slice.name)}
                    />
                  )
                })}

                {/* Donut hole */}
                <circle cx={CX} cy={CY} r={INNER_R} fill="#1c1c1c" />

                {/* Center label */}
                {displayCatData ? (
                  <>
                    <text x={CX} y={CY - 10} textAnchor="middle" fill="white" fontSize="12" fontWeight="500">
                      {displayCatData.name}
                    </text>
                    <text x={CX} y={CY + 8} textAnchor="middle" fill="#9CA3AF" fontSize="11">
                      {Math.round(displayCatData.pct)}%
                    </text>
                  </>
                ) : (
                  <>
                    <text x={CX} y={CY - 8} textAnchor="middle" fill="#9CA3AF" fontSize="11">
                      total
                    </text>
                    <text x={CX} y={CY + 11} textAnchor="middle" fill="white" fontSize="13" fontWeight="500">
                      ₱ {(pieTotal / 1000).toFixed(1)}k
                    </text>
                  </>
                )}
              </svg>
            </div>

            {/* Right panel */}
            <div className="flex-1 min-w-0 pt-2">
              {displayCat && catTransactions.length > 0 ? (
                <div>
                  <div className="flex items-center gap-2 mb-5">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: displayCatData?.color }}
                    />
                    <span className="font-medium">{displayCat}</span>
                    <span className="text-neutral-400 text-sm ml-auto">
                      ₱ {categoryTotals[displayCat]?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="space-y-0 max-h-60 overflow-y-auto">
                    {catTransactions.map((tx, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2.5 border-b border-neutral-700/40 text-sm last:border-0"
                      >
                        <div className="min-w-0 mr-4">
                          <div className="text-white truncate">{tx.merchant}</div>
                          <div className="text-neutral-500 text-xs mt-0.5">{tx.date}</div>
                        </div>
                        <div className="text-neutral-300 flex-shrink-0">
                          ₱ {tx.amount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs text-neutral-500 mb-4">Hover or click a slice to see expenses</p>
                  {categories.map(cat => (
                    <div
                      key={cat.name}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-neutral-700/30 transition-colors"
                      onMouseEnter={() => setHoveredCat(cat.name)}
                      onMouseLeave={() => setHoveredCat(null)}
                      onClick={() => setActiveCat(prev => prev === cat.name ? null : cat.name)}
                    >
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-sm flex-1 text-neutral-200">{cat.name}</span>
                      <span className="text-neutral-500 text-xs w-8 text-right">{Math.round(cat.pct)}%</span>
                      <span className="text-neutral-400 text-sm w-32 text-right">
                        ₱ {cat.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
