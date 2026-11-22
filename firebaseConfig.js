// firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDB10JCOxdWX1e-HoDFJhP1UNbYakYOoM0",
  authDomain: "ove-user-test.firebaseapp.com",
  databaseURL: "https://ove-user-test-default-rtdb.firebaseio.com",
  projectId: "ove-user-test",
  storageBucket: "ove-user-test.firebasestorage.app",
  messagingSenderId: "1026511155618",
  appId: "1:1026511155618:web:97bb2d79113001023842fb",
  measurementId: "G-L9YKQ26W78"
};

const app = initializeApp(firebaseConfig);

// Auth ko persistence ke saath initialize karein taaki user logged in rahe
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

// RTDB export karein (user data ke liye)
import { getDatabase } from 'firebase/database';
export const userDB = getDatabase(app);

// Firestore export karein (battery data ke liye aage use hoga)
import { getFirestore } from 'firebase/firestore';
export const firestoreDB = getFirestore(app);