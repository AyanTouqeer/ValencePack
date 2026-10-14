# Sustainable Packaging Decision Advisor (AI Builder Cup 2026, Theme 6)

Input: product + current packaging + EU destination + budget + priority.
Output: rules-based screening, ranked top 3 changes with transparent scores, Gemini explanations restricted to the evidence pack, evidence gaps, verification steps.

## How it works
1. `lib/screen.js` removes unsuitable options (rule ids: R-APPLICABLE, R-REFORMULATION, R-END-OF-LIFE, R-BUDGET). No AI.
2. `lib/rank.js` scores 5 criteria (0-3) with weights set by the user's priority.
3. `lib/gemini.js` asks Gemini to explain ONLY the supplied facts, cite only supplied source ids, and label each claim type. Invented citation ids are stripped. Falls back to rules text if Gemini fails.
4. `lib/store.js` saves the report to Firestore when `ENABLE_FIRESTORE=true`.

## IMPORTANT: data status
`data/options.json` ratings are DRAFT hypotheses, and most `data/evidence.json` entries are `to_collect` placeholders.
Aleena/Mamuna must replace each rating with a sourced value and fill in the source URL. Confidence is hard-coded "low" until then.

## Run locally
    npm install
    cp .env.example .env     # add GEMINI_API_KEY, then: export $(cat .env | xargs)
    npm test
    npm start                # http://localhost:8080

## Deploy (Cloud Run + Firebase Hosting)
    gcloud config set project YOUR_PROJECT_ID
    gcloud services enable run.googleapis.com firestore.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
    gcloud firestore databases create --location=eur3        # once
    printf "%s" "YOUR_GEMINI_KEY" | gcloud secrets create gemini-key --data-file=-
    gcloud run deploy packaging-advisor --source . --region europe-west1 --allow-unauthenticated \
      --set-secrets GEMINI_API_KEY=gemini-key:latest --set-env-vars ENABLE_FIRESTORE=true,GEMINI_MODEL=gemini-2.5-flash
    # optional Firebase Hosting front door (firebase.json already rewrites /api/** to Cloud Run)
    firebase use YOUR_PROJECT_ID && firebase deploy --only hosting

Grant the Cloud Run service account the "Cloud Datastore User" role so Firestore writes work.
Check the model name is current in AI Studio; change GEMINI_MODEL if needed.

## Extending
Add an option: append to `data/options.json` (+ sources in `evidence.json`). Add a sector or market: add rules in `screen.js` and a new options/evidence set.
