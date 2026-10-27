import { useEffect, useState } from 'react'

// Results view — the React port of the vanilla renderResultsSection().
// Exports the main column (<ResultsMain/>, into #out) and the right panel (<ResultsPanel/>, into #right-panel).

const PRIORITY_LABEL = { recyclability: 'Recyclability', material_reduction: 'Material reduction', recycled_content: 'Recycled content', cost: 'Cost' }
const BUDGET_LABEL = { low: 'Low', medium: 'Medium', high: 'High' }

// Grams come out of raw arithmetic (31.299999999999997). One decimal is all a reader needs.
const g1 = (n) => (n == null ? n : Number(n).toFixed(1))

// The engine returns machine tokens; a reader should never see them raw. Display-only -
// unknown tokens fall through to the original string rather than disappearing.
const CHANGE_TYPE_LABEL = { eliminate: 'Eliminate a component', 'design-for-recycling': 'Design for recycling', 'recycled-content': 'Recycled content', format: 'Change pack format', 'material-swap': 'Swap material' }
const CONFIDENCE_LABEL = { low: 'Low', medium: 'Medium', high: 'High' }
const RULE_LABEL = { 'R-NOT-APPLICABLE': 'Not applicable', 'R-BUDGET': 'Over budget', 'R-REFORMULATION': 'Needs reformulation', 'R-END-OF-LIFE': 'End-of-life risk' }

// The 'What to verify next' checklist used to be a bare, forgettable checkbox. State now persists
// locally per step text, and the section shows a live progress count. This does NOT feed back
// into the engine (by design) - it's the user's own working checklist, not an input.
function useVerifyState(steps) {
  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vp-verify') || '{}') } catch { return {} }
  })
  useEffect(() => {
    try { localStorage.setItem('vp-verify', JSON.stringify(checked)) } catch { /* storage unavailable, ignore */ }
  }, [checked])
  const toggle = (text) => setChecked((c) => ({ ...c, [text]: !c[text] }))
  const doneCount = steps.filter((s) => checked[s]).length
  return { checked, toggle, doneCount }
}

const Pill = ({ children, tone }) => <span className={'pill' + (tone ? ' ' + tone : '')}>{children}</span>
const SectionTitle = ({ children }) => <h2 className="section-title">{children}</h2>
const Card = ({ className = 'card', children, style }) => <div className={className} style={style}>{children}</div>

function EvidenceChips({ sourceIds, srcById }) {
  return (
    <div className="chips-line">
      {(sourceIds || []).map((id) => {
        const s = srcById[id]
        const pending = s && s.status === 'to_collect'
        return (
          <div key={id} className={'chip-item' + (pending ? ' pending' : '')}>
            {s && s.url
              ? <a href={s.url} target="_blank" rel="noopener" title={id}>{s.title || id}</a>
              : <span title={id}>{s?.title || id}</span>}
            {pending && <span>(source pending)</span>}
            {s && s.status === 'verified' && <span>✓</span>}
          </div>
        )
      })}
    </div>
  )
}

