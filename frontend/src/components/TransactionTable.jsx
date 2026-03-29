import CategoryPill from './CategoryPill'

export default function TransactionTable({ transactions, title, foundCount }) {
  return (
    <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl overflow-hidden">
      {(title || foundCount) && (
        <div className="px-6 py-4 border-b border-neutral-700 flex items-center justify-between">
          {title && <span className="text-sm font-medium">{title}</span>}
          {foundCount && <span className="text-sm text-[#1D9E75]">{foundCount} found</span>}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-neutral-700">
            <tr className="text-left text-sm text-neutral-400">
              <th className="px-6 py-3 font-normal">Date</th>
              <th className="px-6 py-3 font-normal">Merchant</th>
              <th className="px-6 py-3 font-normal">Category</th>
              <th className="px-6 py-3 font-normal text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, i) => (
              <tr key={i} className="border-b border-neutral-700/50 last:border-0">
                <td className="px-6 py-4 text-sm">{tx.date}</td>
                <td className="px-6 py-4 text-sm">{tx.merchant}</td>
                <td className="px-6 py-4">
                  <CategoryPill category={tx.category} />
                </td>
                <td className="px-6 py-4 text-sm text-right">₱ {tx.amount?.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
