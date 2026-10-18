const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

// Lazy initialization helper for Firestore
function getFirestoreClient() {
  if (!process.env.GCP_PROJECT_ID) return null;
  return new Firestore({
    projectId: process.env.GCP_PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });
}

// Lazy initialization helper for Vertex AI
function getAIClient() {
  if (!process.env.GCP_PROJECT_ID) return null;
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GCP_PROJECT_ID,
    location: process.env.GCP_LOCATION || 'asia-south1',
  });
}

/**
 * Generates a 768-dimension vector embedding for a given text string.
 */
async function generateEmbedding(text) {
  const ai = getAIClient();
  if (!ai) throw new Error("Vertex AI client not initialized (missing GCP_PROJECT_ID).");

  try {
    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: text
    });
    return response.embeddings[0].values;
  } catch (error) {
    console.error('Error generating embedding via Vertex AI:', error);
    throw error;
  }
}

/**
 * Performs a vector search against Firestore to retrieve the most relevant evidence cards.
 */
async function queryEvidence(queryText, limit = 3) {
  try {
    const db = getFirestoreClient();
    if (!db) {
      console.warn('Firestore not configured. Skipping RAG vector search.');
      return [];
    }

    const queryVector = await generateEmbedding(queryText);

    const snapshot = await db
      .collection('evidence')
      .findNearest('embedding', FieldValue.vector(queryVector), {
        limit: limit,
        distanceMeasure: 'COSINE',
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
    console.warn('RAG query skipped or failed, using static evidence fallback:', error.message);
    return []; 
  }
}

module.exports = {
  generateEmbedding,
  queryEvidence,
};