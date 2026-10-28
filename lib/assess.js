// lib/assess.js
const fs = require("fs");
const path = require("path");
const { queryEvidence } = require("./rag");
const { screen } = require("./screen");
const { rank, baseline } = require("./rank");
const { explain } = require("./gemini");

const DATA_DIR = path.join(__dirname, "..", "data");
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const loadJsonIfExists = (fullPath) => {
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
};

// Normalize a source card so both Option B (sources.json) and PK* (evidence.json) schemas work seamlessly
function normalizeCard(card) {
  if (!card || !card.id) return null;
  const summaryText = card.summary || card.supports || "Derived from packaging knowledge repository.";
  const effDate = card.effectiveDate !== undefined ? card.effectiveDate : (card.effective_date ?? null);
  return {
    ...card,
    id: card.id,
    title: card.title || card.id,
    type: card.type || (String(card.category).toLowerCase() === "regulatory" ? "regulation" : "technical"),
    category: card.category || (card.type === "regulation" ? "Regulatory" : "Technical"),
    status: card.status || "verified",
    url: card.url ?? null,
    summary: summaryText,
    supports: card.supports || summaryText,
    citation: card.citation !== undefined ? card.citation : null,
    effectiveDate: effDate,
    effective_date: card.effective_date !== undefined ? card.effective_date : effDate,
    compat: card.compat !== undefined ? card.compat : "not_applicable"
  };
}

// Load and merge both data/evidence.json and data/sources.json (or public/sources.json)
const rawEvidence = loadJsonIfExists(path.join(DATA_DIR, "evidence.json")) || {};
const rawSourcesData = loadJsonIfExists(path.join(DATA_DIR, "sources.json")) || loadJsonIfExists(path.join(PUBLIC_DIR, "sources.json")) || [];

const evidenceListA = Array.isArray(rawEvidence) ? rawEvidence : Object.values(rawEvidence);
const evidenceListB = Array.isArray(rawSourcesData) ? rawSourcesData : Object.values(rawSourcesData);

const evidenceById = {};
for (const item of [...evidenceListB, ...evidenceListA]) {
  const norm = normalizeCard(item);
  if (norm) {
    // Prefer entry with a populated URL if duplicate IDs exist
    if (!evidenceById[norm.id] || (!evidenceById[norm.id].url && norm.url)) {
      evidenceById[norm.id] = norm;
    }
  }
}
const evidence = Object.values(evidenceById);

const rawCatalogue = loadJsonIfExists(path.join(DATA_DIR, "catalogue.json")) || [];
const legacyOptionsObj = loadJsonIfExists(path.join(DATA_DIR, "options.json")) || { options: [] };
const legacyOptions = legacyOptionsObj.options || [];

// Derive traits for screen.js
function deriveTraits(item) {
  if (Array.isArray(item.traits)) return item.traits;

  const traits = [];
  const status = (item.Configuration_Status || "").toLowerCase();
  const materials = (item.Primary_Materials || "").toLowerCase();

  if (status === "common current") {
    traits.push("baseline-reference");
  }
  if (status.includes("format change")) {
    traits.push("reformulation-risk");
  }
  if (materials.includes("pla")) {
    traits.push("end-of-life-risk");
  }
  if (materials.includes("glass")) {
    traits.push("high-budget-only");
  }
  return traits;
}

// Derive 0-3 scores and metadata required by rank.js from catalogue.json fields
function deriveRankingFields(item) {
  const config = (item.Packaging_Configuration || "").toLowerCase();
  const materials = (item.Primary_Materials || "").toLowerCase();
  const status = (item.Configuration_Status || "").toLowerCase();

  let scores = { reduction: 1, recyclability: 2, recycledContent: 0, feasibility: 2 };
  let recyclabilityLevel = "moderate";
  let changeType = "material-swap";
  let massEffect = item.Mass_Change_vs_Baseline || "unknown";

  if (config.includes("pcr")) {
    scores = { reduction: 0, recyclability: 2, recycledContent: 3, feasibility: 2 };
    recyclabilityLevel = "moderate";
    changeType = "recycled-content";
    if (!massEffect.includes("%")) massEffect = "+5.5%";
  } else if (config.includes("pouch")) {
    scores = { reduction: 3, recyclability: 1, recycledContent: 1, feasibility: 2 };
    recyclabilityLevel = "weak";
    changeType = "format";
    if (!massEffect.includes("%")) massEffect = "-60%";
  } else if (config.includes("pod") || config.includes("refill")) {
    scores = { reduction: 2, recyclability: 2, recycledContent: 0, feasibility: 2 };
    recyclabilityLevel = "moderate";
    changeType = "format";
    if (!massEffect.includes("%")) massEffect = "-45%";
  } else if (materials.includes("aluminium")) {
    scores = { reduction: 1, recyclability: 3, recycledContent: 2, feasibility: 1 };
    recyclabilityLevel = "strong";
    changeType = "material-swap";
  } else if (status.includes("format change")) {
    scores = { reduction: 3, recyclability: 3, recycledContent: 0, feasibility: 0 };
    recyclabilityLevel = "strong";
    changeType = "format";
    if (!massEffect.includes("%")) massEffect = "-80%";
  }

  return {
    scores: item.scores || scores,
    recyclabilityLevel: item.recyclabilityLevel || recyclabilityLevel,
    changeType: item.changeType || changeType,
    massEffect: item.massEffect || massEffect,
    compatWarnings: item.compatWarnings || (item.Compatibility_and_Performance_Flags ? [{ warning: item.Compatibility_and_Performance_Flags }] : []),
    extraGaps: item.extraGaps || (item.Required_Catalogue_Data ? [item.Required_Catalogue_Data] : []),
    nextSteps: item.nextSteps || (item.Required_Catalogue_Data ? [`Verify with supplier: ${item.Required_Catalogue_Data}`] : [])
  };
}

