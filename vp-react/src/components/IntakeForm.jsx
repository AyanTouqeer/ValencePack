// Presentational intake panel. All state is owned by App (values, detailsOpen) so the
// confirmation/results/reset flow can read and mutate the same source of truth.

function Field({ label, children }) {
  return <div className="field"><label>{label}</label>{children}</div>
}
function Check({ label, name, checked, onChange }) {
  return <label><input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</label>
}

export default function IntakeForm({
  values, setValue, detailsOpen, onToggleDetails,
  onSubmit, onReset, onDemo, onUpload, error, busy, collapsed, onPanelClick,
}) {
  return (
    <div className={'intake' + (collapsed ? ' is-collapsed' : '')} id="intake-panel" onClick={onPanelClick}>
      <div className="intake-head">
        <h2>Fill in what your product uses so we can find better options.</h2>
        <div className="intake-head-actions">
          <button className="intake-upload" id="upload-spec" type="button" onClick={onUpload}
            title="Upload a PDF spec sheet or product photo and we'll fill the form for you">Upload spec sheet</button>
          <button className="intake-reset" id="demo" type="button" onClick={onDemo}>Load demo scenario</button>
        </div>
      </div>

      <form id="f" noValidate onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
        <div className="intake-grid">
          <Field label="Product name">
            <input name="productName" placeholder="e.g. Herbal Repair Shampoo" required
              value={values.productName} onChange={(e) => setValue('productName', e.target.value)} />
          </Field>
          <Field label="Destination market">
            <select name="destination" value={values.destination} onChange={(e) => setValue('destination', e.target.value)}>
              <option value="EU">European Union</option>
            </select>
          </Field>
          <Field label="Fill volume (ml)">
            <input name="fillMl" type="number" min="1" placeholder="500" required
              value={values.fillMl} onChange={(e) => setValue('fillMl', e.target.value)} />
          </Field>
        </div>

        <button className="more-toggle" id="more-toggle" type="button" aria-expanded={detailsOpen} onClick={onToggleDetails}>
          {detailsOpen ? '− Hide extra details' : '+ Add more details (material, weights, budget)'}
        </button>

        <div id="more-details" hidden={!detailsOpen}>
          <div className="intake-grid">
            <Field label="Manufacturing country">
              <input name="manufacturingCountry" placeholder="e.g. Pakistan" value={values.manufacturingCountry} onChange={(e) => setValue('manufacturingCountry', e.target.value)} />
            </Field>
            <Field label="Bottle material">
              <select name="bottleMaterial" value={values.bottleMaterial} onChange={(e) => setValue('bottleMaterial', e.target.value)}>
                <option>HDPE</option><option>PET</option><option>PP</option><option>glass</option><option>other</option>
              </select>
            </Field>
            <Field label="Closure">
              {/* Aleena: a screw cap and a flip-top cap are different closures — separate choices. */}
              <select name="closureType" value={values.closureType} onChange={(e) => setValue('closureType', e.target.value)}>
                <option value="pump_metal_spring">Pump (metal spring)</option><option value="mono_pump">Mono-material pump</option><option value="screw_cap">Screw cap</option><option value="flip_cap">Flip-top cap</option>
              </select>
            </Field>
            {/* Aleena #1: option text drops the word "label" — the field itself already says Label. */}
            <Field label="Label">
              <select name="labelType" value={values.labelType} onChange={(e) => setValue('labelType', e.target.value)}>
                <option value="shrink_sleeve">Full-body shrink sleeve</option><option value="paper">Paper</option><option value="film_label">Film</option><option value="direct_print">Direct print</option>
              </select>
            </Field>
          </div>
          <div className="intake-grid">
            {/* Aleena #2: weights are of the EMPTY pack — say so on the bottle field. Placeholders follow the 500 ml baseline. */}
            <Field label="Bottle (empty, g)"><input name="bottleG" type="number" min="0" step="0.1" placeholder="22" title="Weight of the empty bottle, without contents" value={values.bottleG} onChange={(e) => setValue('bottleG', e.target.value)} /></Field>
            <Field label="Closure (g)"><input name="closureG" type="number" min="0" step="0.1" placeholder="8" value={values.closureG} onChange={(e) => setValue('closureG', e.target.value)} /></Field>
            <Field label="Label (g)"><input name="labelG" type="number" min="0" step="0.1" placeholder="1.3" value={values.labelG} onChange={(e) => setValue('labelG', e.target.value)} /></Field>
            {/* Aleena #4: the carton switch and its weight are one decision — adjacent cells of the
                same grid, so they line up with every other field and the weight greys out when off. */}
            <div className="field">
              <label>Outer carton</label>
              <label className="carton-check">
                <input type="checkbox" name="hasCarton" checked={values.hasCarton}
                  onChange={(e) => { setValue('hasCarton', e.target.checked); if (!e.target.checked) setValue('cartonG', '') }} />
                Has outer carton
              </label>
            </div>
            <Field label="Carton (g)">
              <input name="cartonG" type="number" min="0" step="0.1" placeholder="5" value={values.cartonG}
                disabled={!values.hasCarton} title={values.hasCarton ? 'Weight of the empty carton' : 'Turn on "Has outer carton" to enter this'}
                className={values.hasCarton ? '' : 'is-blocked'}
                onChange={(e) => setValue('cartonG', e.target.value)} />
            </Field>
            <Field label="Recycled content (%)"><input name="recycledContentPct" type="number" min="0" max="100" placeholder="0" value={values.recycledContentPct} onChange={(e) => setValue('recycledContentPct', e.target.value)} /></Field>
          </div>
          <div className="intake-grid">
            <Field label="Budget band">
              <select name="budgetBand" value={values.budgetBand} onChange={(e) => setValue('budgetBand', e.target.value)}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </Field>
            <Field label="Priority">
              <select name="priority" value={values.priority} onChange={(e) => setValue('priority', e.target.value)}>
                <option value="recyclability">Recyclability</option><option value="material_reduction">Material reduction</option><option value="recycled_content">Recycled content</option><option value="cost">Cost</option>
              </select>
            </Field>
            <Field label="Formulation pH"><input name="ph" type="number" step="0.1" placeholder="5.5" value={values.ph} onChange={(e) => setValue('ph', e.target.value)} /></Field>
          </div>
          <div className="intake-grid">
            <Field label="Ingredients (INCI list, optional)">
              <div style={{ gridColumn: '1 / -1' }}>
                <textarea name="ingredients" rows="2" placeholder="Aqua, Sodium Laureth Sulfate, ..." value={values.ingredients} onChange={(e) => setValue('ingredients', e.target.value)} style={{ width: '100%', border: '1px solid #476264', background: '#162d35', color: '#fff', borderRadius: '9px', padding: '10px 11px', fontSize: '13px' }} />
              </div>
            </Field>
          </div>
          <div className="form-bottom">
            <div className="check-row">
              <Check label="Contains surfactants" name="hasSurfactants" checked={values.hasSurfactants} onChange={(v) => setValue('hasSurfactants', v)} />
              <Check label="Contains fragrance / essential oils" name="hasFragrance" checked={values.hasFragrance} onChange={(v) => setValue('hasFragrance', v)} />
            </div>
          </div>
        </div>

        <div className="form-bottom">
          <div className="intake-actions">
            <button className="btn-primary" id="go" type="submit" disabled={busy}>{busy ? 'Assessing…' : 'See my options'}</button>
            <button className="btn-ghost" id="reset-form" type="button" onClick={onReset}>New analysis</button>
          </div>
          <div id="err" role="alert">{error}</div>
        </div>
      </form>
    </div>
  )
}
