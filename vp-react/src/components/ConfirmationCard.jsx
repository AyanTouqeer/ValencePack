// Confirmation card — the honest "What we understood" summary.
// Two variants mirror vanilla showConfirmation(): only the 3 basics when details are closed,
// the full read-back when they're open. Rendered as escaped JSX (no innerHTML), so user text is safe.

const PRIORITY_MAP = {
  recyclability: 'maximize recyclability',
  material_reduction: 'minimize material usage',
  recycled_content: 'increase recycled content',
  cost: 'reduce cost',
}
const pretty = (s) => (s ? s.replace(/_/g, ' ') : null)

// Aleena #1: read the label choice back as a natural phrase — never "film label label".
const LABEL_PHRASE = {
  shrink_sleeve: 'a full-body shrink sleeve',
  paper: 'a paper label',
  film_label: 'a film label',
  direct_print: 'direct printing',
}
// Same treatment for closures, so a split screw cap / flip-top cap reads correctly.
const CLOSURE_PHRASE = {
  pump_metal_spring: 'a metal-spring pump',
  mono_pump: 'a mono-material pump',
  screw_cap: 'a screw cap',
  flip_cap: 'a flip-top cap',
}

export default function ConfirmationCard({ input, detailsOpen, onProceed, onEdit, busy }) {
  const c = input.current || {}

  const simple = (
    <>
      You have <strong>{input.productName || 'a product'}</strong> sold in the <strong>{input.destination}</strong> in a{' '}
      <strong>{c.fillMl || '?'} ml</strong> pack. Vpack will use typical defaults for the rest — or{' '}
      <strong>Add more details</strong> for a sharper match.
    </>
  )

  const detailed = (
    <>
      You have an existing <strong>{input.productName || 'product'}</strong> in a{' '}
      <strong>{c.bottleMaterial} {c.fillMl || '? '}ml</strong> bottle with{' '}
      {CLOSURE_PHRASE[c.closureType] || `a ${pretty(c.closureType) || 'standard'} closure`} and{' '}
      {LABEL_PHRASE[c.labelType] || 'a standard label'}{c.hasCarton ? ', plus an outer carton' : ''}. Your destination market is{' '}
      <strong>{input.destination}</strong>{input.manufacturingCountry ? ', manufactured in ' + input.manufacturingCountry : ''}. You're
      looking to <strong>{PRIORITY_MAP[input.priority] || 'improve sustainability'}</strong> with a <strong>{input.budgetBand}</strong> budget.
    </>
  )

  return (
    <div className="confirm-card">
      <h3>What we understood</h3>
      <p className="understood-text">{detailsOpen ? detailed : simple}</p>
      <div className="confirm-actions">
        <button className="btn-primary" onClick={onProceed} disabled={busy}>{busy ? 'Assessing…' : 'Yes, analyse my product →'}</button>
        <button className="btn-ghost" onClick={onEdit}>Edit my inputs</button>
      </div>
    </div>
  )
}
