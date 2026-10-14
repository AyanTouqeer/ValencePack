// Optional Firestore persistence for saved reports. Disabled unless ENABLE_FIRESTORE=true.
let db = null;
function getDb() {
  if (db) return db;
  const admin = require("firebase-admin");
  if (!admin.apps.length) admin.initializeApp();
  db = admin.firestore();
  return db;
}
async function saveReport(report) {
  if (process.env.ENABLE_FIRESTORE !== "true") return null;
  try {
    const ref = await getDb().collection("reports").add({ ...report, createdAt: new Date().toISOString() });
    return ref.id;
  } catch (e) { console.error("Firestore save failed:", e.message); return null; }
}
async function getReport(id) {
  if (process.env.ENABLE_FIRESTORE !== "true") return null;
  try { const d = await getDb().collection("reports").doc(id).get(); return d.exists ? d.data() : null; }
  catch (e) { console.error("Firestore read failed:", e.message); return null; }
}
module.exports = { saveReport, getReport };
