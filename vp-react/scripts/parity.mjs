// One-off parity check: does the React payload layer reproduce the vanilla read() exactly?
import { DEFAULTS, buildPayload, demoToValues } from '../src/lib/form.js'

// Faithful reimplementation of the vanilla fill()->read() round-trip, driven off a demo object.
// NOTE: untouched <select>s render their first/`selected` option, so blank means the DOM default, not "".
const SELECT_DEFAULTS = { destination: 'EU', bottleMaterial: 'HDPE', closureType: 'pump_metal_spring', labelType: 'shrink_sleeve', budgetBand: 'medium', priority: 'recyclability' }
function vanillaRoundTrip(d) {
  const c = d.current || {}
  const fields = {}
  const set = (n, v) => {
    const isSel = n in SELECT_DEFAULTS
    const val = (v == null || v === '') && isSel ? SELECT_DEFAULTS[n] : (v ?? '')
    fields[n] = { value: String(val), checked: !!v }
  }
  ;['productName', 'destination', 'manufacturingCountry', 'ph', 'hasSurfactants', 'hasFragrance', 'ingredients', 'budgetBand', 'priority'].forEach((n) => set(n, d[n]))
  ;['bottleMaterial', 'closureType', 'labelType', 'hasCarton', 'fillMl', 'bottleG', 'closureG', 'labelG', 'cartonG', 'recycledContentPct'].forEach((n) => set(n, c[n]))
  const v = (n) => (fields[n] ? fields[n].value : '')
  const b = (n) => (fields[n] ? fields[n].checked : false)
  const num = (n) => (v(n) === '' ? undefined : Number(v(n)))
  return {
    productName: v('productName'), category: 'personal_care', destination: v('destination'), manufacturingCountry: v('manufacturingCountry'),
    ph: num('ph'), hasSurfactants: b('hasSurfactants'), hasFragrance: b('hasFragrance'), ingredients: v('ingredients'),
    budgetBand: v('budgetBand'), priority: v('priority'),
    current: { bottleMaterial: v('bottleMaterial'), closureType: v('closureType'), labelType: v('labelType'), hasCarton: b('hasCarton'),
      fillMl: num('fillMl'), bottleG: num('bottleG'), closureG: num('closureG'), labelG: num('labelG'), cartonG: num('cartonG'), recycledContentPct: num('recycledContentPct') },
  }
}

// Canonicalize so undefined-valued keys and missing keys compare equal (JSON drops undefined).
const canon = (o) => JSON.stringify(o)

let failures = 0
const check = (name, a, b) => {
  const ok = canon(a) === canon(b)
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name)
  if (!ok) { failures++; console.log('   react:   ' + canon(a)); console.log('   vanilla: ' + canon(b)) }
}

// Case 1: only the 3 required fields, everything else default-empty (fill() shape: fillMl is under current).
const minimal = { productName: 'Aloe Gel', destination: 'EU', current: { fillMl: 200 } }
check('minimal payload (3 fields)', buildPayload(demoToValues(minimal)), vanillaRoundTrip(minimal))

// Case 2: full detailed set.
const full = {
  productName: 'Herbal Repair Shampoo', destination: 'EU', manufacturingCountry: 'Germany', ph: 5.5,
  hasSurfactants: true, hasFragrance: true, ingredients: 'Aqua, SLS', budgetBand: 'high', priority: 'cost',
  current: { bottleMaterial: 'PET', closureType: 'mono_pump', labelType: 'paper', hasCarton: true, fillMl: 250, bottleG: 30, closureG: 5, labelG: 2, cartonG: 12, recycledContentPct: 30 },
}
check('detailed payload (all fields)', buildPayload(demoToValues(full)), vanillaRoundTrip(full))

// Case 3: live /api/demo round-trip.
try {
  const res = await fetch('http://localhost:8788/api/demo')
  const d = await res.json()
  check('live /api/demo round-trip', buildPayload(demoToValues(d)), vanillaRoundTrip(d))
} catch (e) {
  console.log('SKIP  live /api/demo (backend not reachable: ' + e.message + ')')
}

console.log(failures === 0 ? '\nALL PARITY CHECKS PASSED' : '\n' + failures + ' CHECK(S) FAILED')
process.exit(failures === 0 ? 0 : 1)
