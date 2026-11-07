import { useEffect, useState } from 'react'

// Sources library — fetches the static reference list and renders it as a table.
// Ported from the vanilla renderSources(); status is honest (verified vs pending).
// The API's evidence cards call a regulation category:"Regulatory" and date it with
// effectiveDate; the static list here calls it type:"regulation" and effective_date. Same research,
// two spellings, and this page only understood one of them - so the moment the two lists are joined
// up, seven regulations would silently relabel themselves as technical evidence. Read either.
const isRegulation = (s) => /^regulat/i.test(String(s.type || s.category || ''))
const effectiveDate = (s) => s.effective_date || s.effectiveDate || ''

export default function Sources() {
  const [rows, setRows] = useState(null) // null = loading, [] = none, array = loaded
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/sources.json')
      .then((r) => r.json())
      .then((data) => { if (alive) setRows(Array.isArray(data) ? data : []) })
      .catch(() => { if (alive) { setFailed(true); setRows([]) } })
    return () => { alive = false }
  }, [])

  return (
    <section id="sources" className="sources">
      <h2 className="section-title">
        Sources{rows ? <span className="src-count"> · {rows.length} references</span> : null}
      </h2>
      <p className="muted">Every recommendation traces back to these references — EU regulations and technical evidence. Status is honest: anything not yet verified against the source text is marked pending.</p>
      <div className="tablebox">
        <table className="matrix sources-table">
          <thead><tr><th>Source</th><th>Type</th><th>What it supports</th><th>Effective</th><th>Status</th></tr></thead>
          <tbody>
            {rows === null
              ? <tr><td className="src-none" colSpan={5}>Loading sources…</td></tr>
              : rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.url
                      ? <a href={s.url} target="_blank" rel="noopener">{s.title}</a>
                      : <span>{s.title}</span>}
                    <div className="src-id">{s.id}</div>
                  </td>
                  <td>{isRegulation(s) ? 'Regulation' : 'Technical'}</td>
                  <td>{s.supports || ''}</td>
                  <td className="src-none">{effectiveDate(s) || (isRegulation(s) ? 'Date pending' : 'n/a - not a dated rule')}</td>
                  <td>
                    <span className={'src-status ' + (s.status === 'verified' ? 'ok' : 'pending')}>
                      {s.status === 'verified' ? (s.url ? 'Verified' : 'Verified, link pending') : 'Source pending'}
                    </span>
                  </td>
                </tr>
              ))}
            {failed && <tr><td className="src-none" colSpan={5}>Sources could not be loaded right now.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}
