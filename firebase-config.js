import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCvvTWUAUOoPerMZztTmxxDuJ_cYb65rI",
  authDomain: "azoopitionmaster.firebaseapp.com",
  projectId: "azoopitionmaster",
  storageBucket: "azoopitionmaster.firebasestorage.app",
  messagingSenderId: "633176803089",
  appId: "1:633176803089:web:d7316130039ed77f9feeb0",
  measurementId: "G-0FQX4BBQVP"
};

export const app = initializeApp(firebaseConfig, "admin-console");
export const auth = getAuth(app);
