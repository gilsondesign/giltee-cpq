import NavBar from '../components/NavBar'
export default function Ledger() {
  return (
    <div className="min-h-screen bg-surface">
      <NavBar />
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-on-surface">Quote Ledger</h1>
        <p className="text-on-surface-variant text-sm mt-1">Full implementation in Plan C.</p>
      </div>
    </div>
  )
}
