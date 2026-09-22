import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);

// Only call this in the browser (inside effects or handlers), never during render on the server.
export function getFirebaseAuth() {
  const app = getApps().length ? getApp() : initializeApp(config);
  return getAuth(app);
}

export function getDb() {
  const app = getApps().length ? getApp() : initializeApp(config);
  return getFirestore(app);
}