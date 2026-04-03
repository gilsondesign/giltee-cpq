import NavBar from '../components/NavBar'
export default function Clients() {
  return (
    <div className="min-h-screen bg-surface">
      <NavBar />
      <div className="max-w-6xl mx-auto px-6 py-10 text-center">
        <p className="text-xs font-bold tracking-widest text-on-surface-variant uppercase mb-4">CLIENTS</p>
        <h2 className="text-xl font-bold text-on-surface mb-2">Coming Soon</h2>
        <p className="text-on-surface-variant text-sm">Client management (CRM) is planned for v2.</p>
      </div>
    </div>
  )
}
