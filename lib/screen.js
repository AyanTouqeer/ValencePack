// lib/screen.js

const REASONS = {
  "R-REFORMULATION": () => `Form factor change requires full product reformulation.`,
  "R-END-OF-LIFE": (opt) => opt.knownUnsuitable || `Insufficient evidence to confirm a mainstream EU collection/recycling route; validation required before commitment.`,
  "R-BUDGET": (opt, budget) => `Cost band ${opt.costBand} exceeds your maximum ${budget} budget.`
};

// Normalize category names (e.g. "body_wash" or "Body wash" -> "body wash")
function normCat(str) {
  return String(str || "").toLowerCase().replace(/[_-]+/g, " ").trim();
}

function screen(input, options) {
  const market = { ok: input.destination !== "US" };
  
  const eligible = [];
  const excluded = [];

  const MAX_COST_BAND = { low: 1, medium: 3, high: 4 };
  const maxBand = MAX_COST_BAND[input.budgetBand] || 4;

  for (const opt of (options || [])) {
    const traits = Array.isArray(opt.traits) ? opt.traits : [];

    // Skip "Common current" reference baselines from catalogue.json so they aren't recommended as upgrades
    if (traits.includes("baseline-reference")) {
      continue;
    }

    // 1. Respect applicability declared in data or inferred by adapter
    const when = opt.applicableWhen;
    let skipOption = false;
    
    if (when && Object.keys(when).length > 0) {
      const cur = input.current || {};
      for (const [k, v] of Object.entries(when)) {
        // Support options.json keys ending in "In" (e.g., bottleMaterialIn -> bottleMaterial)
        const fieldKey = k.endsWith("In") ? k.slice(0, -2) : k;
        const actual = fieldKey === "hasCarton" ? Boolean(cur.hasCarton) : (cur[fieldKey] ?? input[fieldKey]);

        let mismatch = false;
        if (fieldKey === "category") {
          // If user input specifies a category/product, ensure catalogue item matches it
          const targetCat = normCat(v);
          const inputCat = normCat(input.category || input.productName);
          if (inputCat && targetCat && !inputCat.includes(targetCat) && !targetCat.includes(inputCat)) {
            mismatch = true;
          }
        } else if (Array.isArray(v)) {
          mismatch = actual !== undefined && !v.includes(actual);
        } else {
          mismatch = actual !== v;
        }
        
        if (mismatch) {
          excluded.push({ 
            id: opt.id, 
            name: opt.name, 
            ruleId: "R-NOT-APPLICABLE",
            reason: `Not applicable: your product doesn't match this option's required setup (${fieldKey}=${actual}).` 
          });
          skipOption = true;
          break;
        }
      }
    }
    
    if (skipOption) continue;

    // 2. Data-driven trait & property checks
    if (traits.includes("reformulation-risk") || opt.requiresReformulation) {
      excluded.push({ 
        id: opt.id, 
        name: opt.name,
        ruleId: "R-REFORMULATION", 
        reason: REASONS["R-REFORMULATION"](opt)
      });
    } else if (traits.includes("end-of-life-risk") || opt.knownUnsuitable) {
      excluded.push({ 
        id: opt.id, 
        name: opt.name,
        ruleId: "R-END-OF-LIFE", 
        reason: REASONS["R-END-OF-LIFE"](opt)
      });
    } else if ((traits.includes("high-budget-only") && input.budgetBand !== "high") || opt.costBand > maxBand) {
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

module.exports = { screen };