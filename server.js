require('dotenv').config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const { assess, evidenceById } = require("./lib/assess");
const { saveReport, getReport } = require("./lib/store");
const { handleChat } = require("./lib/chat");

// --- MULTIMODAL EXTRACTION SETUP ---
const multer = require("multer");
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir }); 
const { extractPackagingData } = require("./lib/gemini");

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => res.json({ 
  ok: true, 
  gemini: !!(process.env.GCP_PROJECT_ID || process.env.GEMINI_API_KEY), 
  firestore: process.env.ENABLE_FIRESTORE === "true" 
}));
app.get("/api/demo", (_req, res) => res.json(JSON.parse(fs.readFileSync(path.join(__dirname, "data", "demo-scenario.json"), "utf8"))));

// --- 1. MULTIMODAL EXTRACTION ENDPOINT ---
app.post("/api/extract", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    const extractedJson = await extractPackagingData(req.file.path, req.file.mimetype);
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); 
    
    res.json(extractedJson);
  } catch (e) {
    console.error("Extraction Error:", e);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: ["Failed to extract data from document."] });
  }
});

// --- 2. CORE ASSESSMENT ENDPOINT ---
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

// --- 3. CHAT ENDPOINT ---
app.post("/api/chat", async (req, res) => {
  try {
    const { question, contextData } = req.body;
    const result = await handleChat(question, contextData, evidenceById);
    res.json(result);
  } catch (e) {
    console.warn("Chat AI unavailable, using deterministic fallback:", e.message);
    
    // Intelligent offline fallback based on common user queries
    const q = (req.body.question || "").toLowerCase();
    let replyText = "The AI chat engine is currently operating in offline mode. ";
    
    if (q.includes("glass")) {
      replyText += "Glass was excluded because its cost band exceeds your selected budget tier (triggering rule R-BUDGET).";
    } else if (q.includes("carton") || q.includes("remove")) {
      replyText += "Removing the outer carton is recommended because it immediately reduces packaging mass without requiring material reformulation.";
    } else if (q.includes("budget") || q.includes("cost")) {
      replyText += "Budget bands restrict options to ensure recommendations match your financial constraints.";
    } else {
      replyText += "Please check the screening breakdown and ranked lists for detailed rule rationales.";
    }
    
    // Return a structured response matching your frontend's expected format
    res.json({ reply: replyText });
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