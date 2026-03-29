/**
 * export.js — GastosIn re-importable export format
 *
 * The export file is the primary retention mechanic.
 * Users return monthly, feed their previous export + new statement,
 * and the dataset augments over time.
 *
 * Format spec (to be finalized — see CLAUDE.md open questions):
 * {
 *   version: "1",
 *   exportedAt: ISO8601,
 *   transactions: [ { date, merchant, amount, category, subcategory } ],
 * }
 *
 * Rules:
 * - Always include a `version` field — migrations will depend on it
 * - Self-contained — no server dependency to read it
 * - Merging: when importing a previous export, deduplicate by (date + merchant + amount)
 */

// TODO: implement
export function exportData(transactions) {
  throw new Error('Not implemented')
}

export function importData(file) {
  throw new Error('Not implemented')
}

export function mergeExports(previous, incoming) {
  throw new Error('Not implemented')
}
