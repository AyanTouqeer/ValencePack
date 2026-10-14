// Transparent ranking. Criteria are scored 0-3, weights depend on the user's priority.
const WEIGHTS = {
  recyclability:     { reduction: 0.20, recyclability: 0.45, recycledContent: 0.10, budgetFit: 0.10, feasibility: 0.15 },
  material_reduction:{ reduction: 0.45, recyclability: 0.20, recycledContent: 0.05, budgetFit: 0.10, feasibility: 0.20 },
  recycled_content:  { reduction: 0.10, recyclability: 0.20, recycledContent: 0.40, budgetFit: 0.10, feasibility: 0.20 },
  cost:              { reduction: 0.15, recyclability: 0.15, recycledContent: 0.05, budgetFit: 0.45, feasibility: 0.20 }
};
const LABELS = { reduction: "Packaging reduction", recyclability: "Recyclability evidence", recycledContent: "Recycled content", budgetFit: "Budget fit", feasibility: "Practical feasibility" };

function totalMass(c) {
  return ["bottleG", "closureG", "labelG", "cartonG"].reduce((s, k) => s + (Number(c[k]) || 0), 0);
}
function gramsPer100ml(g, fillMl) {
  return fillMl > 0 ? Math.round((g / fillMl) * 100 * 10) / 10 : null;
}

function baseline(input) {
  const c = input.current;
  const g = totalMass(c);
  return { totalGrams: g, gramsPer100ml: gramsPer100ml(g, Number(c.fillMl)) };
}

function massImpact(opt, input) {
  const c = input.current;
  if (opt.massEffect === "remove:carton" && Number(c.cartonG) > 0) {
    const g = totalMass(c) - Number(c.cartonG);
    return { newTotalGrams: g, newGramsPer100ml: gramsPer100ml(g, Number(c.fillMl)), basis: "Computed from your entered component weights." };
  }
  if (opt.massEffect === "none") return { basis: "No change in packaging mass expected." };
  return { basis: "Requires supplier specification to quantify." };
}

function rank(eligible, input) {
  const w = WEIGHTS[input.priority] || WEIGHTS.recyclability;
  const scored = eligible.map((opt) => {
    const s = { ...opt.scores, budgetFit: Math.max(0, 4 - opt.costBand) };
    const breakdown = Object.keys(w).map((k) => ({
      criterion: k, label: LABELS[k], score: s[k], weight: w[k], contribution: Math.round((w[k] * s[k] / 3) * 1000) / 10
    }));
    const score = Math.round(breakdown.reduce((a, b) => a + b.contribution, 0) * 10) / 10;
    
    // FIX: Add an empty array fallback so missing warnings don't crash the spread operator
    const gaps = [...(opt.extraGaps || []), ...(opt.warnings || [])];
    
    return {
      id: opt.id, name: opt.name, summary: opt.summary, changeType: opt.changeType,
      costBand: opt.costBand, recyclabilityLevel: opt.recyclabilityLevel,
      score, breakdown, warnings: opt.warnings || [], evidenceGaps: gaps,
      confidence: "low", // stays low until every cited source is collected and verified
      sourceIds: opt.sourceIds, nextSteps: opt.nextSteps || [],
      massImpact: massImpact(opt, input)
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return { weights: w, ranked: scored.slice(0, 3), alsoConsidered: scored.slice(3) };
}

module.exports = { rank, baseline, WEIGHTS, LABELS };