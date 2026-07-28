import { useState, useCallback } from 'react'
import FallbackButtons from './FallbackButtons'
import UnknownFormatModal from './UnknownFormatModal'

export default function UploadZone({ onFileProcessed }) {
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [showConsentModal, setShowConsentModal] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)

  const processFile = useCallback(async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setError('Please upload a PDF file.')
      setStatus('error')
      return
    }

    setStatus('parsing')
    setError(null)

    try {
      // Import parser modules dynamically
      const { parsePDF } = await import('../lib/parser')
      const { sanitize } = await import('../lib/sanitizer')

      const rawRows = await parsePDF(file)
      const sanitized = sanitize(rawRows)

      if (sanitized.length === 0) {
        setError('UNKNOWN_BANK')
        setStatus('error')
        setPendingFile(file)
        setShowConsentModal(true)
        return
      }

      setStatus(null)
      onFileProcessed(sanitized)
    } catch (err) {
      console.error(err)
      if (err?.isPasswordProtected) {
        setError('This PDF is password-protected. Open it in a PDF reader, save a copy without a password, then upload that copy.')
      } else {
        setError('UNKNOWN_BANK')
        setPendingFile(file)
        setShowConsentModal(true)
      }
      setStatus('error')
    }
  }, [onFileProcessed])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    processFile(e.dataTransfer.files[0])
  }, [processFile])

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const onDragLeave = () => setIsDragging(false)

  const onFileChange = (e) => {
    processFile(e.target.files[0])
    e.target.value = ''
  }

  return (
    <div>
      <label
        htmlFor="pdf-input"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`max-w-3xl mx-auto border-2 border-dashed rounded-xl p-16 cursor-pointer transition-colors block ${
          isDragging
            ? 'border-[#1D9E75] bg-[#1D9E75]/10'
            : 'border-neutral-700 hover:border-neutral-600'
        }`}
      >
        <input
          id="pdf-input"
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={onFileChange}
        />

        {status === 'parsing' ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#1D9E75] border-t-transparent rounded-full animate-spin" />
            <p className="text-neutral-300">Parsing your statement...</p>
          </div>
        ) : (
          <>
            <svg className="w-12 h-12 text-neutral-500 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-lg mb-2 text-center">Drop your statement here</p>
            <p className="text-sm text-neutral-500 mb-6 text-center">
              PDF or CSV · nothing is uploaded
            </p>
            <div className="text-center">
              <span className="bg-[#1D9E75] hover:bg-[#178763] text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer">
                Choose file
              </span>
            </div>
          </>
        )}
      </label>

      {status === 'error' && error === 'UNKNOWN_BANK' && (
        <div className="mt-4 mx-auto max-w-3xl bg-[#1f1f1f] border border-[#333]/50 rounded-xl px-5 py-4">
          <p className="text-sm text-neutral-300 mb-3">
            We couldn't recognize this statement format.
          </p>
          <FallbackButtons />
        </div>
      )}
      {status === 'error' && error !== 'UNKNOWN_BANK' && (
        <div className="mt-6 mx-auto max-w-3xl bg-red-500/10 border border-red-500/50 rounded-lg px-5 py-4 text-sm text-red-400">
          {error}
        </div>
      )}
      {status === 'success' && (
        <div className="mt-6 mx-auto max-w-3xl bg-green-500/10 border border-green-500/50 rounded-lg px-5 py-4 text-sm text-green-400">
          ✓ Thank you! Your submission helps us improve GastosIn.
        </div>
      )}

      <UnknownFormatModal
        isOpen={showConsentModal}
        file={pendingFile}
        onClose={() => setShowConsentModal(false)}
        onSubmit={async (submittedFile) => {
          try {
            const formData = new FormData()
            formData.append('file', submittedFile)
            formData.append('consent', 'true')

            console.log('[UploadZone] Submitting unknown format PDF:', submittedFile.name)

            const response = await fetch('/api/submit-unknown-format', {
              method: 'POST',
              body: formData,
            })

            if (!response.ok) {
              const errorData = await response.json()
              throw new Error(errorData.detail || 'Failed to submit PDF')
            }

            const result = await response.json()
            console.log('[UploadZone] Submission successful:', result)

            setShowConsentModal(false)
            setStatus('success')
            setTimeout(() => setStatus(null), 3000)
          } catch (err) {
            console.error('[UploadZone] Submission error:', err)
            setError(`Submission failed: ${err.message}`)
            setStatus('error')
            setShowConsentModal(false)
          }
        }}
      />
    </div>
  )
}
