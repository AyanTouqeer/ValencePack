// lib/chat.js
const { getGenAI, MODEL_CANDIDATES } = require("./gemini");

const CHAT_SYSTEM_PROMPT = `You are an expert AI compliance assistant for the ValencePack packaging assessment platform. 
Your goal is to help users understand their assessment results, ranked recommendations, cost bands, and trade-offs.
Rules:
1. Base your answers directly on the provided context data (assessment results, ranked items, and source cards).
2. Synthesize the ranked options to answer how users can optimize cost, recyclability, or material reduction based on the data.
3. Whenever referencing specific options or metrics, cite their IDs from the context.
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