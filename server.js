require('dotenv').config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const { assess } = require("./lib/assess");
const { saveReport, getReport } = require("./lib/store");

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => res.json({ ok: true, gemini: !!process.env.GEMINI_API_KEY, firestore: process.env.ENABLE_FIRESTORE === "true" }));
app.get("/api/demo", (_req, res) => res.json(JSON.parse(fs.readFileSync(path.join(__dirname, "data", "demo-scenario.json"), "utf8"))));

// The core assessment endpoint
app.post("/api/assess", async (req, res) => {
  try {
    const result = await assess(req.body);
    if (result.error) return res.status(400).json(result);
    
    if (saveReport) {
      result.reportId = await saveReport(result);
    }
    res.json(result);
  } catch (e) {
    console.error("Assessment Error:", e);
    res.status(500).json({ error: ["Assessment failed. Please try again."] });
  }
});

app.get("/api/report/:id", async (req, res) => {
  const r = await getReport(req.params.id);
  r ? res.json(r) : res.status(404).json({ error: ["Report not found"] });
});

const port = process.env.PORT || 8080;
if (require.main === module) {
    app.listen(port, () => console.log(`ValencePack MVP backend listening on port ${port}`));
}
module.exports = app;