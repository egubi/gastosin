/**
 * extract.js — pdf.js adapter
 *
 * Owns all pdf.js concerns: worker setup, document loading, password handling,
 * and raw content extraction. Consumers receive a StatementDocument and never
 * touch pdf.js directly.
 *
 * StatementDocument shape:
 *   {
 *     text: string,        // all pages joined with "\f"
 *     pages: [{
 *       width: number,
 *       height: number,
 *       items: [{ str, x, y, width, height, fontSize }]
 *     }]
 *   }
 *
 * Coordinate system: top-left origin (pdf.js bottom-left is flipped here).
 */

import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

/**
 * Build a plain-text string from a page's sorted items.
 * Inserts a newline when the y-gap between consecutive items exceeds half the
 * median item height; otherwise inserts a space.
 */
function buildPageText(items) {
  if (items.length === 0) return ''

  const heights = items.map(it => it.height).filter(h => h > 0).sort((a, b) => a - b)
  const medianHeight = heights.length > 0 ? heights[Math.floor(heights.length / 2)] : 0
  const threshold = medianHeight / 2

  let text = items[0].str
  for (let i = 1; i < items.length; i++) {
    const dy = items[i].y - items[i - 1].y
    text += dy > threshold ? '\n' : ' '
    text += items[i].str
  }
  return text
}

/**
 * Load a PDF file and extract its full content as a StatementDocument.
 *
 * @param {File} file
 * @param {string} [password]
 * @returns {Promise<StatementDocument>}
 * @throws {Error} with isPasswordProtected=true when the PDF is encrypted
 */
export async function extractPdf(file, password) {
  const arrayBuffer = await file.arrayBuffer()
  const loadParams = { data: new Uint8Array(arrayBuffer) }
  if (password) loadParams.password = password

  let pdf
  try {
    pdf = await pdfjsLib.getDocument(loadParams).promise
  } catch (err) {
    if (err?.name === 'PasswordException' || err?.code === 1) {
      const e = new Error('PASSWORD_PROTECTED')
      e.isPasswordProtected = true
      throw e
    }
    throw err
  }

  const pages = []
  const pageTexts = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()

    const items = content.items.map(it => ({
      str: it.str,
      x: it.transform[4],
      y: viewport.height - it.transform[5],  // flip to top-left origin
      width: it.width,
      height: it.height,
      fontSize: Math.abs(it.transform[3]),
    }))

    // Stable reading order: y ascending (top-to-bottom), then x ascending
    items.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x)

    pages.push({ width: viewport.width, height: viewport.height, items })
    pageTexts.push(buildPageText(items))
  }

  return {
    text: pageTexts.join('\f'),
    pages,
  }
}
