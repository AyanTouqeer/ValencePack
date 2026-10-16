require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { db, FieldValue, generateEmbedding } = require('../lib/rag');

const EVIDENCE_FILE = path.join(__dirname, '..', 'data', 'evidence.json');

async function seedDatabase() {
  console.log('Loading evidence cards...');
  const rawData = fs.readFileSync(EVIDENCE_FILE, 'utf8');
  const evidenceData = JSON.parse(rawData);

  // 1. Locate the array of cards inside the JSON structure
  let cards = [];

  if (Array.isArray(evidenceData)) {
    cards = evidenceData;
  } else {
    // Check if the cards array is stored under any top-level property
    const arrayKey = Object.keys(evidenceData).find(key => Array.isArray(evidenceData[key]));
    if (arrayKey) {
      cards = evidenceData[arrayKey];
    } else {
      // If it's a key-value map of cards, ignore metadata fields starting with "_"
      cards = Object.entries(evidenceData)
        .filter(([key]) => !key.startsWith('_'))
        .map(([key, val]) => ({
          id: val.id || key,
          ...val,
        }));
    }
  }

  console.log(`Found ${cards.length} cards. Starting embedding generation...`);

  const batch = db.batch();

  for (const card of cards) {
    const cardId = card.id || `card-${Date.now()}`;
    const textChunk = `Card ID: ${cardId}. Compatibility: ${card.compat || 'Unknown'}. Status: ${card.status || 'Active'}. Citation: ${card.citation || 'None'}. Full Details: ${JSON.stringify(card)}`;

    console.log(`Generating embedding for: ${cardId}...`);
    const embeddingValues = await generateEmbedding(textChunk);

    const docRef = db.collection('evidence').doc(cardId);
    batch.set(docRef, {
      ...card,
      embedding: FieldValue.vector(embeddingValues),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  console.log('Committing batch write to Firestore...');
  await batch.commit();
  console.log('✅ Successfully seeded Firestore with ValencePack vector evidence!');
}

seedDatabase().catch((err) => {
  console.error('Failed to seed database:', err);
  process.exit(1);
});