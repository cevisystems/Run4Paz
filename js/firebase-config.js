// js/firebase-config.js
// Configuración REAL de Firebase para RUN4PAZ

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAlZWwKM1IVez6vQpT941J7avAGjpVrT_k",  // ← CAMBIA ESTO
    authDomain: "run4paz-6783b.firebaseapp.com",    // ← CAMBIA ESTO
    projectId: "run4paz-6783b",                     // ← CAMBIA ESTO
    storageBucket: "run4paz-6783b.firebasestorage.app",     // ← CAMBIA ESTO
    messagingSenderId: "858199737287",                // ← CAMBIA ESTO
    appId: "1:858199737287:web:f185ca534ed787a002cfe2"          // ← CAMBIA ESTO
};

// Inicializar Firebase
firebase.initializeApp(FIREBASE_CONFIG);

// Obtener instancias de los servicios
const auth = firebase.auth();
const db = firebase.firestore();

// Configurar Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Configurar persistencia de sesión
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

console.log('🔥 Firebase configurado correctamente');