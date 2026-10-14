require("dotenv").config();
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { assess } = require("../lib/assess");
const { saveReport } = require("../lib/store");

delete process.env.GEMINI_API_KEY; // test deterministic path only
const demo = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "demo-scenario.json"), "utf8"));

(async () => {
  const r = await assess(demo);
  
  // Step 2: Trigger the database write
  const docId = await saveReport(r);
  console.log("Saved report to Firestore with ID:", docId);

  console.log("Top 3:", r.ranked.map(x => `${x.name} (${x.score})`));
  console.log("Excluded:", r.screening.excluded.map(x => `${x.id}:${x.ruleId}`));
  console.log("Baseline:", r.baseline);

  const ex = Object.fromEntries(r.screening.excluded.map(x => [x.id, x.ruleId]));
  assert.strictEqual(ex["solid-bar"], "R-REFORMULATION");
  assert.strictEqual(ex["pla-bottle"], "R-END-OF-LIFE");
  assert.strictEqual(ex["glass-bottle"], "R-BUDGET");
  assert.strictEqual(r.baseline.totalGrams, 60);
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