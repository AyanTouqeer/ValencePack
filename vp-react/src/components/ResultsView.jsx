import { useEffect, useRef, useState } from 'react'

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
// 'High' used to sit in the amber warning pill, so the strongest result looked like a problem.
// Only the levels that genuinely deserve caution get coloured.
const CONFIDENCE_TONE = { high: 'best', medium: undefined, low: 'warn' }
const RULE_LABEL = { 'R-NOT-APPLICABLE': 'Not applicable', 'R-BUDGET': 'Over budget', 'R-REFORMULATION': 'Needs reformulation', 'R-END-OF-LIFE': 'End-of-life risk' }

// A source card's own status decides its label. 'verified' must never read as unverified: the
// References page already calls it Verified, so stamping our own research as doubtful on the
// results screen contradicts us in front of the one reader who matters. Cards marked verified
// but carrying no link say so plainly - that is a real gap, and admitting it is safer than
// implying the citation is reachable when it is not.
const sourceStatusLabel = (s) => {
  if (s.status === 'to_collect') return 'source pending'
  if (s.status === 'verified') return s.url ? 'verified' : 'verified, link pending'
  return 'to be verified against text'
}

// Where the requested fill size actually lives. The payload nests it under current (that is where
// the engine reads it from), so a lookup on the top level returned undefined and the size warning
// below never once fired. Both shapes are tried so the tag survives either side moving the field.
const fillMlOf = (o) => {
  if (!o) return undefined
  const raw = o.fillMl != null && o.fillMl !== '' ? o.fillMl : o.current && o.current.fillMl
  const n = Number(raw)
  return raw == null || raw === '' || !Number.isFinite(n) ? undefined : n
}

// Options are researched at particular fill sizes. When the engine returns a size the user did not
// enter, the card has to say so; otherwise "500 mL refill pouch" reads as advice to someone who
// ships 250 mL. Returns the researched size, or null when it matches or nothing can be compared.
const sizeMismatch = (name, fillMl) => {
  const m = String(name).match(/(\d+(?:[.,]\d+)?)\s*mL/i)
  const want = Number(fillMl)
  if (!m || !want) return null
  const got = Number(m[1].replace(',', '.'))
  return got === want ? null : got
}

// The explanation provenance is a machine string ("rules-fallback (all models failed)"). It tells
// the reader something they should know, so it stays - but said in words a person can act on.
const provenance = (generatedBy) => {
  const g = String(generatedBy || '')
  if (!g) return { text: 'Explanation source not reported', warn: true }
  if (/fallback|failed|offline/i.test(g)) return { text: 'Ranked by rules; AI explanation unavailable', warn: true }
  return { text: 'Explanation: ' + g, warn: false }
}

// The matrix sorts each option's citations into "EU rules" and "Technical evidence". It used to
// decide by id prefix (PPWR*/EU* vs TECH*), which only matched the demo's own naming - the live
// evidence cards are tagged with a type field instead, so real citations fell into neither column
// and the table printed dashes where we actually have research. Follow the card's own type, and
// keep the old prefix test only for cards that carry no type at all.
const isRuleSource = (id, srcById) => {
  const s = srcById[id]
  if (!s) return /^(PPWR|EU)/.test(String(id))
  const t = String(s.type || s.category || '').toLowerCase()
  return t ? t.startsWith('regulat') : /^(PPWR|EU)/.test(String(id))
}

// Table scrollbars are hidden on purpose, because a bare scrollbar inside a rounded card looks
// unfinished on a laptop. On a phone that same choice removes the only hint that six more columns
// exist. Keep the bar hidden and say it in words instead - but only when the table really does
// overflow, and stop saying it once the reader has reached the far column.
function TableScrollHint({ children }) {
  const boxRef = useRef(null)
  const [more, setMore] = useState(false)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const check = () => setMore(
      el.scrollWidth - el.clientWidth > 24 &&
      el.scrollLeft + el.clientWidth < el.scrollWidth - 8
    )
    check()
    el.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => { el.removeEventListener('scroll', check); window.removeEventListener('resize', check) }
  }, [])
  return (
    <>
      <div className="tablebox" ref={boxRef}>{children}</div>
      {more && <p className="scroll-hint">Scroll the table sideways to read the remaining columns.</p>}
    </>
  )
}

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

const Pill = ({ children, tone, title }) => <span className={'pill' + (tone ? ' ' + tone : '')} title={title}>{children}</span>
const SectionTitle = ({ children }) => <h2 className="section-title">{children}</h2>
const Card = ({ className = 'card', children, style }) => <div className={className} style={style}>{children}</div>

