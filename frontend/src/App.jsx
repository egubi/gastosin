import { BrowserRouter, Routes, Route } from 'react-router-dom'

// Pages (to be built out)
import UploadPage from './pages/UploadPage.jsx'
import PreviewPage from './pages/PreviewPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Step 1: Upload statement */}
        <Route path="/" element={<UploadPage />} />

        {/* Step 2: Mandatory preview — user verifies extracted data */}
        <Route path="/preview" element={<PreviewPage />} />

        {/* Step 3: Dashboard + export */}
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </BrowserRouter>
  )
}
