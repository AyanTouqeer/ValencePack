import { useState } from 'react'

const NAV = [
  { target: 'overview', label: '◫ Overview' },
  { target: 'intake-section', label: '⊕ New analysis' },
  { target: 'sources', label: '⊞ Sources' },
  { target: 'about', label: 'ⓘ About' },
]

// Sidebar brand + workspace nav. `onNewAnalysis` lets App wire the reset behavior (t3+).
export default function Sidebar({ onNewAnalysis, page, onNavigate, open, onClose }) {
  const [active, setActive] = useState('overview')
  // When Home isn't showing, the page prop is the truth for what's active
  // (a topnav tab click updates App's page state, but never calls Sidebar's own setActive).
  const effectiveActive = page && page !== 'home' ? page : active

  function go(target) {
    // Sources/About are now real pages, not anchors on Home.
    if (target === 'sources' || target === 'about') {
      setActive(target)
      if (onNavigate) onNavigate(target)
      window.scrollTo(0, 0)
      if (onClose) onClose()
      return
    }
    // Overview / New analysis are Home-only anchors: make sure Home is showing first.
    setActive(target)
    const goHome = page !== 'home'
    if (target === 'intake-section' && onNewAnalysis) onNewAnalysis()
    if (goHome && onNavigate) onNavigate('home')
    if (onClose) onClose()
    setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' }), goHome ? 0 : 1)
  }

  return (
    <>
      {open && <div className="nav-scrim" onClick={onClose} aria-hidden="true" />}
      <aside className={'sidebar' + (open ? ' open' : '')}>
      {open && <button type="button" className="drawer-close" onClick={onClose}>Close menu</button>}
      <div className="brand">
        <img className="brand-logo" src="/logo.png" alt="ValencePack" />
        <div className="brandword">VALENCE<span style={{ color: 'var(--accent)' }}>PACK</span></div>
      </div>
      <p className="navlabel">Workspace</p>
      <nav>
        {NAV.map((n) => (
          <button
            key={n.target}
            className={'navbtn' + (effectiveActive === n.target ? ' active' : '')}
            data-target={n.target}
            onClick={() => go(n.target)}
          >
            {n.label}
          </button>
        ))}
      </nav>
      </aside>
    </>
  )
}