// An empty result has three different causes, and the old copy blamed the user's budget for all of
// them. An out-of-market request never reaches screening at all, so telling that user to widen the
// search is untrue; and when the research simply has nothing for their combination, the honest
// answer is "we have not verified this", not an implied rule rejection.
function EmptyState({ d }) {
  const market = d.screening && d.screening.market
  const excluded = (d.screening && d.screening.excluded) || []

  if (market && market.ok === false) {
    return (
      <>
        <h3>Outside the scope of this analysis</h3>
        <p className="muted">
          {(market.notes && market.notes[0])
            || `We screen against EU packaging rules only, so we cannot assess a destination of ${d.input.destination}.`}
        </p>
        <p className="muted">No options were screened or removed for this request. Set the destination market to an EU country to get a ranking.</p>
      </>
    )
  }
  if (excluded.length > 0) {
    return (
      <>
        <h3>No eligible options after screening</h3>
        <p className="muted">Every candidate pack was removed by a rule for your inputs. Adjust the budget or priority in the panel on the right to widen the search, or view the removal reasons below.</p>
      </>
    )
  }
  return (
    <>
      <h3>We have not verified an option for this request</h3>
      <p className="muted">We only recommend pack configurations we have researched. Nothing in the evidence base covers this product, size and format together, so there is no ranking to show rather than a guess.</p>
    </>
  )
}

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
            {s && s.status === 'verified' && !s.url && <span>(link pending)</span>}
            {s && s.status === 'verified' && s.url && <span>✓</span>}
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
  const market = (d.screening && d.screening.market) || {}
  const marketNotes = market.notes || []
  const fillMl = fillMlOf(d.input) || fillMlOf(input)
  const prov = provenance(expl.generatedBy)

  const understood = [
    `Product: ${d.input.productName || '?'}`,
    d.input.category ? `Product type: ${d.input.category}` : null,
    fillMl ? `Fill size: ${fillMl} mL` : null,
    `Material: ${d.input.current?.bottleMaterial || '?'}`,
    `Market: ${d.input.destination}`,
    `Budget: ${BUDGET_LABEL[d.input.budgetBand] || d.input.budgetBand}`,
    `Priority: ${PRIORITY_LABEL[d.input.priority] || d.input.priority}`,
  ].filter(Boolean)

  return (
    <>
      {/* What we understood */}
      <SectionTitle>What we understood</SectionTitle>
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {understood.map((t) => <Pill key={t}>{t}</Pill>)}
        </div>
      </Card>

      {/* Recommendation summary */}
      <SectionTitle>Recommendation</SectionTitle>
      <Card>
        {hasResults
          ? <p className="muted">{expl.summary || 'Ranked options below.'}</p>
          : <EmptyState d={d} />}
        {d.baseline && <p className="muted">Current packaging: {g1(d.baseline.totalGrams)} g total, {g1(d.baseline.gramsPer100ml)} g per 100 ml of product.</p>}
        {expl.nextAction && <p><strong>Next action: </strong>{expl.nextAction}</p>}
        <Pill tone={prov.warn ? 'warn' : undefined} title={prov.warn ? 'The ranking and the evidence behind it are unchanged; only the written explanation is affected.' : undefined}>{prov.text}</Pill>
      </Card>

      {/* Ranked options */}
      <SectionTitle>Ranked options</SectionTitle>
      {(d.ranked || []).map((r, i) => {
        const e = byId[r.id]
        const gap = sizeMismatch(r.name, fillMl)
        return (
          <Card key={r.id || i}>
            <span className="score-num">{r.score.toFixed(0)}/100</span>
            <h3>{i + 1}. {r.name}</h3>
            <div style={{ marginBottom: '8px' }}>
              <Pill>{CHANGE_TYPE_LABEL[r.changeType] || r.changeType}</Pill>
              <Pill>cost band {r.costBand}</Pill>
              <Pill tone={CONFIDENCE_TONE[r.confidence]}>confidence: {CONFIDENCE_LABEL[r.confidence] || r.confidence}</Pill>
              {gap != null && (
                <Pill tone="bad" title={`The evidence for this pack was gathered at ${gap} mL, not at your ${fillMl} mL. The rules still apply; the gram figures are not like-for-like.`}>
                  researched at {gap} mL - you entered {fillMl} mL
                </Pill>
              )}
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
        <p className="muted">Also eligible, ranked lower: {d.alsoConsidered.map((x) => {
          const gap = sizeMismatch(x.name, fillMl)
          return `${x.name} (${x.score.toFixed(0)}${gap != null ? `, researched at ${gap} mL` : ''})`
        }).join('; ')}</p>
      )}

      {/* Compliance screening */}
      <SectionTitle>Compliance screening ({d.input.destination})</SectionTitle>
      <Card>
        {market.ok === true
          ? <p>Pack format is permitted in {d.input.destination}. No market-level exclusions applied.</p>
          : market.ok === false
            ? <p className="warn">Pack format is not permitted in {d.input.destination}. See the notes below.</p>
            : <p className="muted">Market screening completed. See rule hits below.</p>}
        {/* The engine has been sending these since the market rules were loaded; the results screen
            never printed them, so every piece of market advice we researched stayed in the JSON. */}
        {marketNotes.length > 0 && (
          <>
            <h3>Market notes</h3>
            <ul>{marketNotes.map((n, i) => <li key={i} className="muted">{n}</li>)}</ul>
          </>
        )}
        {d.screening?.excluded?.length > 0 && (
          <>
            <h3>Options removed by rules</h3>
            <TableScrollHint>
              <table className="matrix">
                <thead><tr><th>Option</th><th>Rule</th><th>Reason</th></tr></thead>
                <tbody>
                  {d.screening.excluded.map((x, i) => <tr key={i}><td>{x.name}</td><td>{RULE_LABEL[x.ruleId] || x.ruleId}</td><td>{x.reason}</td></tr>)}
                </tbody>
              </table>
            </TableScrollHint>
          </>
        )}
      </Card>

      {/* Transparent evidence matrix */}
      <SectionTitle>Transparent evidence matrix</SectionTitle>
      <p className="muted">Source-tagged signals, not a single opaque score.</p>
      <TableScrollHint>
        <table className="matrix">
          <thead><tr><th>Option</th><th>What changes</th><th>EU rules it checks</th><th>Technical evidence</th><th>How sure</th><th>Watch out for</th></tr></thead>
          <tbody>
            {(d.ranked || []).map((r, i) => {
              const e = byId[r.id]
              const reqTags = [], evTags = []
              ;(e?.why || []).forEach((w) => (w.sourceIds || []).forEach((id) => {
                (isRuleSource(id, srcById) ? reqTags : evTags).push(id)
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
      </TableScrollHint>

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
            {` [${sourceStatusLabel(s)}]`}
          </p>
        ))}
      </Card>
    </>
  )
}
