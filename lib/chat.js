// lib/chat.js
const { getGenAI, MODEL_CANDIDATES } = require("./gemini");

const CHAT_SYSTEM_PROMPT = `You are a compliance assistant for a packaging tool. 
Rules:
1. Context is strictly limited to the provided decision record and source cards.
2. Every factual sentence MUST cite a card ID from the context.
3. NEVER state law from memory. If an article number or date is not in the text, state it is "pending".
4. Use strict vocabulary: "not assessed" (never "cleared") and "modelled" (never "substantiated").`;

async function handleChat(question, contextData, evidenceById) {
  // 1. Intercept Phase: Deterministic Refusals
  const usedSourceIds = contextData.ranked?.flatMap(r => r.sourceIds || []) || [];
  for (const id of usedSourceIds) {
    const card = evidenceById[id];
    if (card && (card.url === null || card.status === "to_collect")) {
      return { answer: `missing: ${id}` };
    }
  }

  // 2. Generation Phase
  const genAI = getGenAI();
  if (!genAI) return { answer: "Chat unavailable (AI client not initialized)." };

  const prompt = `
  Context Data: ${JSON.stringify(contextData)}
  Allowed Source Cards: ${JSON.stringify(usedSourceIds.map(id => evidenceById[id]))}
  
  User Question: ${question}
  `;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      // Use the correct @google/genai SDK syntax
      const response = await genAI.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: CHAT_SYSTEM_PROMPT,
          temperature: 0.1
        }
      });

      const answer = response.text;
      if (!answer) continue;

      // 3. Validation Phase: Ensure no hallucinated citations
      const potentialCitations = answer.match(/[A-Z]+-[A-Z-]+/g) || []; 
      for (const citation of potentialCitations) {
        if (!usedSourceIds.includes(citation) && citation !== "CARD-ID") {
            return { answer: "Error: Generation failed citation validation." };
        }
      }

      return { answer };
    } catch (e) {
      console.warn(`[Chat] Model ${modelName} failed:`, e.message);
    }
  }
  
  return { answer: "Sorry, the chat engine is currently unavailable." };
}

module.exports = { handleChat };