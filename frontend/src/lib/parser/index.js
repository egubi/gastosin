/**
 * parser.js — Client-side PDF parsing for UnionBank credit card statements
 *
 * Supports: UnionBank Rewards Platinum Mastercard / Visa Platinum
 *
 * Flow:
 *   1. Load PDF with pdf.js
 *   2. Extract text items per page, group by Y coordinate → reconstruct lines
 *   3. Detect transaction section (after MASTERCARD/VISA card number header)
 *   4. Parse each transaction line: txn date | posting date | merchant | amount
 *   5. Return raw rows — sanitizer runs next
 *
 * IMPORTANT: The full PDF never leaves the browser. Only parsed rows proceed.
 */

import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/
const AMOUNT_RE = /^-?[\d,]+\.\d{2}$/
// Foreign currency sub-line, e.g. "USD 89.09" or "SGD 267.60"
const FOREIGN_CURRENCY_RE = /^[A-Z]{3}\s+[\d,]+\.\d{2}$/
// Card number header line, e.g. "MASTERCARD 542339******7744"
const CARD_HEADER_RE = /^(MASTERCARD|VISA)\s+\d{6}\*+\d{4}$/

function mmddyyyyToISO(dateStr) {
  const [mm, dd, yyyy] = dateStr.split('/')
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
  let inTxnSection = false

  for (const tokens of lines) {
    const lineText = tokens.join(' ')

    if (CARD_HEADER_RE.test(lineText)) {
      inTxnSection = true
      continue
    }

    if (
      lineText.startsWith('PREVIOUS BALANCE') ||
      lineText.startsWith('SUBTOTAL') ||
      lineText.startsWith('TOTAL BALANCE') ||
      lineText.includes('END OF STATEMENT')
    ) {
      if (lineText.startsWith('SUBTOTAL') || lineText.includes('END OF STATEMENT')) {
        inTxnSection = false
      }
      continue
    }

    if (!inTxnSection) continue
    if (FOREIGN_CURRENCY_RE.test(lineText)) continue
    if (lineText.includes('Transaction') && lineText.includes('Posting')) continue

    // Transaction row: [txnDate, postingDate, ...merchantTokens, amount]
    if (tokens.length < 3) continue
    if (!DATE_RE.test(tokens[0])) continue
    if (!DATE_RE.test(tokens[1])) continue

    const lastToken = tokens[tokens.length - 1]
    if (!AMOUNT_RE.test(lastToken)) continue

    const merchant = tokens.slice(2, tokens.length - 1).join(' ').trim()
    const amount = parseFloat(lastToken.replace(/,/g, ''))

    if (!merchant) continue

    results.push({
      date: mmddyyyyToISO(tokens[0]),
      merchant,
      amount,
    })
  }
}

/**
 * @param {File} file
 * @returns {Promise<Array<{date: string, merchant: string, amount: number}>>}
 */
export async function parsePDF(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise

  const results = []
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    parsePage(extractLines(textContent), results)
  }

  return results
}
