import NavBar from '../components/NavBar'
export default function CreateQuote() {
  return (
    <div className="min-h-screen bg-surface">
      <NavBar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-on-surface">New Quote</h1>
        <p className="text-on-surface-variant text-sm mt-1">Full implementation in Plan C.</p>
      </div>
    </div>
  )
}
