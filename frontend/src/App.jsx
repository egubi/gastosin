import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { StatementProvider } from './context/StatementContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import LandingPage from './pages/LandingPage'
import VerifyPage from './pages/VerifyPage'
import DashboardPage from './pages/DashboardPage'

export default function App() {
  return (
    <StatementProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-neutral-900 text-white">
          <Navbar />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
          <Footer />
        </div>
      </BrowserRouter>
    </StatementProvider>
  )
}
