const fs = require('fs');
const path = require('path');

const OPTIONS_PATH = path.join(__dirname, '..', 'data', 'options.json');
const CATALOGUE_PATH = path.join(__dirname, '..', 'data', 'catalogue.json');

const optionsData = JSON.parse(fs.readFileSync(OPTIONS_PATH, 'utf-8'));
const catalogue = JSON.parse(fs.readFileSync(CATALOGUE_PATH, 'utf-8'));

// Meimuna's confirmed 500mL baseline: SH-C02 (500 mL HDPE squeeze bottle + PP flip-top)
const baselineConfig = catalogue.find(c => c.Config_ID === 'SH-C02');
const baselineMass = (baselineConfig.Total_Empty_Pack_Mass_Low_g + baselineConfig.Total_Empty_Pack_Mass_High_g) / 2;

// Mapping ValencePack option IDs to Catalogue Config IDs
const configMapping = {
  'pcr-resin': 'SH-A01',
  'refill-pouch': 'SH-A02',
  'solid-bar': 'SH-A03',
  'aluminium-bottle': 'SH-A04'
};

optionsData.options = optionsData.options.map(option => {
  const targetConfigId = configMapping[option.id];
  
  if (targetConfigId) {
    const targetConfig = catalogue.find(c => c.Config_ID === targetConfigId);
    
    if (targetConfig) {
      // 1. Calculate massEffect (Percentage change vs 500mL baseline)
      const targetMass = (targetConfig.Total_Empty_Pack_Mass_Low_g + targetConfig.Total_Empty_Pack_Mass_High_g) / 2;
      const massDifference = ((targetMass - baselineMass) / baselineMass) * 100;
      
      // Format as string (e.g., "+5.5%", "-62.8%")
      const sign = massDifference > 0 ? '+' : '';
      option.massEffect = `${sign}${massDifference.toFixed(1)}%`;

      // 2. Calculate costBand (1=Low, 2=Medium, 3=High based on Max EUR Cost)
      const maxCost = targetConfig.Empty_Pack_Cost_High_EUR_each;
      if (maxCost < 0.20) option.costBand = 1;
      else if (maxCost <= 0.60) option.costBand = 2;
      else option.costBand = 3;
    }
  }
  return option;
});

fs.writeFileSync(OPTIONS_PATH, JSON.stringify(optionsData, null, 2));
console.log(`✅ Programmed massEffect & costBand against the 500mL baseline (${baselineMass}g)`);