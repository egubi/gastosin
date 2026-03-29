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

// TODO: implement
export function sanitize(rawRows) {
  throw new Error('Not implemented')
}
