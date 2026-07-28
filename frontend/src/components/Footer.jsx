export default function Footer() {
  return (
    <footer className="border-t border-neutral-800 py-12">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <p className="text-sm text-neutral-400">
          Your data never leaves your browser. All processing happens locally on your device.
        </p>
        <p className="text-sm text-neutral-500 mt-2">
          Bank adapters are open source.{' '}
          <a
            href="https://github.com/null-pointer-labs/gastosin-adapters"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#1D9E75] hover:underline"
          >
            View on GitHub
          </a>
          {' '}— contributions welcome.
        </p>
      </div>
    </footer>
  )
}
