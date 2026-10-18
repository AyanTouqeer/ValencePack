import Atom from './Atom.jsx'

export default function Topbar() {
  return (
    <header className="topbar">
      <div>
        <h1>Find better packaging in minutes</h1>
        <p className="subtitle">Evidence-linked recommendations for EU personal-care brands.</p>
      </div>
      <div className="top-actions">
        <Atom />
      </div>
    </header>
  )
}
