
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDT5agnM3kbS7ea9C0znR-uTTmyaQ6fnSM",
  authDomain: "omoflow-dashboard.firebaseapp.com",
  projectId: "omoflow-dashboard",
  storageBucket: "omoflow-dashboard.firebasestorage.app",
  messagingSenderId: "474308345925",
  appId: "1:474308345925:web:5b80ec85cdff90eb95632c"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
