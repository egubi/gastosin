import { useEffect, useRef, useState } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export default function UnknownFormatModal({ isOpen, onClose, onSubmit, file }) {
  const [consentChecked, setConsentChecked] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const modalRef = useRef(null)
  const closeTimerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setConsentChecked(false)
      setSubmitted(false)
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
      }
      return
    }

    const previousFocusedElement = document.activeElement

    const getFocusableElements = () => {
      if (!modalRef.current) return []
      return Array.from(modalRef.current.querySelectorAll(FOCUSABLE_SELECTOR))
    }

    const focusableElements = getFocusableElements()
    if (focusableElements.length > 0) {
      focusableElements[0].focus()
    } else {
      modalRef.current?.focus()
    }

    const handleKeyDown = (event) => {
      if (!isOpen) return

      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const elements = getFocusableElements()
      if (elements.length === 0) {
        event.preventDefault()
        modalRef.current?.focus()
        return
      }

      const first = elements[0]
      const last = elements[elements.length - 1]
      const active = document.activeElement

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previousFocusedElement && typeof previousFocusedElement.focus === 'function') {
        previousFocusedElement.focus()
      }
    }
  }, [isOpen, onClose])

  const handleSubmit = () => {
    if (!file || !consentChecked || submitted) return

    onSubmit(file)
    setSubmitted(true)

    closeTimerRef.current = setTimeout(() => {
      onClose()
    }, 1500)
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="unknown-format-modal-title"
        className="w-full max-w-[480px] rounded-xl bg-white p-6 text-neutral-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700" aria-hidden="true">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8 14A1 1 0 003.17 19h17.66a1 1 0 00.88-1.5l-8-14a1 1 0 00-1.74 0z" />
            </svg>
          </div>
          <div>
            <h2 id="unknown-format-modal-title" className="text-lg font-semibold">
              Format not recognized
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              We could not parse this PDF statement format. You can submit it for review so we can improve support.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-sm font-medium text-neutral-800">What happens to your file:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
            <li>It is stored securely for internal format analysis.</li>
            <li>It is used only to improve statement format support.</li>
            <li>It is deleted after review is complete.</li>
          </ul>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 p-3">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(event) => setConsentChecked(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-neutral-300 text-[#1D9E75] focus:ring-[#1D9E75]"
            disabled={submitted}
          />
          <span className="text-sm text-neutral-700">
            I confirm I have the right to share this document and consent to [Company] storing and analyzing it to improve format support.
          </span>
        </label>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!consentChecked || submitted}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
              !consentChecked || submitted
                ? 'bg-[#1D9E75] opacity-40 cursor-not-allowed'
                : 'bg-[#1D9E75] hover:bg-[#178763]'
            }`}
          >
            {submitted ? 'Submitted' : 'Submit for review'}
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 10-8 0v4m-2 0h12a1 1 0 011 1v7a1 1 0 01-1 1H6a1 1 0 01-1-1v-7a1 1 0 011-1z" />
          </svg>
          <span>Your file is encrypted in transit and at rest</span>
        </div>
      </div>
    </div>
  )
}