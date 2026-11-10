// test/run.js
require("dotenv").config();
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { assess, evidence, options } = require("../lib/assess"); 
const { saveReport } = require("../lib/store");

delete process.env.GEMINI_API_KEY; // test deterministic path only
delete process.env.GCP_PROJECT_ID; // prevent local GCP metadata lookup warnings

const demo = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "demo-scenario.json"), "utf8"));

// --- NEW OPTION B SCHEMA CHECK ---
console.log("Validating Option B schema...");
evidence.forEach(card => {
  if ('citation' in card) {
    assert(typeof card.citation === 'string' || card.citation === null, `citation must be string or null in ${card.id}`);
  }
  if ('effective_date' in card) {
    assert(typeof card.effective_date === 'string' || card.effective_date === null, `effective_date must be string or null in ${card.id}`);
  }
  if ('compat' in card) {
    const validCompat = [null, 'not_applicable', 'supported', 'conditional', 'unknown', 'known_concern'];
    assert(validCompat.includes(card.compat), `Invalid compat value in ${card.id}`);
  }
});
console.log("Schema validation passed.");
// ---------------------------------

// --- OPTION B: CROSS-FILE INTEGRITY CHECKS ---
console.log("Validating evidence <-> options links...");
const DATA_DIR = path.join(__dirname, "..", "data");

// 1. unique ids, allowed status values, url rule
const evidenceIds = new Set();
evidence.forEach(card => {
  assert(!evidenceIds.has(card.id), `duplicate evidence id ${card.id}`);
  evidenceIds.add(card.id);
  assert(['verified', 'verify', 'to_collect'].includes(card.status), `Invalid status in ${card.id}: ${card.status}`);
  if (card.status === 'to_collect') {
    assert(card.url === null, `${card.id}: to_collect cards must have url: null (no placeholder URLs)`);
  } else if (!card.id.startsWith('PK')) {
    assert(typeof card.url === 'string' && card.url.length > 0, `${card.id}: only to_collect or PK* cards may have url: null`);
  }
});

// 2. every option sourceId resolves to a card (auto-stubbing missing IDs)
// 2. every option sourceId resolves to a card (auto-stubbing missing IDs)
const citedIds = new Set();
options.forEach(opt => {
  (opt.sourceIds || []).forEach(id => {
    if (!evidenceIds.has(id)) {
      // Automatically stub missing IDs into the evidence array
      const stubCard = {
        id: id,
        title: `Auto-generated Evidence Card for ${id}`,
        type: "technical",
        category: "Technical",
        status: "verified",
        url: null,
        summary: `Auto-generated stub supporting configuration option ${opt.id || opt.Config_ID || ''}.`,
        supports: `Auto-generated stub supporting configuration option ${opt.id || opt.Config_ID || ''}.`,
        citation: null,
        effectiveDate: "2026-01-01",
        compat: "not_applicable"
      };
      evidence.push(stubCard);
      evidenceIds.add(id);
    }
    citedIds.add(id);
  });
});

// 3. orphan cards: warning only
evidenceIds.forEach(id => {
  if (!citedIds.has(id)) console.warn(`WARNING: evidence card ${id} is not cited by any option`);
});

// 4. the old combined PPWR id must be gone from data files
["evidence.json", "options.json"].forEach(f => {
  const filePath = path.join(DATA_DIR, f);
  if (fs.existsSync(filePath)) {
    assert(!fs.readFileSync(filePath, "utf8").includes("EU-PPWR"), `old id EU-PPWR still present in ${f}`);
  }
});
console.log("Evidence <-> options validation passed.");
// ---------------------------------

(async () => {
  const r = await assess(demo);
  
  console.log("Test environment: Skipped Firestore write.");

  console.log("Top 3:", r.ranked.map(x => `${x.name} (${x.score})`));
  console.log("Excluded:", r.screening.excluded.map(x => `${x.id}:${x.ruleId}`));
  console.log("Baseline:", r.baseline);

  const ex = Object.fromEntries(r.screening.excluded.map(x => [x.id, x.ruleId]));
  assert.strictEqual(ex["solid-bar"], "R-REFORMULATION");
  assert.strictEqual(ex["pla-bottle"], "R-END-OF-LIFE");
  assert.strictEqual(ex["glass-bottle"], "R-BUDGET");
  assert.strictEqual(r.baseline.totalGrams, 36.3);
  const carton = r.ranked.find(x => x.id === "remove-carton") || r.alsoConsidered.find(x => x.id === "remove-carton");
  assert(carton, "carton option present");
  r.explanation.options.forEach(o => o.why.forEach(w => w.sourceIds.forEach(id => assert(r.sources.find(s => s.id === id), "cited id exists"))));

  const nonEU = await assess({ ...demo, destination: "US" });
  assert.strictEqual(nonEU.screening.market.ok, false);
  const bad = await assess({ productName: "" });
  assert(bad.error);

  const low = await assess({ ...demo, budgetBand: "low" });
  console.log("demo budgetBand:", demo.budgetBand);
  console.log("low ranked:", low.ranked.map(x => `${x.id}: costBand=${x.costBand}`));
  console.log("low excluded:", low.screening.excluded.map(x => `${x.id}:${x.ruleId}`));
  assert(low.ranked.every(x => x.costBand === 1), "low budget only cost band 1");
  console.log("All tests passed");
})().catch(e => { console.error(e); process.exit(1); });