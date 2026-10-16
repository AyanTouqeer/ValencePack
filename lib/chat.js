// lib/chat.js
const { getGenAI, MODEL_CANDIDATES } = require("./gemini"); // You'll need to export getGenAI and MODEL_CANDIDATES from gemini.js

const CHAT_SYSTEM_PROMPT = `You are a compliance assistant for a packaging tool. 
Rules:
1. Context is strictly limited to the provided decision record and source cards.
2. Every factual sentence MUST cite a card ID from the context.
3. NEVER state law from memory. If an article number or date is not in the text, state it is "pending".
4. Use strict vocabulary: "not assessed" (never "cleared") and "modelled" (never "substantiated").`;

async function handleChat(question, contextData, evidenceById) {
  // 1. Intercept Phase: Deterministic Refusals
  // Check if the context relies on any cards that are missing data
  const usedSourceIds = contextData.ranked.flatMap(r => r.sourceIds || []);
  for (const id of usedSourceIds) {
    const card = evidenceById[id];
    if (card && (card.url === null || card.status === "to_collect")) {
      return { answer: `missing: ${id}` };
    }
  }

  // 2. Generation Phase
  const genAI = getGenAI();
  if (!genAI) return { answer: "Chat unavailable (Offline Mode)." };

  const prompt = `
  Context Data: ${JSON.stringify(contextData)}
  Allowed Source Cards: ${JSON.stringify(usedSourceIds.map(id => evidenceById[id]))}
  
  User Question: ${question}
  `;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: CHAT_SYSTEM_PROMPT,
        generationConfig: { temperature: 0.1 } // Extremely low temperature for factual strictness
      });

      const result = await model.generateContent(prompt);
      const answer = result.response.text();

      // 3. Validation Phase: Ensure no hallucinated citations
      // Extract anything that looks like a cited ID (e.g. TECH-GLASS-TRANSPORT)
      const potentialCitations = answer.match(/[A-Z]+-[A-Z-]+/g) || []; 
      for (const citation of potentialCitations) {
        if (!usedSourceIds.includes(citation) && citation !== "CARD-ID") {
            // If it cites something not in the context, reject it.
            return { answer: "Error: Generation failed citation validation." };
        }
      }

      return { answer };
    } catch (e) {
      console.warn(`[Chat] ${modelName} failed.`);
    }
  }
  
  return { answer: "Sorry, the chat engine is currently unavailable." };
}

module.exports = { handleChat };