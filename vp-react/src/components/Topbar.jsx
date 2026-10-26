import Atom from './Atom.jsx'

// Hero header only. Page navigation lives in the sidebar on desktop and in the slide-in
// sidebar drawer on phones (opened by this button) - so there is no second row of tab
// buttons duplicating the sidebar, and phones get the brand logo back via the drawer.
export default function Topbar({ onMenu }) {
  return (
    <header className="topbar">
      <button type="button" className="hamburger" aria-label="Open menu" onClick={onMenu}>
        <span /><span /><span />
      </button>
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