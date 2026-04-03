import { BrowserRouter, Routes, Route } from 'react-router-dom'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div className="p-8 text-primary font-bold text-2xl">Giltee Ledger — Coming Soon</div>} />
      </Routes>
    </BrowserRouter>
  )
}
