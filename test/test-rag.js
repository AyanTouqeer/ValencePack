require('dotenv').config();
const { queryEvidence } = require('../lib/rag');

async function test() {
  const query = 'What are the rules regarding metal springs in pump dispensers and recyclability?';
  console.log(`Running vector search for: "${query}"...\n`);

  const results = await queryEvidence(query, 3);

  results.forEach((card, index) => {
    console.log(`[Result ${index + 1}] ID: ${card.id}`);
    console.log(`Status: ${card.status}`);
    console.log(`Citation: ${card.citation || 'N/A'}`);
    console.log('---');
  });
}

test().catch(console.error);