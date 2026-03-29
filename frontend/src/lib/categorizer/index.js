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

// TODO: implement
export async function categorize(sanitizedRows) {
  throw new Error('Not implemented')
}
