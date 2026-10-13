const { applicationDefault, cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

let firebaseApp = getApps()[0] || null;

if (!firebaseApp) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    firebaseApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
    console.log('Firebase Admin SDK initialized');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    firebaseApp = initializeApp({ credential: applicationDefault(), projectId });
    console.log('Firebase Admin SDK initialized (ADC)');
  } else {
    console.warn('Firebase Admin SDK not configured - Firebase login will be unavailable');
  }
}

module.exports = {
  isConfigured: Boolean(firebaseApp),
  verifyIdToken(idToken) {
    if (!firebaseApp) throw new Error('Firebase Admin SDK chưa được cấu hình');
    return getAuth(firebaseApp).verifyIdToken(idToken);
  },
};
