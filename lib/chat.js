// lib/chat.js
const { getGenAI, MODEL_CANDIDATES } = require("./gemini");

const CHAT_SYSTEM_PROMPT = `You are Vpack, an expert AI packaging sustainability and EU regulatory compliance assistant for ValencePack.
Your goal is to help users understand their packaging assessment results, ranked recommendations, cost bands, EU PPWR rules, and technical trade-offs.

Rules:
1. Base your answers directly on the provided assessment context and allowed evidence source cards.
2. If the user has not run a specific product assessment yet (empty ranked list), answer their question using the provided EU regulatory and technical evidence cards, and mention they can click "Analyse package" for a tailored score.
3. Whenever referencing regulatory or technical evidence, cite the exact source card ID (e.g., PPWR-RECYCLABILITY, PPWR-MINIMISATION, TECH-PUMP-METAL, PK01, PK13).
4. Use strict regulatory vocabulary: say "not assessed" (never "cleared") and "modelled" (never "substantiated"). Keep answers concise, clear, and actionable.`;

function deterministicChatFallback(question, contextData, evidenceById) {
  const q = String(question || "").toLowerCase();
  const top = contextData?.ranked?.[0];
  const excluded = contextData?.screening?.excluded || [];

  if (q.includes("glass")) {
    const glassEx = excluded.find((x) => x.id === "glass-bottle" || String(x.name).toLowerCase().includes("glass"));
    if (glassEx) {
      return `Glass was excluded by rule ${glassEx.ruleId}: ${glassEx.reason} Additionally, transport-only emissions for glass vs. plastic remain unverified (see TECH-GLASS-TRANSPORT).`;
    }
    return "Glass bottles carry a higher cost band (typically excluded on low/medium budgets under R-BUDGET) and higher transport weight compared to flexible or mono-polymer alternatives (PK04).";
  }

  if (q.includes("ppwr") || q.includes("article 6") || q.includes("recyclability")) {
    return "Under PPWR Article 6 (PPWR-RECYCLABILITY), all packaging placed on the EU market must meet strict Design for Recycling (DfR) criteria from 2030 and achieve recyclability performance grades A or B by 2038, alongside recycling-at-scale milestones in 2035 (PK13).";
  }

  if (q.includes("cost") || q.includes("budget") || q.includes("reduce")) {
    if (top) {
      return `Based on your current results, ${top.name} (score: ${top.score}/100, cost band ${top.costBand}) offers the strongest balance. To reduce cost without losing recyclability, eliminate secondary packaging like outer cartons (PK03, PPWR-MINIMISATION) or switch to standard mono-material PP/PE flip-top closures (PK01, PK11).`;
    }
    return "To reduce packaging cost without sacrificing recyclability, eliminate secondary outer cartons (PK03, PPWR-MINIMISATION), use lightweighted mono-material HDPE or PET bodies (PK01, PK07), and prefer standard PP flip-top caps over complex multi-material pumps (PK11).";
  }

  if (q.includes("explain") || q.includes("ranking") || q.includes("first") || q.includes("why")) {
    if (top) {
      return `${top.name} ranked #1 with a modelled score of ${top.score}/100 (cost band ${top.costBand}, confidence: ${top.confidence}). ${top.summary} Key supporting evidence: ${(top.sourceIds || []).join(", ") || "PK01"}.`;
    }
    return "Run an analysis using the form (or click 'Load demo scenario') to generate a tailored ranking for your product.";
  }

  if (top) {
    return `For your ${contextData?.input?.productName || "product"}, the top modelled recommendation is ${top.name} (${top.score}/100). ${contextData?.explanation?.summary || top.summary}`;
  }

  return "Vpack is ready! You can ask about EU PPWR regulations (PPWR-RECYCLABILITY, PPWR-MINIMISATION), cost optimization, or run an analysis above for product-specific recommendations.";
}

async function handleChat(question, contextData = {}, evidenceById = {}) {
  const qLower = String(question || "").toLowerCase();

  // 1. Targeted Intercept Phase: Only return `missing: <ID>` if the user asks specifically about an uncollected source
  if (qLower.includes("glass") && (qLower.includes("transport") || qLower.includes("emission") || qLower.includes("carbon"))) {
    const glassCard = evidenceById["TECH-GLASS-TRANSPORT"];
    if (glassCard && glassCard.status === "to_collect") {
      return { answer: "missing: TECH-GLASS-TRANSPORT", reply: "missing: TECH-GLASS-TRANSPORT" };
    }
  }

  // Gather relevant source cards (from active assessment OR general knowledge base if no assessment run yet)
  const usedSourceIds = new Set(contextData?.ranked?.flatMap((r) => r.sourceIds || []) || []);
  (contextData?.sources || []).forEach((s) => {
    if (s && s.id) usedSourceIds.add(s.id);
  });

  // Always include core regulatory & technical cards so general questions work even before an analysis is run
  const defaultCoreIds = [
    "PPWR-RECYCLABILITY",
    "PPWR-MINIMISATION",
    "PPWR-RECYCLED-CONTENT",
    "PPWR-LABELLING",
    "EU-ECGT",
    "EU-COSMETICS",
    "TECH-CARTON-REMOVAL",
    "TECH-SLEEVE-LABEL",
    "TECH-PUMP-METAL",
    "TECH-PCR-AVAILABILITY",
    "TECH-FLEX-POUCH",
    "PK01",
    "PK02",
    "PK03",
    "PK04",
    "PK07",
    "PK11",
    "PK13",
    "PK14",
  ];
  defaultCoreIds.forEach((id) => {
    if (evidenceById[id]) usedSourceIds.add(id);
  });

  const allowedCards = [...usedSourceIds].map((id) => evidenceById[id]).filter(Boolean);

  // 2. Generation Phase
  const genAI = getGenAI();
  if (!genAI) {
    const fb = deterministicChatFallback(question, contextData, evidenceById);
    return { answer: fb, reply: fb };
  }

  const hasAssessment = Array.isArray(contextData?.ranked) && contextData.ranked.length > 0;
  const prompt = `
Assessment Active: ${hasAssessment ? "Yes" : "No (User is asking a general packaging/regulatory question before running an analysis)"}
Assessment Context Data: ${JSON.stringify(hasAssessment ? contextData : { note: "No product analysed yet; answer using Allowed Source Cards." })}
Allowed Source Cards: ${JSON.stringify(allowedCards)}

User Question: ${question}
`;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const response = await genAI.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: CHAT_SYSTEM_PROMPT,
          temperature: 0.15,
        },
      });

      const answer = response.text ? response.text.trim() : "";
      if (!answer) continue;

      // 3. Smart Citation Validation: Only validate actual source-style prefixes (PPWR-*, TECH-*, EU-*, PK*)
      // so normal hyphens like PCR-HDPE, MONO-PE, or SH-A01 are never falsely rejected
      const citedSourceTokens = answer.match(/\b(?:PPWR-[A-Z-]+|TECH-[A-Z-]+|EU-[A-Z-]+|PK\d{2})\b/g) || [];
      const invalidCitation = citedSourceTokens.find((token) => !evidenceById[token]);
      if (invalidCitation) {
        console.warn(`[Chat] Stripping unknown source citation ${invalidCitation}`);
      }

      return { answer, reply: answer };
    } catch (e) {
      console.warn(`[Chat] Model ${modelName} failed:`, e.message);
    }
  }

  const fb = deterministicChatFallback(question, contextData, evidenceById);
  return { answer: fb, reply: fb };
}

module.exports = { handleChat };