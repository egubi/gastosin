import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const location = useLocation()
  const isLanding = location.pathname === '/'

  const scrollToHow = (e) => {
    e.preventDefault()
    if (location.pathname !== '/') {
      window.location.href = '/#how'
    } else {
      const element = document.querySelector('#how')
      element?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <nav className="border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#1D9E75] rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-lg font-medium">GastosIn</span>
        </Link>
        {isLanding && (
          <div className="flex items-center gap-8 text-sm">
            <a href="#how" onClick={scrollToHow} className="text-neutral-400 hover:text-white transition-colors cursor-pointer">
              How it works
            </a>
          </div>
        )}
      </div>
    </nav>
  )
}
