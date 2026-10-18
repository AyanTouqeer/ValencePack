<div align="center">
  <img src="public/logo-banner.jpg" alt="ValencePack Logo" width="220" style="border-radius: 16px;" />

  # ValencePack — Sustainable Packaging Decision Advisor
  **AI Builder Cup 2026 · Theme 6**

  Evidence-based sustainable packaging decision-support tool for the EU market.

  [![Live Prototype](https://img.shields.io/badge/Live_Prototype-Google_Cloud_Run-34d97e?style=for-the-badge&logo=googlecloud&logoColor=white)](https://valencepack-682316977612.asia-south1.run.app/)
  [![AI Builder Cup 2026](https://img.shields.io/badge/AI_Builder_Cup_2026-Team_Valence_Cache-35c6f2?style=for-the-badge)](#team)
  [![Status](https://img.shields.io/badge/Status-Production_Ready-27835e?style=for-the-badge)](https://github.com/AyanTouqeer/ValencePack)
</div>

---

## Overview

| | |
|---|---|
| **Input** | Product, current packaging (500 mL baseline), EU destination, budget, and priority |
| **Output** | Rules-based screening, ranked top changes with transparent scores, Gemini explanations restricted to the evidence pack, evidence gaps, and verification steps |

## How It Works

1. **Screening** — `lib/screen.js` removes unsuitable options using explicit rule IDs: `R-REFORMULATION`, `R-END-OF-LIFE`, `R-BUDGET`. No AI is involved in this step.
2. **Ranking** — `lib/rank.js` scores each criterion (0–3), with weights set by the user's chosen priority.
3. **Explanation** — `lib/rag.js` and `lib/gemini.js` use Google Cloud Vertex AI (lazily initialized). Gemini is instructed to:
   - explain **only** the supplied facts,
   - cite **only** supplied source IDs,
   - label each claim's type.

   Invented citation IDs are stripped. If Gemini fails, the app falls back to rules-based text.
4. **Storage** — `lib/store.js` saves the report to Firestore when `ENABLE_FIRESTORE=true`.

## Run Locally

```bash
git clone https://github.com/AyanTouqeer/ValencePack.git
cd ValencePack
npm install
cp .env.example .env     # set your GCP_PROJECT_ID and credentials
npm test
npm start                # http://localhost:8080
```

## Deploy (Cloud Run + Firebase Hosting)

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com firestore.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
gcloud firestore databases create --location=eur3        # once

printf "%s" "YOUR_GEMINI_KEY" | gcloud secrets create gemini-key --data-file=-

gcloud run deploy valencepack \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars GCP_PROJECT_ID="valencepack",GCP_LOCATION="asia-south1",ENABLE_FIRESTORE="true"

# Optional: Firebase Hosting front door (firebase.json already rewrites /api/** to Cloud Run)
firebase use YOUR_PROJECT_ID && firebase deploy --only hosting
```

**Notes**
- Grant the Cloud Run service account the **Cloud Datastore User** role so Firestore writes work.
- Check that the model name is current in AI Studio; change `GEMINI_MODEL` if needed.

## Extending

- **Add an option:** append to `data/options.json` (and add its sources to `evidence.json`).
- **Add a sector or market:** add rules in `screen.js` and a new options/evidence set.

## Team

**Team Valence Cache — AI Builder Cup 2026**

| Member | Role |
|---|---|
| Muhammad Ayan Toqeer | Team Lead & Backend Developer |
| Mamuna Ahmad | Frontend Developer & Product Coordinator |
| Aleena | Research, Documentation & Domain Expert |

## License

This project was developed for the AI Builder Cup 2026.