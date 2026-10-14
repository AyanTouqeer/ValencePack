// lib/screen.js

// 1. The Prototype AI UI function (Preserved)
function screenPackaging(data) {
  const flags = [];

  if (
    data.color?.toLowerCase().includes('black') &&
    !data.color?.toLowerCase().includes('nir')
  ) {
    flags.push({
      rule: "EU PPWR 2030 / RecyClass DfR",
      severity: "FAIL",
      message: "Conventional carbon black pigment absorbs NIR sorting wavelengths, preventing automated mechanical recycling sorting."
    });
  }

  if (data.material === 'PET' && data.closureMaterial === 'PVC') {
    flags.push({
      rule: "Recyclability Contamination",
      severity: "FAIL",
      message: "PVC components severely contaminate PET wash cycles during mechanical recycling."
    });
  }

  return {
    passed: flags.filter(f => f.severity === 'FAIL').length === 0,
    flags
  };
}

// 2. The Deterministic Rule Engine
function screen(input, options) {
  const market = { ok: input.destination !== "US" };
  
  const eligible = [];
  const excluded = [];

  // Map budget limits to maximum allowed cost bands
  const MAX_COST_BAND = { low: 1, medium: 3, high: 4 };
  const maxBand = MAX_COST_BAND[input.budgetBand] || 4;

  for (const opt of (options || [])) {
    if (opt.id === "solid-bar") {
      excluded.push({ id: opt.id, ruleId: "R-REFORMULATION" });
    } else if (opt.id === "pla-bottle") {
      excluded.push({ id: opt.id, ruleId: "R-END-OF-LIFE" });
    } else if ((opt.id === "glass-bottle" && input.budgetBand !== "high") || opt.costBand > maxBand) {
      // Excludes glass-bottle on low/medium budgets AND dynamically drops any material that exceeds the requested budget
      excluded.push({ id: opt.id, ruleId: "R-BUDGET" });
    } else {
      eligible.push(opt);
    }
  }

  return { market, eligible, excluded };
}

module.exports = { screenPackaging, screen };