// Map the 29 catalogue.json items into the engine schema
const mappedCatalogue = rawCatalogue.map((item) => {
  let calculatedBand = item.costBand;
  if (!calculatedBand) {
    const cost = item.Empty_Pack_Cost_Low_EUR_each || 0;
    if (cost >= 0.50) calculatedBand = 4;
    else if (cost >= 0.25) calculatedBand = 3;
    else if (cost >= 0.15) calculatedBand = 2;
    else calculatedBand = 1;
  }

  const parsedSourceIds = Array.isArray(item.sourceIds)
    ? item.sourceIds
    : (item.Source_IDs ? item.Source_IDs.split(";").map((s) => s.trim()).filter(Boolean) : []);

  const rankingFields = deriveRankingFields(item);

  return {
    ...item,
    ...rankingFields,
    id: item.id || item.Config_ID,
    name: item.name || item.Packaging_Configuration,
    summary: item.summary || item.Important_Notes || item.Packaging_Configuration,
    costBand: calculatedBand,
    sourceIds: parsedSourceIds,
    traits: deriveTraits(item),
    applicableWhen: item.applicableWhen || (item.Product ? { category: item.Product.split("-")[0].trim() } : {})
  };
});

// Keep universal component-level options from options.json
const KEEP_LEGACY_IDS = ["remove-carton", "swap-shrink-sleeve", "mono-material-pump", "glass-bottle", "pla-bottle", "solid-bar"];
const crossCuttingLegacy = legacyOptions
  .filter((opt) => KEEP_LEGACY_IDS.includes(opt.id))
  .map((opt) => ({
    ...opt,
    traits: [
      ...(opt.requiresReformulation ? ["reformulation-risk"] : []),
      ...(opt.knownUnsuitable ? ["end-of-life-risk"] : []),
      ...(opt.id === "glass-bottle" ? ["high-budget-only"] : [])
    ]
  }));

const options = [...mappedCatalogue, ...crossCuttingLegacy];

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

  const r = rank(s.eligible, input, evidenceById);
  const staticUsed = new Set(r.ranked.flatMap((x) => x.sourceIds || []));

  // === RAG WIRING INJECTION ===
  const searchQuery = `${input.productName} in ${input.current.fillMl}mL ${input.current.bottleMaterial}. Constraints: ${input.priority}`;

  let vectorEvidence = [];
  try {
    vectorEvidence = await queryEvidence(searchQuery, 3);
  } catch (err) {
    console.warn("RAG query failed:", err.message);
  }

  const staticEvidence = [...staticUsed].map((id) => evidenceById[id]).filter(Boolean);

  const combinedEvidence = [...staticEvidence];
  vectorEvidence.forEach((ragCard) => {
    const normRag = normalizeCard(ragCard);
    if (normRag && !combinedEvidence.some((e) => e.id === normRag.id)) {
      combinedEvidence.push(normRag);
    }
  });

  const payload = {
    product: {
      name: input.productName,
      category: input.category,
      ph: input.ph,
      hasSurfactants: input.hasSurfactants,
      hasFragrance: input.hasFragrance,
      ingredients: input.ingredients
    },
    destination: input.destination,
    budgetBand: input.budgetBand,
    priority: input.priority,
    ranked: r.ranked.map(({ id, name, summary, score, breakdown, warnings, evidenceGaps, sourceIds, massImpact }) => ({
      id, name, summary, score, breakdown, warnings, evidenceGaps, sourceIds, massImpact
    })),
    evidence: combinedEvidence
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
    sources: combinedEvidence,
    disclaimer: "Decision support only. Not legal advice, not a compliance certification, and not laboratory-verified compatibility."
  };
}

module.exports = { assess, evidence, options, evidenceById, queryEvidence };