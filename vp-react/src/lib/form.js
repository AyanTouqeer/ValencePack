// Payload helpers shared by the form, confirmation card and results.
// Mirrors the vanilla read()/fill() exactly so the /api contract is unchanged.

export const DEFAULTS = {
  productName: '', destination: 'EU', fillMl: '',
  manufacturingCountry: '', ph: '', ingredients: '',
  bottleMaterial: 'HDPE', closureType: 'pump_metal_spring', labelType: 'shrink_sleeve',
  bottleG: '', closureG: '', labelG: '', cartonG: '', recycledContentPct: '',
  budgetBand: 'medium', priority: 'recyclability',
  hasSurfactants: false, hasFragrance: false, hasCarton: false,
}

const num = (x) => (x === '' || x == null ? undefined : Number(x))

// flat values -> assess payload (identical shape to vanilla read())
export function buildPayload(v) {
  return {
    productName: v.productName,
    category: 'personal_care',
    destination: v.destination,
    manufacturingCountry: v.manufacturingCountry,
    ph: num(v.ph),
    hasSurfactants: v.hasSurfactants,
    hasFragrance: v.hasFragrance,
    ingredients: v.ingredients,
    budgetBand: v.budgetBand,
    priority: v.priority,
    current: {
      bottleMaterial: v.bottleMaterial,
      closureType: v.closureType,
      labelType: v.labelType,
      hasCarton: v.hasCarton,
      fillMl: num(v.fillMl),
      bottleG: num(v.bottleG),
      closureG: num(v.closureG),
      labelG: num(v.labelG),
      cartonG: num(v.cartonG),
      recycledContentPct: num(v.recycledContentPct),
    },
  }
}

// /api/demo object -> flat values (identical mapping to vanilla fill())
export function demoToValues(d) {
  const c = d.current || {}
  const s = (val, fallback) => (val == null ? fallback : String(val))
  return {
    productName: s(d.productName, DEFAULTS.productName),
    destination: s(d.destination, DEFAULTS.destination),
    manufacturingCountry: s(d.manufacturingCountry, DEFAULTS.manufacturingCountry),
    ph: s(d.ph, DEFAULTS.ph),
    hasSurfactants: !!d.hasSurfactants,
    hasFragrance: !!d.hasFragrance,
    ingredients: s(d.ingredients, DEFAULTS.ingredients),
    budgetBand: s(d.budgetBand, DEFAULTS.budgetBand),
    priority: s(d.priority, DEFAULTS.priority),
    bottleMaterial: s(c.bottleMaterial, DEFAULTS.bottleMaterial),
    closureType: s(c.closureType, DEFAULTS.closureType),
    labelType: s(c.labelType, DEFAULTS.labelType),
    hasCarton: !!c.hasCarton,
    fillMl: s(c.fillMl, DEFAULTS.fillMl),
    bottleG: s(c.bottleG, DEFAULTS.bottleG),
    closureG: s(c.closureG, DEFAULTS.closureG),
    labelG: s(c.labelG, DEFAULTS.labelG),
    cartonG: s(c.cartonG, DEFAULTS.cartonG),
    recycledContentPct: s(c.recycledContentPct, DEFAULTS.recycledContentPct),
  }
}
