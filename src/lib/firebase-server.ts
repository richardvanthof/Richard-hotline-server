<<<<<<< HEAD
import { initializeApp, cert } from 'firebase-admin/app';
const { getFirestore, Timestamp, FieldValue, Filter } = require('firebase-admin/firestore');
import * as openpgp from 'openpgp';
import dotenv from 'dotenv';

//For env File 
dotenv.config();

const serviceAccountKey = JSON.parse(
  process.env.FIREBASE_ACCOUNT_KEY as string
);

const app = initializeApp({
    credential: cert(serviceAccountKey)
});

export const db = getFirestore(app);

export const userExists = async (user:string) => {
  const userRef = db.collection('users').doc(user);
  const doc = await userRef.get();
  return doc.exists
}
=======
const { initializeApp, cert } = require('firebase-admin/app');

var serviceAccount = {
  type:  process.env.FIREBASE_ADMIN_TYPE,
  project_id:  process.env.FIREBASE_ADMIN_PROJECT_ID,
  private_key_id:  process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
  private_key:  process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  client_email:  process.env.FIREBASE_ADMIN_EMAIL,
  client_id: process.env.FIREBASE_ADMIN_ID,
  auth_uri: process.env.FIREBASE_ADMIN_AUTH_URI,
  token_uri: process.env.FIREBASE_ADMIN_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_ADMIN_AUTH_PROVIDER,
  client_x509_cert_url: process.env.FIREBASE_ADMIN_CERT,
  universe_domain: process.env.FIREBASE_ADMIN_DOMAIN
}

const app = initializeApp({
  credential: cert(serviceAccount)
});

console.log(app);
>>>>>>> c01a8ee (Initial commit)

export default app

