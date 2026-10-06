import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBDjDP5xEzoHBjZFXePKORranIpMK1nBIY",
  authDomain: "beam-tracker-a9961.firebaseapp.com",
  projectId: "beam-tracker-a9961",
  storageBucket: "beam-tracker-a9961.firebasestorage.app",
  messagingSenderId: "426915683220",
  appId: "1:426915683220:web:e19bb5d418322d79d28d81"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

setPersistence(auth, browserLocalPersistence).catch(console.error);
enableIndexedDbPersistence(db).catch(err => {
  if (err.code !== "failed-precondition" && err.code !== "unimplemented") console.warn("Firestore offline persistence unavailable:", err);
});

export {
  auth, db, doc, getDoc, setDoc, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut
};
