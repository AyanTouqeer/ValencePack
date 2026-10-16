const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const EXCEL_PATH = path.join(__dirname, '..', 'data', 'eu_packaging_catalogue_standalone.xlsx');
const workbook = xlsx.readFile(EXCEL_PATH);

const catalogueData = xlsx.utils.sheet_to_json(workbook.Sheets['Packaging_Catalogue']);
const bomData = xlsx.utils.sheet_to_json(workbook.Sheets['Component_BOM']);

const catalogue = catalogueData.map(config => {
  config.components = bomData.filter(bom => bom.Config_ID === config.Config_ID);
  return config;
});

fs.writeFileSync(
  path.join(__dirname, '..', 'data', 'catalogue.json'), 
  JSON.stringify(catalogue, null, 2)
);
console.log('? Generated data/catalogue.json');

const materials = xlsx.utils.sheet_to_json(workbook.Sheets['Material_Cost_Hints']);
const sources = xlsx.utils.sheet_to_json(workbook.Sheets['Source_Register']);

const materialsDatabase = { materials, sources };

fs.writeFileSync(
  path.join(__dirname, '..', 'data', 'materials.json'), 
  JSON.stringify(materialsDatabase, null, 2)
);
console.log('? Generated data/materials.json');
