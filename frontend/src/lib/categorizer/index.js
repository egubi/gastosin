/**
 * categorizer.js — Calls the proprietary GastosIn categorization API
 *
 * Sends:    [ { date, merchant, amount } ]
 * Receives: [ { date, merchant, amount, category, subcategory } ]
 *
 * The categorization logic lives server-side (FastAPI backend).
 * This module is just the client-side caller — keep it thin.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

/**
 * @param {Array<{date: string, merchant: string, amount: number}>} sanitizedRows
 * @returns {Promise<Array<{date: string, merchant: string, amount: number, category: string, subcategory: string|null}>>}
 */
export async function categorize(sanitizedRows) {
  const res = await fetch(`${API_BASE}/categorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactions: sanitizedRows }),
  })

  if (!res.ok) {
    throw new Error(`Categorization failed: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  return data.transactions
}
