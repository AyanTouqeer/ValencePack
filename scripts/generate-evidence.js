// scripts/generate-evidence.js
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const pkPath = path.join(__dirname, '../data/detailed/packaging-knowledge.yaml');
const regPath = path.join(__dirname, '../data/detailed/regulatory.yaml');
const evidencePath = path.join(__dirname, '../data/evidence.json');

function parseYamlFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = yaml.load(fs.readFileSync(filePath, 'utf8'));
  if (!raw) return [];

  // Handle if it's an array
  if (Array.isArray(raw)) return raw;

  // Handle if it's an object dictionary (e.g. { PK01: { title: "..." }, PK02: { ... } })
  return Object.entries(raw).map(([key, value]) => {
    if (typeof value === 'object' && value !== null) {
      return { id: value.id || key, ...value };
    }
    return { id: key, summary: value };
  });
}

function generateEvidence() {
  console.log("Reading detailed knowledge and regulatory YAML files...");
  
  const pkData = parseYamlFile(pkPath);
  const regData = parseYamlFile(regPath);

  const combinedSources = [...pkData, ...regData];
  console.log(`Found ${combinedSources.length} source entries to wire.`);

  const evidenceMap = {};
  for (const source of combinedSources) {
    const id = source.id || source.sourceId;
    if (!id) continue;

    evidenceMap[id] = {
      id: id,
      title: source.title || source.name || id,
      category: source.category || "Technical",
      status: source.status || "verified",
      url: source.url || null,
      summary: source.summary || source.description || source.details || "Derived from packaging knowledge repository.",
      effectiveDate: source.effectiveDate || null
    };
  }

  fs.writeFileSync(evidencePath, JSON.stringify(evidenceMap, null, 2), 'utf8');
  console.log(`Successfully updated ${evidencePath} with ${Object.keys(evidenceMap).length} source cards!`);
}

generateEvidence();