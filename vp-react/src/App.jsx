import { useEffect, useRef, useState } from 'react'
import MeshCanvas from './components/MeshCanvas.jsx'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import About from './components/About.jsx'
import IntakeForm from './components/IntakeForm.jsx'
import ConfirmationCard from './components/ConfirmationCard.jsx'
import Sources from './components/Sources.jsx'
import ChatWidget from './components/ChatWidget.jsx'
import { ResultsMain, ResultsPanel } from './components/ResultsView.jsx'
import { DEFAULTS, buildPayload, demoToValues } from './lib/form.js'

// App shell (t2): layout, sidebar nav, topbar + atom, decorative mesh, static About.
// The intake form (t3), results/stats/what-if (t5-t7), sources (t8) and chat (t9) plug in here.
export default function App() {
  // Always land at the top on load — browsers otherwise restore the last scroll position.
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
  }, [])

  // --- intake form state (t3) — owned here so confirmation/results read the same source ---
  const [values, setValues] = useState(DEFAULTS)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmInput, setConfirmInput] = useState(null) // payload + detailsOpen, rendered as a card in t4
  const [lastResult, setLastResult] = useState(null)     // assessment response
  const [lastInput, setLastInput] = useState(null)       // payload that produced lastResult (for what-if re-runs)
  const [collapsed, setCollapsed] = useState(false)      // form clips to a snippet once results are shown
  const wiTimer = useRef(0)
  const chatRef = useRef(null)

  const stats = computeStats(lastResult)

  const setValue = (field, val) => setValues((v) => ({ ...v, [field]: val }))
  const onToggleDetails = () => setDetailsOpen((o) => !o)

  async function onDemo() {
    try {
      const d = await (await fetch('/api/demo')).json()
      setValues(demoToValues(d))
      setDetailsOpen(true)
      setError('')
    } catch (e) { setError('Could not load the demo scenario.') }
  }

  // Multimodal extraction result from the chat paperclip (Ayan's /api/extract) → fill the form.
  // The endpoint returns flat keys: productName, bottleMaterial, closureType, hasCarton, fillMl.
  function onExtracted(ext) {
    setValues((v) => ({
      ...v,
      productName: ext.productName ?? v.productName,
      bottleMaterial: ext.bottleMaterial ?? v.bottleMaterial,
      closureType: ext.closureType ?? v.closureType,
      fillMl: ext.fillMl != null ? String(ext.fillMl) : v.fillMl,
      hasCarton: typeof ext.hasCarton === 'boolean' ? ext.hasCarton : v.hasCarton,
    }))
    setDetailsOpen(true)
    document.getElementById('intake-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function onSubmit() {
    setError('')
    const payload = buildPayload(values)
    setConfirmInput({ payload, detailsOpen })
    document.getElementById('confirm-area')?.scrollIntoView({ behavior: 'smooth' })
  }

  function onReset() {
    setValues(DEFAULTS)
    setDetailsOpen(false)
    setError('')
    setConfirmInput(null)
    setLastResult(null)
    setLastInput(null)
    setCollapsed(false)
  }

  // Sidebar "New analysis" = full reset only when a result is on screen (parity with vanilla).
  function onNewAnalysis() { if (lastResult) onReset() }

  // Confirmation card actions (t4)
  function onEditInputs() {
    setConfirmInput(null)
    setDetailsOpen(true)   // expand the collapsed section so the user can correct the details
    document.getElementById('intake-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function onProceed() {
    if (!confirmInput) return
    setError('')
    setBusy(true)
    try {
      const data = await runAssess(confirmInput.payload)
      setConfirmInput(null)
      setLastResult(data)
      setLastInput(confirmInput.payload)
      setCollapsed(true)
      requestAnimationFrame(() => document.getElementById('out')?.scrollIntoView({ behavior: 'smooth' }))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  function runAssess(payload) {
    return fetch('/api/assess', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error((data.error || ['Request failed']).join('; ')); return data })
  }

  // What-if re-run: debounced, mirrors the vanilla onWIChange (updates results + stats, then tells the chat).
  function onWhatIf(partial) {
    if (!lastInput) return
    const prev = lastInput
    const prevTop = lastResult && lastResult.ranked && lastResult.ranked[0] ? lastResult.ranked[0].name : null
    const next = { ...lastInput, ...partial }
    setLastInput(next)
    clearTimeout(wiTimer.current)
    wiTimer.current = setTimeout(async () => {
      setBusy(true)
      try {
        const data = await runAssess(next)
        setLastResult(data)
        announceWhatIf(prev, next, prevTop, data)
      } catch (e) { /* transient re-run errors are non-fatal; keep last good result */ }
      finally { setBusy(false) }
    }, 400)
  }

  function announceWhatIf(prev, next, prevTop, data) {
    const priLbl = (v) => ({ recyclability: 'Recyclability', material_reduction: 'Reduction', recycled_content: 'Recycled content', cost: 'Cost' }[v] || v)
    const budLbl = (v) => (v ? v[0].toUpperCase() + v.slice(1) : v)
    const ch = []
    if (prev.budgetBand !== next.budgetBand) ch.push('budget to ' + budLbl(next.budgetBand))
    if (prev.priority !== next.priority) ch.push('priority to ' + priLbl(next.priority))
    if (!ch.length) return
    const top = data.ranked && data.ranked[0] ? data.ranked[0].name : null
    let msg = 'You changed ' + ch.join(' and ') + '.'
    if (top) {
      msg += (prevTop && prevTop !== top) ? (' New top recommendation: ' + top + ' (previously ' + prevTop + ').') : (' Top recommendation is still ' + top + '.')
      const nxt = (data.ranked || []).slice(1, 3).map((x) => x.name)
      if (nxt.length) msg += ' Also now: ' + nxt.join(', ') + '.'
    } else {
      msg += ' No eligible options with these settings.'
    }
    if (chatRef.current) chatRef.current.notifyAssistant(msg)
  }

  return (
    <>
      <MeshCanvas />
      <div className="shell">
        <Sidebar onNewAnalysis={onNewAnalysis} />
        <div className="mainwrap">
          <Topbar />
          <main className="content" id="overview">
            {/* Stat tiles — hidden until an assessment runs */}
            <div className="stats-head" hidden={!lastResult}>
              <span className="sh-title">Your review at a glance</span>
              <span className="sh-sub">A quick status summary of this packaging analysis: what's being checked, what's ready, and what still needs you.</span>
            </div>
            <div className="stats" hidden={!lastResult}>
              <StatTile title="Options being checked" foot="Screened against your inputs" icon="flask" tone="ic-green" value={stats.options} />
              <StatTile title="Ready to act" foot="Ranked recommendations" icon="check" tone="ic-cyan" value={stats.ready} />
              <StatTile title="Still to confirm" foot="Open evidence gaps or warnings" icon="search" tone="ic-gold" value={stats.confirm} />
              <StatTile title="Rules to check" foot="EU regulations cited in your evidence" icon="calendar" tone="ic-blue" value={stats.rules} />
            </div>

            {/* Form (left lane) + friendly pathway intro (right lane) */}
            <div className="topgrid" id="topgrid">
              <section id="intake-section">
                <IntakeForm
                  values={values} setValue={setValue}
                  detailsOpen={detailsOpen} onToggleDetails={onToggleDetails}
                  onSubmit={onSubmit} onReset={onReset} onDemo={onDemo}
                  error={error} busy={busy}
                  collapsed={collapsed} onPanelClick={() => setCollapsed(false)}
                />
              </section>
              <div className="pathcard" id="pathcard">
                <div className="pc-intro">
                  <h3>Let Vpack help you</h3>
                  <p className="pc-sub">Fill in your product and we'll take it from there.</p>
                  <ul className="pc-intro-list">
                    <li>Screen options against live EU rules</li>
                    <li>Rank them by your priority and budget</li>
                    <li>Back every claim with evidence you can open</li>
                  </ul>
                </div>
              </div>
            </div>

            <div id="confirm-area">
              {confirmInput && (
                <ConfirmationCard
                  input={confirmInput.payload}
                  detailsOpen={confirmInput.detailsOpen}
                  onProceed={onProceed}
                  onEdit={onEditInputs}
                  busy={busy}
                />
              )}
            </div>

            <div className={'results-grid' + (lastResult ? ' with-panel' : '')} id="results-grid">
              <div id="out">{lastResult && <ResultsMain result={lastResult} input={lastInput} />}</div>
              <div className="right-panel" id="right-panel">{lastResult && <ResultsPanel result={lastResult} input={lastInput} onWhatIf={onWhatIf} busy={busy} />}</div>
            </div>

            <Sources />

            <About />
          </main>
        </div>
      </div>
      <ChatWidget ref={chatRef} contextData={lastResult} onExtracted={onExtracted} />
    </>
  )
}

const ICONS = {
  flask: <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" />,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  calendar: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>,
}

function StatTile({ title, foot, icon, tone, value }) {
  return (
    <div className="stat">
      <div className="st-top">
        <span>{title}</span>
        <span className={'st-ic ' + tone}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[icon]}</svg>
        </span>
      </div>
      <div className="st-num">{String(value ?? 0).padStart(2, '0')}</div>
      <div className="st-foot">{foot}</div>
    </div>
  )
}

// Real numbers from the assessment response — same derivation as the vanilla renderResultsSection().
function computeStats(d) {
  if (!d) return { options: 0, ready: 0, confirm: 0, rules: 0 }
  const ranked = d.ranked || []
  const gaps = ranked.reduce((s, o) => s + ((o.evidenceGaps || []).length + (o.warnings || []).length), 0)
  return {
    options: ranked.length + ((d.screening && d.screening.excluded) || []).length,
    ready: ranked.length,
    confirm: gaps,
    rules: (d.sources || []).filter((s) => s.type === 'regulation').length,
  }
}
