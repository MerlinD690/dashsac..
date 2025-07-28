// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  projectId: "omoflow-dashboard",
  appId: "1:474308345925:web:5b80ec85cdff90eb95632c",
  storageBucket: "omoflow-dashboard.firebasestorage.app",
  apiKey: "AIzaSyDT5agnM3kbS7ea9C0znR-uTTmyaQ6fnSM",
  authDomain: "omoflow-dashboard.firebaseapp.com",
  measurementId: "",
  messagingSenderId: "474308345925"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);


export { app, db, auth, storage };
