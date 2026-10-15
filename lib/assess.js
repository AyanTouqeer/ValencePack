const fs = require("fs");
const path = require("path");
const { screen } = require("./screen");
const { rank, baseline } = require("./rank");
const { explain } = require("./gemini");

const load = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", f), "utf8"));
const evidence = load("evidence.json").sources;
const options = load("options.json").options;
const evidenceById = Object.fromEntries(evidence.map((s) => [s.id, s]));

function validate(i) {
  const errs = [];
  if (!i || typeof i !== "object") return ["Missing input"];
  if (!i.productName) errs.push("productName is required");
  if (!i.current || !i.current.bottleMaterial) errs.push("current.bottleMaterial is required");
  if (!(Number(i.current && i.current.fillMl) > 0)) errs.push("current.fillMl must be > 0");
  if (!["low", "medium", "high"].includes(i.budgetBand)) errs.push("budgetBand must be low|medium|high");
  if (!["recyclability", "material_reduction", "recycled_content", "cost"].includes(i.priority)) errs.push("invalid priority");
  return errs;
}

async function assess(input) {
  const errors = validate(input);
  if (errors.length) return { error: errors };
  
  const s = screen(input, options);
  if (!s.market.ok) return { input, screening: { market: s.market, excluded: [] }, ranked: [], explanation: null };
  
  const r = rank(s.eligible, input);
  const used = new Set(r.ranked.flatMap((x) => x.sourceIds));
  
  const payload = {
    product: { name: input.productName, category: input.category, ph: input.ph, hasSurfactants: input.hasSurfactants, hasFragrance: input.hasFragrance, ingredients: input.ingredients },
    destination: input.destination, budgetBand: input.budgetBand, priority: input.priority,
    ranked: r.ranked.map(({ id, name, summary, score, breakdown, warnings, evidenceGaps, sourceIds, massImpact }) => ({ id, name, summary, score, breakdown, warnings, evidenceGaps, sourceIds, massImpact })),
    evidence: [...used].map((id) => evidenceById[id]).filter(Boolean)
  };
  
  const explanation = await explain(payload, r.ranked, evidenceById);
  
  return {
    input,
    baseline: baseline(input),
    screening: { market: s.market, excluded: s.excluded },
    weights: r.weights,
    ranked: r.ranked,
    alsoConsidered: r.alsoConsidered.map((x) => ({ id: x.id, name: x.name, score: x.score })),
    explanation,
    sources: [...used].map((id) => evidenceById[id]).filter(Boolean),
    disclaimer: "Decision support only. Not legal advice, not a compliance certification, and not laboratory-verified compatibility."
  };
}

module.exports = { assess, evidence, options, evidenceById };