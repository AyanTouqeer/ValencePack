// scripts/generate-evidence.js
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const pkPath = path.join(__dirname, '../data/detailed/packaging-knowledge.yaml');
const regPath = path.join(__dirname, '../data/detailed/regulatory.yaml');
const sourcesJsonPath = path.join(__dirname, '../data/sources.json');
const publicSourcesJsonPath = path.join(__dirname, '../public/sources.json');
const evidencePath = path.join(__dirname, '../data/evidence.json');

function parseYamlFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = yaml.load(fs.readFileSync(filePath, 'utf8'));
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Object.entries(raw).map(([key, value]) => {
    if (typeof value === 'object' && value !== null) {
      return { id: value.id || key, ...value };
    }
    return { id: key, summary: value };
  });
}

function loadSourcesJson() {
  const target = fs.existsSync(sourcesJsonPath) ? sourcesJsonPath : (fs.existsSync(publicSourcesJsonPath) ? publicSourcesJsonPath : null);
  if (!target) return [];
  const raw = JSON.parse(fs.readFileSync(target, 'utf8'));
  return Array.isArray(raw) ? raw : Object.values(raw);
}

function generateEvidence() {
  console.log("Merging packaging-knowledge, regulatory YAML, and Option B sources.json...");

  const pkData = parseYamlFile(pkPath);
  const regData = parseYamlFile(regPath);
  const optionBSources = loadSourcesJson();

  // Combine optionBSources first so that verified URLs from sources.json take precedence over null PK placeholders
  const combinedSources = [...optionBSources, ...pkData, ...regData];
  console.log(`Found ${combinedSources.length} total source entries to merge.`);

  const evidenceMap = {};
  for (const source of combinedSources) {
    const id = source.id || source.sourceId;
    if (!id) continue;

    const summaryText = source.summary || source.supports || source.description || source.details || "Derived from packaging knowledge repository.";
    const effDate = source.effectiveDate || source.effective_date || null;
    const urlVal = source.url ?? null;
    const statusVal = urlVal ? "verified" : (source.status || "verified");

    // If already exists and has a URL, keep it; otherwise update
    if (!evidenceMap[id] || (!evidenceMap[id].url && urlVal)) {
      evidenceMap[id] = {
        id: id,
        title: source.title || source.name || id,
        type: source.type || (String(source.category).toLowerCase() === "regulatory" ? "regulation" : "technical"),
        category: source.category || (source.type === "regulation" ? "Regulatory" : "Technical"),
        status: statusVal,
        url: urlVal,
        summary: summaryText,
        supports: source.supports || summaryText,
        citation: source.citation ?? null,
        effectiveDate: effDate,
        effective_date: effDate,
        compat: source.compat ?? "not_applicable"
      };
    }
  }

  fs.writeFileSync(evidencePath, JSON.stringify(evidenceMap, null, 2), 'utf8');
  console.log(`Successfully merged and updated ${evidencePath} with ${Object.keys(evidenceMap).length} unified source cards!`);
}

generateEvidence();