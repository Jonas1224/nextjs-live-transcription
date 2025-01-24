import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCau12WkcRI-rQuEVBRYA2Vq95Hz_jtjEU",
  authDomain: "lectureai-ee74b.firebaseapp.com",
  projectId: "lectureai-ee74b",
  storageBucket: "lectureai-ee74b.firebasestorage.app",
  messagingSenderId: "512610962209",
  appId: "1:512610962209:web:a79bbbd1dd80f8039a8c60",
  measurementId: "G-NY8YEKREFN"
};

// Initialize Firebase only if it hasn't been initialized
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app); 