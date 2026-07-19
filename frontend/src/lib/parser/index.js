/**
 * parser.js — Client-side PDF parsing for UnionBank credit card statements
 *
 * Supports: UnionBank Rewards Platinum Mastercard / Visa Platinum
 *
 * Flow:
 *   1. Load PDF with pdf.js
 *   2. Extract text items per page, group by Y coordinate → reconstruct lines
 *   3. Parse each transaction line: txn date | posting date | merchant | amount
 *   4. Return raw rows — sanitizer runs next
 *
 * IMPORTANT: The full PDF never leaves the browser. Only parsed rows proceed.
 */

import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// Accepts both MM/DD/YY (2-digit) and MM/DD/YYYY (4-digit) — UnionBank uses 2-digit
const DATE_RE = /^\d{2}\/\d{2}\/(\d{2}|\d{4})$/
const AMOUNT_RE = /^-?[\d,]+\.\d{2}$/
// Foreign currency sub-line, e.g. "USD 89.09" or "SGD 267.60"
const FOREIGN_CURRENCY_RE = /^[A-Z]{3}\s+[\d,]+\.\d{2}$/
// Card section header: e.g. "REWARDS PLATINUM MASTERCARD  5292-47**-****-6729"
// Matches any line containing MASTERCARD or VISA followed by a masked card number
const CARD_HEADER_RE = /(MASTERCARD|VISA).*[\d*-]+\d{4}$/i
// Currency indicator tokens to strip from the merchant field
const CURRENCY_TOKEN_RE = /^(PHP|P)$/

/**
 * Convert MM/DD/YY or MM/DD/YYYY → YYYY-MM-DD
 */
function mmddToISO(dateStr) {
  const [mm, dd, yy] = dateStr.split('/')
  const yyyy = yy.length === 2 ? '20' + yy : yy
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Group pdf.js text items into lines by Y coordinate.
 * Returns lines sorted top-to-bottom, each line sorted left-to-right.
 */
function extractLines(textContent) {
  const lineMap = new Map()

  for (const item of textContent.items) {
    if (!item.str.trim()) continue
    // Round Y to nearest 2px to handle sub-pixel differences on the same line
    const y = Math.round(item.transform[5] / 2) * 2
    if (!lineMap.has(y)) lineMap.set(y, [])
    lineMap.get(y).push(item)
  }

  // PDF Y-axis is bottom-up, so descending Y = top of page first
  const sortedYs = [...lineMap.keys()].sort((a, b) => b - a)

  return sortedYs.map(y => {
    const items = lineMap.get(y).sort((a, b) => a.transform[4] - b.transform[4])
    return items.map(i => i.str.trim()).filter(Boolean)
  })
}

function parsePage(lines, results) {
  for (const tokens of lines) {
    const lineText = tokens.join(' ')

    // Skip foreign currency sub-lines and card section headers
    if (FOREIGN_CURRENCY_RE.test(lineText)) continue
    if (CARD_HEADER_RE.test(lineText)) continue

    // Skip known summary / column-header rows
    if (
      lineText.startsWith('PREVIOUS BALANCE') ||
      lineText.startsWith('SUBTOTAL') ||
      lineText.startsWith('TOTAL BALANCE') ||
      lineText.includes('END OF STATEMENT') ||
      (lineText.includes('Transaction') && lineText.includes('Posting'))
    ) continue

    // Transaction row must start with two consecutive date tokens
    if (tokens.length < 3) continue
    if (!DATE_RE.test(tokens[0])) continue
    if (!DATE_RE.test(tokens[1])) continue

    // Last token must be an amount
    const lastToken = tokens[tokens.length - 1]
    if (!AMOUNT_RE.test(lastToken)) continue

    const amount = parseFloat(lastToken.replace(/,/g, ''))

    // Build merchant: tokens between the two dates and the amount,
    // stripping currency indicator tokens (PHP / P)
    const merchant = tokens
      .slice(2, tokens.length - 1)
      .filter(t => !CURRENCY_TOKEN_RE.test(t))
      .join(' ')
      .trim()

    if (!merchant) continue

    results.push({
      date: mmddToISO(tokens[0]),
      merchant,
      amount,
    })
  }
}

/**
 * @param {File} file
 * @returns {Promise<Array<{date: string, merchant: string, amount: number}>>}
 * @throws {Error} with a user-friendly message property
 */
export async function parsePDF(file) {
  const arrayBuffer = await file.arrayBuffer()

  let pdf
  try {
    pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
  } catch (err) {
    // pdf.js throws a PasswordException for password-protected PDFs
    if (err?.name === 'PasswordException' || err?.code === 1) {
      const e = new Error('PASSWORD_PROTECTED')
      e.isPasswordProtected = true
      throw e
    }
    throw err
  }

  console.group('[GastosIn] PDF parsing started')
  console.log('Pages:', pdf.numPages, '| File:', file.name)

  const results = []
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    const lines = extractLines(textContent)
    console.log(`Page ${pageNum} — ${lines.length} lines extracted`)
    if (pageNum === 1) {
      console.log('First 10 lines of page 1 (joined):', lines.slice(0, 10).map(l => l.join(' ')))
    }
    parsePage(lines, results)
  }

  console.log('Transactions found:', results.length)
  if (results.length === 0) {
    console.warn('[GastosIn] No transactions detected. Check the lines logged above.')
  }
  console.groupEnd()

  return results
}
