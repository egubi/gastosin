/**
 * parser.js — Client-side PDF parsing
 *
 * Responsibilities:
 * - Parse uploaded PDF using pdf.js
 * - Extract raw text / bounding boxes
 * - If parsing confidence is low → hand off to sanitizer + Azure fallback
 *
 * IMPORTANT: Never transmit the full PDF anywhere.
 * Only sanitized { date, merchant, amount } tuples leave the browser.
 */

// TODO: implement
export async function parsePDF(file) {
  throw new Error('Not implemented')
}