export function ResultsMain({ result: d, input }) {
  const expl = d.explanation || {}
  const byId = Object.fromEntries((expl.options || []).map((o) => [o.id, o]))
  const srcById = Object.fromEntries((d.sources || []).map((s) => [s.id, s]))
  const hasResults = d.ranked && d.ranked.length > 0

  return (
    <>
      {/* What we understood */}
      <SectionTitle>What we understood</SectionTitle>
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {[
            `Product: ${d.input.productName || '?'}`,
            `Material: ${d.input.current?.bottleMaterial || '?'}`,
            `Market: ${d.input.destination}`,
            `Budget: ${BUDGET_LABEL[d.input.budgetBand] || d.input.budgetBand}`,
            `Priority: ${PRIORITY_LABEL[d.input.priority] || d.input.priority}`,
          ].map((t) => <Pill key={t}>{t}</Pill>)}
        </div>
      </Card>

      {/* Recommendation summary */}
      <SectionTitle>Recommendation</SectionTitle>
      <Card>
        {hasResults
          ? <p className="muted">{expl.summary || 'Ranked options below.'}</p>
          : <>
            <h3>No eligible options after screening</h3>
            <p className="muted">Every candidate pack was removed by a rule for your inputs. Adjust the budget or priority in the panel on the right to widen the search, or view the removal reasons below.</p>
          </>}
        {d.baseline && <p className="muted">Current packaging: {g1(d.baseline.totalGrams)} g total, {g1(d.baseline.gramsPer100ml)} g per 100 ml of product.</p>}
        {expl.nextAction && <p><strong>Next action: </strong>{expl.nextAction}</p>}
        <Pill>Explanations: {expl.generatedBy || 'n/a'}</Pill>
      </Card>

      {/* Ranked options */}
      <SectionTitle>Ranked options</SectionTitle>
      {(d.ranked || []).map((r, i) => {
        const e = byId[r.id]
        return (
          <Card key={r.id || i}>
            <span className="score-num">{r.score.toFixed(0)}/100</span>
            <h3>{i + 1}. {r.name}</h3>
            <div style={{ marginBottom: '8px' }}>
              <Pill>{CHANGE_TYPE_LABEL[r.changeType] || r.changeType}</Pill>
              <Pill>cost band {r.costBand}</Pill>
              <Pill tone="warn">confidence: {CONFIDENCE_LABEL[r.confidence] || r.confidence}</Pill>
            </div>
            <p className="muted">{r.summary}</p>
            {(r.breakdown || []).map((b, j) => (
              <div key={j}>
                <div className="muted">{b.label} - importance {Math.round(b.weight * 100)}% - score {b.score} of 3</div>
                <div className="bar"><span style={{ width: (b.score / 3 * 100) + '%' }} /></div>
              </div>
            ))}
            {r.massImpact && (
              <p className="muted">
                Mass: {r.massImpact.newGramsPer100ml ? `${g1(r.massImpact.newTotalGrams)} g total, ${g1(r.massImpact.newGramsPer100ml)} g per 100 ml. ` : ''}{r.massImpact.basis}
              </p>
            )}
            {e && (
              <>
                <h3>Why</h3>
                {(e.why || []).map((w, k) => (
                  <div key={k} style={{ marginBottom: '8px' }}>
                    <p className="muted">{w.claim}</p>
                    <EvidenceChips sourceIds={w.sourceIds} srcById={srcById} />
                  </div>
                ))}
                {(e.tradeoffs || []).length > 0 && <><h3>Trade-offs</h3><ul>{e.tradeoffs.map((t, k) => <li key={k}>{t}</li>)}</ul></>}
                {(e.uncertainties || []).length > 0 && (
                  <>
                    <h3>Evidence gaps</h3>
                    <ul>{e.uncertainties.map((t, k) => <li key={k} style={{ color: 'var(--gold)' }}>{t}</li>)}</ul>
                  </>
                )}
              </>
            )}
          </Card>
        )
      })}
      {d.alsoConsidered?.length > 0 && (
        <p className="muted">Also eligible, ranked lower: {d.alsoConsidered.map((x) => `${x.name} (${x.score.toFixed(0)})`).join('; ')}</p>
      )}

      {/* Compliance screening */}
      <SectionTitle>Compliance screening ({d.input.destination})</SectionTitle>
      <Card>
        {d.screening?.market?.ok === true
          ? <p>Pack format is permitted in {d.input.destination}. No market-level exclusions applied.</p>
          : d.screening?.market?.ok === false
            ? <p className="warn">Pack format is not permitted in {d.input.destination}. See rule hits below.</p>
            : <p className="muted">Market screening completed. See rule hits below.</p>}
        {d.screening?.excluded?.length > 0 && (
          <>
            <h3>Options removed by rules</h3>
            <div className="tablebox">
              <table className="matrix">
                <thead><tr><th>Option</th><th>Rule</th><th>Reason</th></tr></thead>
                <tbody>
                  {d.screening.excluded.map((x, i) => <tr key={i}><td>{x.name}</td><td>{RULE_LABEL[x.ruleId] || x.ruleId}</td><td>{x.reason}</td></tr>)}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Transparent evidence matrix */}
      <SectionTitle>Transparent evidence matrix</SectionTitle>
      <p className="muted">Source-tagged signals, not a single opaque score.</p>
      <div className="tablebox">
        <table className="matrix">
          <thead><tr><th>Option</th><th>What changes</th><th>EU rules it checks</th><th>Technical evidence</th><th>How sure</th><th>Watch out for</th></tr></thead>
          <tbody>
            {(d.ranked || []).map((r, i) => {
              const e = byId[r.id]
              const reqTags = [], evTags = []
              ;(e?.why || []).forEach((w) => (w.sourceIds || []).forEach((id) => {
                if (id.startsWith('PPWR') || id.startsWith('EU')) reqTags.push(id)
                if (id.startsWith('TECH')) evTags.push(id)
              }))
              return (
                <tr key={r.id || i}>
                  <td>{r.name}</td>
                  <td>{CHANGE_TYPE_LABEL[r.changeType] || r.changeType}</td>
                  <td>{reqTags.length ? reqTags.map((t) => <span key={t} className="flat-tag" title={t}>{srcById[t]?.title || t}</span>) : '-'}</td>
                  <td>{evTags.length ? evTags.map((t) => <span key={t} className="flat-tag" title={t}>{srcById[t]?.title || t}</span>) : '-'}</td>
                  <td>{CONFIDENCE_LABEL[r.confidence] || r.confidence}</td>
                  <td className="risk">{(e?.uncertainties || [])[0] || '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Report export */}
      <Card className="card noprint" style={{ textAlign: 'center' }}>
        <button className="btn-primary" onClick={() => window.print()}>Print / save as PDF</button>
      </Card>
    </>
  )
}

export function ResultsPanel({ result: d, input, onWhatIf, busy }) {
  const expl = d.explanation || {}
  const steps = expl.verificationSteps || []
  const { checked, toggle, doneCount } = useVerifyState(steps)

  return (
    <>
      {/* Pathway stepper — first item so it aligns with "What we understood" */}
      <div className="pathcard">
        <p className="pc-steps-title">Analysis pathway</p>
        <div className="stepper">
          {[['s1', '01', 'Package', 'done'], ['s2', '02', 'Options', 'active'], ['s3', '03', 'Evidence', 'done'], ['s4', '04', 'Decision', 'active']].map(([id, n, lbl, cls]) => (
            <div key={id} id={id} className={'step ' + cls}>
              <div className="step-node">{n}</div>
              <div className="step-label">{lbl}</div>
            </div>
          ))}
        </div>
        <p className="pc-foot">The connected path shows how product constraints, regional requirements, and environmental claims inform the decision.</p>
      </div>

      {/* What-if */}
      <div className="whatif">
        <h3>Refine your recommendation</h3>
        <div className="whatif-controls">
          <div className="whatif-field">
            <label>Budget</label>
            <select id="wi-budget" value={input.budgetBand} disabled={busy} onChange={(e) => onWhatIf({ budgetBand: e.target.value, priority: input.priority })}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </div>
          <div className="whatif-field">
            <label>Priority</label>
            <select id="wi-priority" value={input.priority} disabled={busy} onChange={(e) => onWhatIf({ budgetBand: input.budgetBand, priority: e.target.value })}>
              <option value="recyclability">Recyclability</option><option value="material_reduction">Reduction</option><option value="recycled_content">Recycled content</option><option value="cost">Cost</option>
            </select>
          </div>
        </div>
        <p className="whatif-hint">Change what matters most and what you can spend. Re-runs the analysis instantly.</p>
      </div>

      {/* Verify */}
      {steps.length > 0 && (
        <div className="verify" id="verify">
          <h3>What to verify next</h3>
          <p>{doneCount} of {steps.length} checked off - resolve these before acting on the ranking. This list is yours to work through; ticking it does not change the score.</p>
          <ul className="verify-list">
            {steps.map((s, i) => <li key={i}><label><input type="checkbox" checked={!!checked[s]} onChange={() => toggle(s)} /> <span>{s}</span></label></li>)}
          </ul>
        </div>
      )}

      {/* Assumptions & sources */}
      <Card>
        <h3>Assumptions &amp; sources</h3>
        <ul>
          <li>Scores are 0–3 ratings from a draft evidence base and weighted by your stated priority; they are not measured values.</li>
          <li>Compatibility is screened, never verified. Laboratory testing is required before any change.</li>
          <li>{d.disclaimer || ''}</li>
        </ul>
        {(d.sources || []).map((s) => (
          <p key={s.id} className="muted">
            {s.url
              ? <a href={s.url} target="_blank" rel="noopener">{s.title}</a>
              : <span>{s.title}</span>}
            {` [${s.status === 'to_collect' ? 'source pending' : 'to be verified against text'}]`}
          </p>
        ))}
      </Card>
    </>
  )
}
