// lib/rag.js
const { Firestore, FieldValue } = require("@google-cloud/firestore");
const { getGenAI } = require("./gemini");
require("dotenv").config();

function getFirestoreClient() {
  if (!process.env.GCP_PROJECT_ID || process.env.ENABLE_FIRESTORE !== "true") return null;
  const opts = { projectId: process.env.GCP_PROJECT_ID };
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    opts.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
  return new Firestore(opts);
}

/**
 * Generates a 768-dimension vector embedding for a given text string.
 */
async function generateEmbedding(text) {
  const ai = getGenAI();
  if (!ai) throw new Error("AI client not initialized.");

  const response = await ai.models.embedContent({
    model: "text-embedding-004",
    contents: text,
  });
  return response.embeddings[0].values;
}

/**
 * Performs a vector search against Firestore to retrieve the most relevant evidence cards.
 */
async function queryEvidence(queryText, limit = 3) {
  try {
    const db = getFirestoreClient();
    if (!db) return [];

    const queryVector = await generateEmbedding(queryText);

    const snapshot = await db
      .collection("evidence")
      .findNearest("embedding", FieldValue.vector(queryVector), {
        limit: limit,
        distanceMeasure: "COSINE",
      })
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      delete data.embedding;
      return {
        id: doc.id,
        ...data,
      };
    });
  } catch (error) {
    console.warn("RAG query skipped or failed, using static evidence fallback:", error.message);
    return [];
  }
}

module.exports = {
  generateEmbedding,
  queryEvidence,
};