// lib/gemini.js
const fs = require("fs");
const { GoogleGenAI } = require("@google/genai");

// 1. Initialize Google Gen AI client (supports Vertex AI on Cloud Run + API Key fallback)
function getGenAI() {
  if (process.env.GEMINI_API_KEY) {
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  if (process.env.GCP_PROJECT_ID) {
    return new GoogleGenAI({
      vertexai: true,
      project: process.env.GCP_PROJECT_ID,
      location: process.env.GCP_LOCATION || "us-central1",
    });
  }
  return null;
}

// 2. Support both GEMINI_MODELS and GEMINI_MODEL env vars
const envModelRaw = process.env.GEMINI_MODELS || process.env.GEMINI_MODEL;
const MODEL_CANDIDATES = envModelRaw
  ? [...new Set([...envModelRaw.split(",").map((m) => m.trim()).filter(Boolean), "gemini-2.5-flash", "gemini-1.5-flash"])]
  : ["gemini-2.5-flash", "gemini-1.5-flash"];

// ==========================================
// Grounded explanation layer
// ==========================================
const SYSTEM = `You write short, plain-language explanations for a packaging decision-support tool.
Rules:
- Use ONLY the facts in the provided JSON. Do not invent outside regulations or numbers.
- Never output raw internal machine tokens or underscores like "material_reduction" or "pump_metal_spring"; use natural phrasing.
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
  const clean = String(text || "").replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

function fallback(ranked, evidenceById) {
  const safeRanked = ranked || [];
  const top = safeRanked.length > 0 ? safeRanked[0] : null;

  return {
    summary: top
      ? `Best-supported next change to investigate: ${top.name}. Confidence is ${top.confidence || "moderate"} based on current regulatory and technical evidence.`
      : "No eligible options remained after screening.",
    options: safeRanked.map((r) => ({
      id: r.id,
      why: [
        {
          claim: r.summary || "Recommended packaging configuration based on priority weighting.",
          type: "technical",
          sourceIds: (r.sourceIds || []).filter((id) => evidenceById && evidenceById[id]),
        },
      ],
      tradeoffs: r.warnings || [],
      uncertainties: r.evidenceGaps || [],
    })),
    nextAction:
      top && top.nextSteps && top.nextSteps.length > 0
        ? top.nextSteps[0]
        : "Request exact supplier specification sheets and run filled-pack compatibility testing.",
    verificationSteps: safeRanked.flatMap((r) => r.nextSteps || []).slice(0, 5),
  };
}

async function explain(payload, ranked, evidenceById) {
  const ai = getGenAI();

  if (!ai) return { ...fallback(ranked, evidenceById), generatedBy: "rules-fallback (no AI config)" };

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const res = await ai.models.generateContent({
        model: modelName,
        contents: buildPrompt(payload),
        config: {
          systemInstruction: SYSTEM,
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });
      const out = parseJson(res.text);
      // Ensure all sourceIds in LLM output exist in evidenceById
      if (Array.isArray(out.options) && evidenceById) {
        out.options.forEach((opt) => {
          (opt.why || []).forEach((w) => {
            w.sourceIds = (w.sourceIds || []).filter((id) => Boolean(evidenceById[id]));
          });
        });
      }
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
      mimeType: mimeType,
    },
  };

  const prompt = `Analyze this packaging image or spec sheet. Extract the data into a strict JSON object with these exact keys:
  - productName (string)
  - category (string: "Shampoo", "Body wash", "Moisturizer", or "Surface cleaner")
  - bottleMaterial (string: "HDPE", "PET", "PP", "glass", or "other")
  - closureType (string: "pump_metal_spring", "mono_pump", or "screw_cap")
  - labelType (string: "shrink_sleeve", "paper", "film_label", or "direct_print")
  - hasCarton (boolean)
  - fillMl (number)
  - bottleG (number)
  - closureG (number)
  - labelG (number)
  - cartonG (number)
  - recycledContentPct (number)

  If a value is not visible or unknown, omit the key or set it to null. Return ONLY valid JSON.`;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const res = await ai.models.generateContent({
        model: modelName,
        contents: [prompt, fileData],
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      });
      return parseJson(res.text);
    } catch (err) {
      console.warn(`[Extract] ${modelName} failed:`, err.message);
    }
  }
  throw new Error("All models failed during packaging extraction.");
}

module.exports = { explain, getGenAI, MODEL_CANDIDATES, extractPackagingData };