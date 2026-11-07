// lib/screen.js

const REASONS = {
  "R-REFORMULATION": () => `Form factor change requires full product reformulation.`,
  "R-END-OF-LIFE": (opt) => opt.knownUnsuitable || `Insufficient evidence to confirm a mainstream EU collection/recycling route; validation required before commitment.`,
  "R-BUDGET": (opt, budget) => `Cost band ${opt.costBand} exceeds your maximum ${budget} budget.`,
  "R-VOLUME-MISMATCH": (opt, userMl) => `Option nominal size (${opt.nominalMl || opt.Nominal_Fill_or_Functional_Basis || "unknown"} mL) does not match your entered fill volume (${userMl} mL).`,
  "R-MATERIAL-MISMATCH": (opt, userMat) => `Option baseline material does not match your entered bottle material (${userMat}).`
};

// Normalize category names
function normCat(str) {
  return String(str || "").toLowerCase().replace(/[_-]+/g, " ").trim();
}

// Extract numeric ml from strings like "500 mL" or numeric values
function extractMl(val) {
  if (!val) return null;
  if (typeof val === "number") return val;
  const match = String(val).match(/(\d+)\s*(?:ml|mL|L)/);
  if (match) {
    const num = parseInt(match[1], 10);
    return String(val).toLowerCase().includes("l") && !String(val).toLowerCase().includes("ml") ? num * 1000 : num;
  }
  const digits = parseInt(String(val).replace(/\D/g, ""), 10);
  return isNaN(digits) ? null : digits;
}

function screen(input, options) {
  const isEU = input.destination !== "US";
  const market = {
    ok: isEU,
    notes: isEU
      ? [
          "Evaluated against EU Packaging and Packaging Waste Regulation (PPWR - Regulation (EU) 2025/40) design-for-recycling and minimisation criteria.",
          "Environmental marketing claims must comply with Directive (EU) 2024/825 (Empowering Consumers for the Green Transition).",
          "Primary contact packaging must satisfy Regulation (EC) No 1223/2009 safety and labelling mandates."
        ]
      : ["Destination market outside EU scope; EU PPWR screening rules not applied."]
  };

  const eligible = [];
  const excluded = [];

  const MAX_COST_BAND = { low: 1, medium: 3, high: 4 };
  const maxBand = MAX_COST_BAND[input.budgetBand] || 4;

  const userFillMl = Number(input.current?.fillMl || input.fillMl || 0);
  const userBottleMat = String(input.current?.bottleMaterial || input.bottleMaterial || "").toLowerCase();

  for (const opt of (options || [])) {
    const traits = Array.isArray(opt.traits) ? opt.traits : [];

    // Skip baseline reference items from being recommended as upgrades
    if (traits.includes("baseline-reference")) {
      continue;
    }

    let skipOption = false;

    // 1. Strict Volume Matching Check (if option specifies a nominal fill basis)
    const optFillStr = opt.Nominal_Fill_or_Functional_Basis || opt.nominalFill || "";
    const optMl = extractMl(optFillStr);
    if (userFillMl > 0 && optMl && optMl !== userFillMl && !opt.isUniversal) {
      // If it's a rigid container option, enforce strict volume matching to fix the 250mL -> 100mL bug
      if (opt.Configuration_Status && !opt.Configuration_Status.toLowerCase().includes("flexible") && !opt.Configuration_Status.toLowerCase().includes("refill")) {
        // Allow a slight tolerance or match exact category sizing
        if (Math.abs(optMl - userFillMl) > 50) {
          excluded.push({
            id: opt.id || opt.Config_ID,
            name: opt.name || opt.Packaging_Configuration,
            ruleId: "R-VOLUME-MISMATCH",
            reason: REASONS["R-VOLUME-MISMATCH"](opt, userFillMl)
          });
          continue;
        }
      }
    }

    // 2. Respect applicability rules declared in data
    const when = opt.applicableWhen;
    if (when && Object.keys(when).length > 0) {
      const cur = input.current || {};
      for (const [k, v] of Object.entries(when)) {
        const fieldKey = k.endsWith("In") ? k.slice(0, -2) : k;
        const actual = fieldKey === "hasCarton" ? Boolean(cur.hasCarton) : (cur[fieldKey] ?? input[fieldKey]);

        let mismatch = false;
        if (fieldKey === "category") {
          const targetCat = normCat(v);
          const inputCat = normCat(cur.category || input.category || input.productName);

          if (targetCat && inputCat) {
            const targetTokens = targetCat.split(/[/->,\s]+/).filter(Boolean);
            const inputTokens = inputCat.split(/[/->,\s]+/).filter(Boolean);

            const isMatch =
              targetCat === inputCat ||
              targetCat.includes(inputCat) ||
              inputCat.includes(targetCat) ||
              targetTokens.some(t => inputTokens.includes(t));

            if (!isMatch) mismatch = true;
          }
        } else if (Array.isArray(v)) {
          mismatch = actual !== undefined && !v.includes(actual);
        } else {
          mismatch = actual !== v;
        }

        if (mismatch) {
          excluded.push({
            id: opt.id || opt.Config_ID,
            name: opt.name || opt.Packaging_Configuration,
            ruleId: "R-NOT-APPLICABLE",
            reason: `Not applicable: your product doesn't match this option's required setup (${fieldKey}=${actual}).`
          });
          skipOption = true;
          break;
        }
      }
    }

    if (skipOption) continue;

    // 3. Trait & Budget checks
    if (traits.includes("reformulation-risk") || opt.requiresReformulation) {
      excluded.push({
        id: opt.id || opt.Config_ID,
        name: opt.name || opt.Packaging_Configuration,
        ruleId: "R-REFORMULATION",
        reason: REASONS["R-REFORMULATION"](opt)
      });
    } else if (traits.includes("end-of-life-risk") || opt.knownUnsuitable) {
      excluded.push({
        id: opt.id || opt.Config_ID,
        name: opt.name || opt.Packaging_Configuration,
        ruleId: "R-END-OF-LIFE",
        reason: REASONS["R-END-OF-LIFE"](opt)
      });
    } else if ((traits.includes("high-budget-only") && input.budgetBand !== "high") || opt.costBand > maxBand) {
      excluded.push({
        id: opt.id || opt.Config_ID,
        name: opt.name || opt.Packaging_Configuration,
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