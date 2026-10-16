const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

// 1. Initialize Firestore client
const db = new Firestore({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

// 2. Initialize the new Google Gen AI client in Vertex AI mode
const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GCP_PROJECT_ID,
  location: process.env.GCP_LOCATION || 'asia-south1',
});

/**
 * Generates a 768-dimension vector embedding for a given text string.
 */
async function generateEmbedding(text) {
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
 * @param {string} queryText - The prompt or packaging description to search against.
 * @param {number} limit - Number of evidence cards to return (default: 3).
 * @returns {Promise<Array<Object>>} - Matching evidence cards sorted by cosine similarity.
 */
async function queryEvidence(queryText, limit = 3) {
  try {
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
    console.error('Error querying vector evidence:', error);
    throw error;
  }
}

module.exports = {
  db,
  FieldValue,
  generateEmbedding,
  queryEvidence,
};