import { useState } from 'react'

const NAV = [
  { target: 'overview', label: '◫ Overview' },
  { target: 'intake-section', label: '⊕ New analysis' },
  { target: 'sources', label: '⊞ Sources' },
  { target: 'about', label: 'ⓘ About' },
]

// Sidebar brand + workspace nav. `onNewAnalysis` lets App wire the reset behavior (t3+).
export default function Sidebar({ onNewAnalysis }) {
  const [active, setActive] = useState('overview')

  function go(target) {
    setActive(target)
    if (target === 'intake-section' && onNewAnalysis) onNewAnalysis()
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <img className="brand-logo" src="/logo.png" alt="ValencePack" />
        <div className="brandword">VALENCE<span style={{ color: 'var(--accent)' }}>PACK</span></div>
      </div>
      <p className="navlabel">Workspace</p>
      <nav>
        {NAV.map((n) => (
          <button
            key={n.target}
            className={'navbtn' + (active === n.target ? ' active' : '')}
            data-target={n.target}
            onClick={() => go(n.target)}
          >
            {n.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
