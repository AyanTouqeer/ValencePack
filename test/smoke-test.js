// test/smoke-test.js
const { assess } = require("../lib/assess");

// Universal options allowed across categories
const UNIVERSAL_OPTIONS = ["swap-shrink-sleeve", "mono-material-pump", "glass-bottle", "pla-bottle", "remove-carton"];

async function runSmokeTests() {
  console.log("==========================================");
  console.log(" RUNNING MULTI-CATEGORY ENGINE SMOKE TESTS ");
  console.log("==========================================\n");

  // --- TEST 1: Moisturizer Category Isolation ---
  console.log("[Test 1] Testing Moisturizer Category Isolation...");
  const moisturizerResult = await assess({
    productName: "Daily Face Moisturizer",
    category: "Moisturizer",
    destination: "EU",
    budgetBand: "high",
    priority: "recyclability",
    current: { bottleMaterial: "PET", fillMl: 250, bottleG: 25, closureG: 10, labelG: 2 }
  });
  
  const moisturizerIds = moisturizerResult.ranked.map(x => x.id);
  console.log("-> Ranked Moisturizer options:", moisturizerIds);
  const validMoisturizer = moisturizerIds.every(id => id.startsWith("MO-") || UNIVERSAL_OPTIONS.includes(id));
  console.log(`-> Moisturizer category check: ${validMoisturizer ? "PASSED ✅" : "FAILED ❌"}\n`);

  // --- TEST 2: Surface Cleaner Category Isolation ---
  console.log("[Test 2] Testing Surface Cleaner Category Isolation...");
  const scResult = await assess({
    productName: "Surface Spray",
    category: "Surface cleaner",
    destination: "EU",
    budgetBand: "high",
    priority: "material_reduction",
    current: { bottleMaterial: "HDPE", fillMl: 750, bottleG: 45, closureG: 25, labelG: 2 }
  });
  
  const scIds = scResult.ranked.map(x => x.id);
  console.log("-> Ranked Surface Cleaner options:", scIds);
  const validSc = scIds.every(id => id.startsWith("SC-") || UNIVERSAL_OPTIONS.includes(id));
  console.log(`-> Surface Cleaner category check: ${validSc ? "PASSED ✅" : "FAILED ❌"}\n`);

  // --- TEST 3: Low Budget Strict Cost Band Cutoff ---
  console.log("[Test 3] Testing Low Budget Strict Cutoff...");
  const lowBudgetResult = await assess({
    productName: "Shampoo",
    category: "Shampoo",
    destination: "EU",
    budgetBand: "low",
    priority: "cost",
    current: { bottleMaterial: "PET", fillMl: 500, bottleG: 30, closureG: 4, labelG: 2, cartonG: 0 }
  });
  
  const lowRanked = lowBudgetResult.ranked.map(x => ({ id: x.id, costBand: x.costBand }));
  console.log("-> Low budget ranked items & cost bands:", lowRanked);
  const allCostBand1 = lowRanked.every(x => x.costBand === 1);
  console.log(`-> Low budget strict cutoff check: ${allCostBand1 ? "PASSED ✅" : "FAILED ❌"}\n`);

  console.log("==========================================");
  console.log(" SMOKE TESTS COMPLETE ");
  console.log("==========================================");
}

runSmokeTests().catch(err => {
  console.error("Smoke test failed with unexpected error:", err);
  process.exit(1);
});