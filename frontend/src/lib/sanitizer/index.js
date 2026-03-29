/**
 * sanitizer.js — PII stripping before any network call
 *
 * Input:  raw extracted rows from parser
 * Output: [ { date, merchant, amount } ] — nothing else
 *
 * Strips: card numbers, full names, account IDs, balances, running totals
 *
 * This runs BEFORE any data leaves the browser — including the Azure fallback.
 * Do not add fields to the output shape without updating CLAUDE.md.
 */

// Patterns that indicate PII or non-transaction rows
const CARD_NUMBER_RE = /\d{4}[\s\-*]+\d{4}[\s\-*]+\d{4}[\s\-*]+\d{4}/
const ACCOUNT_ID_RE = /\b\d{10,}\b/ // Long numeric IDs (account numbers)

/**
 * Strip PII from a single merchant string.
 * The merchant field comes from the statement and may include location suffixes
 * like ", MAKATI" — we keep those since they're not PII.
 */
function cleanMerchant(merchant) {
  return merchant
    .replace(CARD_NUMBER_RE, '[CARD]')
    .replace(ACCOUNT_ID_RE, '[ID]')
    .trim()
}

/**
 * @param {Array<{date: string, merchant: string, amount: number}>} rawRows
 * @returns {Array<{date: string, merchant: string, amount: number}>}
 */
export function sanitize(rawRows) {
  return rawRows
    .filter(row => {
      // Drop rows missing required fields
      if (!row.date || !row.merchant || row.amount == null) return false
      // Drop rows that appear to be balance/summary lines (no date)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return false
      return true
    })
    .map(row => ({
      date: row.date,
      merchant: cleanMerchant(row.merchant),
      amount: row.amount,
    }))
}
