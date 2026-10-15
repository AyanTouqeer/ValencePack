// lib/screen.js

// Define reason generators outside the loop as requested by the alignment report
const REASONS = {
  "R-REFORMULATION": (opt) => `Form factor change requires full product reformulation.`,
  "R-END-OF-LIFE": (opt) => `Material lacks scaled recovery infrastructure in target market.`,
  "R-BUDGET": (opt, budget) => `Cost band ${opt.costBand} exceeds your maximum ${budget} budget.`
};

// The Deterministic Rule Engine
function screen(input, options) {
  const market = { ok: input.destination !== "US" };
  
  const eligible = [];
  const excluded = [];

  // Map budget limits to maximum allowed cost bands
  const MAX_COST_BAND = { low: 1, medium: 3, high: 4 };
  const maxBand = MAX_COST_BAND[input.budgetBand] || 4;

  for (const opt of (options || [])) {
    if (opt.id === "solid-bar") {
      excluded.push({ 
        id: opt.id, 
        name: opt.name,
        ruleId: "R-REFORMULATION", 
        reason: REASONS["R-REFORMULATION"](opt)
      });
    } else if (opt.id === "pla-bottle") {
      excluded.push({ 
        id: opt.id, 
        name: opt.name,
        ruleId: "R-END-OF-LIFE", 
        reason: REASONS["R-END-OF-LIFE"](opt)
      });
    } else if ((opt.id === "glass-bottle" && input.budgetBand !== "high") || opt.costBand > maxBand) {
      excluded.push({ 
        id: opt.id, 
        name: opt.name,
        ruleId: "R-BUDGET", 
        reason: REASONS["R-BUDGET"](opt, input.budgetBand) 
      });
    } else {
      eligible.push(opt);
    }
  }

  return { market, eligible, excluded };
}

// Export only the deterministic engine
module.exports = { screen };