require('dotenv').config();

async function getModels() {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await res.json();
    
    if (data.error) return console.error("API Error:", data.error.message);
    
    const validModels = data.models.filter(m => m.supportedGenerationMethods.includes("generateContent"));
    console.log("Valid Models you can put in your .env:");
    validModels.forEach(m => console.log(m.name.replace('models/', '')));
}

getModels();