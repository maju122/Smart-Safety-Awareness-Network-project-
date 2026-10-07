import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDNjxHLWrXe4k1yQKV4dqQ_P3uEbNlFnig",
  authDomain: "ssan-57670.firebaseapp.com", 
  projectId: "ssan-57670",
  storageBucket: "ssan-57670.firebasestorage.app",
  messagingSenderId: "20306625121", 
  appId: "1:20306625121:web:48c3e732455220f2846020", 
  measurementId: "G-0YF7EJK9YP" 
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);

export {
  auth,
  db,
  storage,
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  setDoc,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
};