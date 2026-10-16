const fs = require("fs");
const { GoogleGenAI } = require('@google/genai');

// 1. Initialize the new Google Gen AI client in Vertex AI mode
function getGenAI() {
  if (!process.env.GCP_PROJECT_ID) return null;
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GCP_PROJECT_ID,
    location: process.env.GCP_LOCATION || 'asia-south1',
  });
}

// 2. Default to standard Vertex AI model naming
const MODEL_CANDIDATES = process.env.GEMINI_MODELS
  ? process.env.GEMINI_MODELS.split(",").map(m => m.trim())
  : ["gemini-2.5-flash", "gemini-1.5-flash"]; 

// ==========================================
// Grounded explanation layer
// ==========================================
const SYSTEM = `You write short, plain-language explanations for a packaging decision-support tool.
Rules:
- Use ONLY the facts in the provided JSON. Do not invent outside regulations or numbers.
- Return ONLY valid JSON, no markdown.`;

function buildPrompt(payload) {
  return `Return JSON in exactly this shape:
{
  "summary": "2-3 sentence overview of the top recommendation and the biggest uncertainty",
  "options": [
    { "id": "<option id>",
      "why": [ { "claim": "...", "type": "regulatory|technical|estimate|needs_validation", "sourceIds": ["..."] } ],
      "tradeoffs": ["..."],
      "uncertainties": ["..."] }
  ],
  "nextAction": "single clearest next action",
  "verificationSteps": ["lab or supplier verification needed before implementation"]
}

DATA:
${JSON.stringify(payload)}`;
}

function parseJson(text) {
  const clean = String(text).replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

function fallback(ranked, evidenceById) {
  const safeRanked = ranked || []; 
  const top = safeRanked.length > 0 ? safeRanked[0] : null;
  
  return {
    summary: top
      ? `Best-supported next change to investigate: ${top.name}. Confidence is low until the cited sources are verified.`
      : "No eligible options remained after screening.",
    options: safeRanked.map((r) => ({
      id: r.id,
      why: [{ claim: r.summary || "Mock", type: "needs_validation", sourceIds: (r.sourceIds || []).filter((id) => evidenceById && evidenceById[id]) }],
      tradeoffs: r.warnings || [],
      uncertainties: r.evidenceGaps || []
    })),
    nextAction: top && top.nextSteps && top.nextSteps.length > 0 ? top.nextSteps[0] : "Collect supplier specifications.",
    verificationSteps: safeRanked.flatMap((r) => r.nextSteps || []).slice(0, 5)
  };
}

async function explain(payload, ranked, evidenceById) {
  const ai = getGenAI();
  
  if (!ai) return { ...fallback(ranked, evidenceById), generatedBy: "rules-fallback (no GCP config)" };

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const res = await ai.models.generateContent({
        model: modelName,
        contents: buildPrompt(payload),
        config: {
          systemInstruction: SYSTEM,
          responseMimeType: "application/json",
          temperature: 0.2
        }
      });
      // The new SDK uses res.text, rather than res.response.text()
      const out = parseJson(res.text); 
      return { ...out, generatedBy: `vertex:${modelName}` };
    } catch (err) {
      console.warn(`[AI Explain] ${modelName} failed:`, err.message);
    }
  }

  return { ...fallback(ranked, evidenceById), generatedBy: "rules-fallback (all models failed)" };
}

async function extractPackagingData(filePath, mimeType) {
  const ai = getGenAI();
  if (!ai) throw new Error("Vertex AI not configured.");

  const fileData = {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
      mimeType: mimeType
    }
  };

  const prompt = `Analyze this packaging image or spec sheet. Extract the data into a strict JSON object with these exact keys:
  - productName (string)
  - bottleMaterial (string: "HDPE", "PET", "PP", "glass", or "other")
  - closureType (string: "pump_metal_spring", "mono_pump", or "screw_cap")
  - hasCarton (boolean)
  - fillMl (number)
  
  If a value is not visible or unknown, omit the key or set it to null. Return ONLY valid JSON.`;

  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [prompt, fileData],
    config: {
      temperature: 0.1,
      responseMimeType: "application/json",
    }
  });
  
  return JSON.parse(res.text);
}

module.exports = { explain, getGenAI, MODEL_CANDIDATES, extractPackagingData };