const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const COLLECTION_NAME = 'influencers';

/**
 * Initializes the Firebase Admin SDK using the service account credentials.
 * Fails fast with clear actionable error messages if credentials are missing or invalid.
 */
function initFirebase() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // 1. Support Vercel / Cloud Environment Variables
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      let rawKey = String(process.env.FIREBASE_PRIVATE_KEY).trim();
      // Remove wrapping double or single quotes if added by environment variable UI
      if ((rawKey.startsWith('"') && rawKey.endsWith('"')) || (rawKey.startsWith("'") && rawKey.endsWith("'"))) {
        rawKey = rawKey.slice(1, -1);
      }
      const privateKey = rawKey.replace(/\\n/g, '\n');
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: String(process.env.FIREBASE_PROJECT_ID).trim(),
          clientEmail: String(process.env.FIREBASE_CLIENT_EMAIL).trim(),
          privateKey: privateKey
        })
      });
      console.log(`[Firebase] Successfully connected via Environment Variables (Project: "${process.env.FIREBASE_PROJECT_ID}")`);
      return admin.app();
    } catch (err) {
      console.error('[FIREBASE CONFIG ERROR] Environment Variable initialization failed:', err.message);
    }
  }

  // 2. Local serviceAccountKey.json fallback
  const credentialPathEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';
  
  const resolvedPath = path.isAbsolute(credentialPathEnv)
    ? credentialPathEnv
    : path.resolve(__dirname, '../../', credentialPathEnv);

  if (!fs.existsSync(resolvedPath)) {
    const errorMessage = [
      '================================================================================',
      '[FIREBASE CONFIG ERROR] Missing Firebase Credentials!',
      '--------------------------------------------------------------------------------',
      `Target credential path: "${resolvedPath}"`,
      '',
      'Action required:',
      '1. Local: Place "serviceAccountKey.json" inside backend/',
      '2. Vercel: Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars',
      '================================================================================'
    ].join('\n');

    console.error(errorMessage);
    throw new Error(`Firebase serviceAccountKey.json not found at: ${resolvedPath}`);
  }

  let serviceAccount;
  try {
    const rawData = fs.readFileSync(resolvedPath, 'utf8');
    serviceAccount = JSON.parse(rawData);
  } catch (err) {
    console.error(`[FIREBASE CONFIG ERROR] Failed to parse JSON in credential file at: ${resolvedPath}`);
    throw new Error(`Invalid JSON in Firebase service account file: ${err.message}`);
  }

  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    console.error('[FIREBASE CONFIG ERROR] Service account key file is missing required fields (project_id, client_email, private_key).');
    throw new Error('Incomplete Firebase service account credentials.');
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log(`[Firebase] Successfully connected to Cloud Firestore (Project: "${serviceAccount.project_id}")`);
  } catch (err) {
    console.error('[FIREBASE CONFIG ERROR] Error initializing Firebase Admin SDK:', err.message);
    throw err;
  }

  return admin.app();
}

// Initialize on module load
initFirebase();

const db = admin.firestore();

// Configure Firestore settings to handle undefined properties cleanly
db.settings({
  ignoreUndefinedProperties: true
});

const influencersCollection = db.collection(COLLECTION_NAME);

/**
 * Helper to serialize Firestore document snapshots including Timestamps into standard ISO date strings
 * @param {Object} data 
 * @returns {Object}
 */
function formatFirestoreDoc(data) {
  if (!data) return null;
  const formatted = { ...data };

  if (formatted.createdAt && typeof formatted.createdAt.toDate === 'function') {
    formatted.createdAt = formatted.createdAt.toDate().toISOString();
  } else if (formatted.createdAt instanceof Date) {
    formatted.createdAt = formatted.createdAt.toISOString();
  }

  if (formatted.updatedAt && typeof formatted.updatedAt.toDate === 'function') {
    formatted.updatedAt = formatted.updatedAt.toDate().toISOString();
  } else if (formatted.updatedAt instanceof Date) {
    formatted.updatedAt = formatted.updatedAt.toISOString();
  }

  return formatted;
}

module.exports = {
  admin,
  db,
  COLLECTION_NAME,
  influencersCollection,
  formatFirestoreDoc
};
