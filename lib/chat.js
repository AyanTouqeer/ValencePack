// lib/chat.js
const { getGenAI, MODEL_CANDIDATES } = require("./gemini");

const CHAT_SYSTEM_PROMPT = `You are Vpack, an expert AI packaging sustainability and EU regulatory compliance assistant for ValencePack.
Your goal is to help users understand their packaging assessment results, ranked recommendations, cost bands, EU PPWR rules, and technical trade-offs.

CORE BEHAVIORAL RULES FOR WISE & ADAPTIVE REPLIES:
1. Never use canned or repetitive responses. Treat every user question as unique and tailor your tone and content directly to their exact phrasing.
2. Handle Unexpected / Out-of-Scope Questions Wisely: If a user asks about something unrelated to packaging (e.g., general life advice or trivia), gently and cleverly bridge the topic back to packaging sustainability or acknowledge the question with professional wit before steering them back to ValencePack.
3. Balanced Trade-offs: Never present a material or format as entirely "good" or "bad". Always weigh performance, cost, consumer experience, and regulatory compliance (EU PPWR, Green Claims Directive).
4. Traceability: Cite exact source card IDs (e.g., PPWR-RECYCLABILITY, PK04, TECH-PUMP-METAL) when discussing regulations or technical constraints.
5. Strict Terminology: Use "not assessed" (never "cleared") and "modelled" (never "substantiated").`;

function deterministicChatFallback(question, contextData, evidenceById) {
  const q = String(question || "").toLowerCase();
  const top = contextData?.ranked?.[0];
  const excluded = contextData?.screening?.excluded || [];

  if (q.includes("dangerous") || q.includes("safe") || q.includes("toxic") || q.includes("hazard")) {
    return `Regarding safety: Packaging materials in our database (such as PET, HDPE, or glass) comply with general food and cosmetics contact requirements under Regulation (EC) No 1223/2009. Chemical safety depends heavily on formulation interaction, barrier layers, and migration limits (PK17) rather than the base polymer alone.`;
  }

  if (q.includes("glass")) {
    const glassEx = excluded.find((x) => x.id === "glass-bottle" || String(x.name).toLowerCase().includes("glass"));
    if (glassEx) {
      return `Glass was excluded by rule ${glassEx.ruleId}: ${glassEx.reason} Additionally, transport-only emissions comparisons for glass vs. plastic under specific EU distribution scenarios remain unverified (TECH-GLASS-TRANSPORT).`;
    }
    return `Glass offers exceptional chemical inertness and infinite recyclability, making it ideal for luxury cosmetics. However, its high mass significantly increases freight transport emissions (PK04) and capital cost bands compared to flexible or mono-polymer alternatives.`;
  }

  if (q.includes("pouch") || q.includes("flexible")) {
    return `Flexible pouches dramatically reduce primary packaging mass (often by 45–75% vs. rigid bottles), optimizing logistics and lowering carbon footprints (TECH-FLEX-POUCH). However, their recyclability depends strictly on mono-material composition (PE or PP-rich laminates) and local sorting infrastructure.`;
  }

  if (q.includes("ppwr") || q.includes("law") || q.includes("regulation") || q.includes("compliance")) {
    return `Under the EU Packaging and Packaging Waste Regulation (PPWR), commercial packaging must minimize empty space ratios, incorporate mandatory post-consumer recycled (PCR) content thresholds (PPWR-RECYCLED-CONTENT), and meet strict Design for Recycling criteria to achieve grades A or B by 2038 (PPWR-RECYCLABILITY).`;
  }

  if (top) {
    return `Analyzing your query in the context of your ${contextData?.input?.productName || "product"}: The top-modelled recommendation is ${top.name} with a score of ${top.score}/100. Feel free to ask about its specific trade-offs, cost bands, or regulatory backing!`;
  }

  return `That's an interesting angle regarding "${question}". In sustainable packaging design, every choice involves balancing material reduction, circularity, and cost. How can I help you analyze your specific product configuration?`;
}

async function handleChat(question, contextData = {}, evidenceById = {}) {
  const qLower = String(question || "").toLowerCase();

  if (qLower.includes("glass") && (qLower.includes("transport") || qLower.includes("emission"))) {
    const glassCard = evidenceById["TECH-GLASS-TRANSPORT"];
    if (glassCard && glassCard.status === "to_collect") {
      return { answer: "missing: TECH-GLASS-TRANSPORT", reply: "missing: TECH-GLASS-TRANSPORT" };
    }
  }

  const genAI = getGenAI();
  if (!genAI) {
    const fb = deterministicChatFallback(question, contextData, evidenceById);
    return { answer: fb, reply: fb };
  }

  const prompt = `
Context Data: ${JSON.stringify(contextData)}
User Question: ${question}
`;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const response = await genAI.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: CHAT_SYSTEM_PROMPT,
          temperature: 0.4,
        },
      });

      const answer = response.text ? response.text.trim() : "";
      if (!answer) continue;

      return { answer, reply: answer };
    } catch (e) {
      console.warn(`[Chat] Model ${modelName} failed, using dynamic fallback:`, e.message);
    }
  }

  const fb = deterministicChatFallback(question, contextData, evidenceById);
  return { answer: fb, reply: fb };
}

module.exports = { handleChat };