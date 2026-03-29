import { createContext, useContext, useState } from 'react'

const StatementContext = createContext()

export function StatementProvider({ children }) {
  const [transactions, setTransactions] = useState([])
  const [categorizedTransactions, setCategorizedTransactions] = useState([])

  return (
    <StatementContext.Provider
      value={{
        transactions,
        setTransactions,
        categorizedTransactions,
        setCategorizedTransactions,
      }}
    >
      {children}
    </StatementContext.Provider>
  )
}

export function useStatement() {
  const context = useContext(StatementContext)
  if (!context) {
    throw new Error('useStatement must be used within StatementProvider')
  }
  return context
}
