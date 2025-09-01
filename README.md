# Brain Damage

<p align="center">
   <img width="1200" height="475" alt="Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</p>

## Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/12ZlZJC836YUDROG64qTvPI09n8TaRP23

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies (installs React, Vite, Firebase SDK, Zustand, Framer Motion):

   ```bash
   npm install
   ```
2. Create a `.env.local` file (ignored by git) and add your Gemini key if you use any AI features (optional right now):

   ```bash
   cp .env.example .env.local
   # then edit .env.local and set GEMINI_API_KEY
   ```
3. (Optional) Adjust Firebase project: The current `firebaseConfig.ts` points to project `noad-5961e`. If you want to use your own project:
   - Create a Firebase Web App in the Firebase console.
   - Copy the config snippet and replace the object in `firebaseConfig.ts`.
   - Enable Authentication (Email/Password) and Firestore in Firebase console.
   - (Optional) Create a user `demo@demo.com` with password `demo` so the demo login (email: demo, password: demo) works.
4. Start the dev server:

   ```bash
   npm run dev
   ```
5. Open the URL printed in the terminal (usually http://localhost:5173 ).

### Demo Login

On the login screen you can either:

- Enter `demo` / `demo` (requires that a user `demo@demo.com` with password `demo` exists in your Firebase Auth) OR
- Sign in with any email/password that exists in your Firebase project's Email/Password auth users list.

### Common Issues

- Blank screen / console error about Firebase analytics: Analytics needs a browser environment (works only on HTTPS or localhost). You can temporarily comment out `getAnalytics(app)` in `firebaseConfig.ts` if needed.
- Auth errors: Ensure Email/Password sign-in is enabled in Firebase console > Authentication > Sign-in method.
- CORS / network errors: Make sure you didn't accidentally block third-party scripts; the project currently loads some libs from CDN via an import map in `index.html`.

### Production Build

```bash
npm run build
npm run preview   # serves the dist build locally
```

### Deploy to Firebase Hosting

1. Login (first time only):

   ```bash
   npx firebase login
   ```
2. Confirm `.firebaserc` has your project (currently `noad-5961e`). To change:

   ```bash
   npx firebase use --add
   ```
3. Build & deploy:

   ```bash
   npm run deploy
   ```
4. Visit the Hosting URL shown in the output.

Caching: `firebase.json` sets long-term caching for hashed assets and no-cache for `index.html` so new deploys invalidate correctly.

### Firestore Security Rules & Indexes
Deploy rules and indexes:
```bash
npx firebase deploy --only firestore:rules,firestore:indexes
```

### Seed Demo Data
Create a demo user (email `demo@demo.com`, password `demo`) then run:
```bash
SEED_EMAIL=demo@demo.com SEED_PASSWORD=demo npm run seed
```
This creates a catalog, a task, a root knowledge folder, and a welcome note.

### Local Emulators
```bash
npm run emulators
```
Add `VITE_USE_EMULATORS=true` to `.env.development` to point the app at emulators during `npm run dev`.

### CI Deployment (optional)

In GitHub Actions or similar:

```bash
npm ci
npm run deploy:ci
```

Supply a `FIREBASE_TOKEN` (from `npx firebase login:ci`) as an environment secret and run the deploy script.


### Updating Dependencies
Because React 19 RC style versions are used (19.1.1), if you encounter type issues you may need to clear node_modules and reinstall.

### Tailwind CSS
Tailwind is injected via the CDN script tag in `index.html`. For a production / purge-optimized setup, consider installing Tailwind locally and removing the CDN script.

### Environment Variables in Vite
`vite.config.ts` exposes `process.env.GEMINI_API_KEY` so you can access it at runtime via `process.env.GEMINI_API_KEY`. Remember to restart the dev server after changing env files.

