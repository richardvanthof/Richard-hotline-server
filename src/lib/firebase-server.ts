import { initializeApp, cert } from 'firebase-admin/app';
const { getFirestore, Timestamp, FieldValue, Filter } = require('firebase-admin/firestore');
import * as openpgp from 'openpgp';
import dotenv from 'dotenv';

//For env File 
dotenv.config();



const serviceAccountKey = () => {
  if(process.env.FIREBASE_ACCOUNT_KEY ){
    return JSON.parse(
      process.env.FIREBASE_ACCOUNT_KEY as string
    );
  } else {
    throw 'Firebase service account key not defined!'
  }
  
}

const app = initializeApp({
    credential: cert(serviceAccountKey())
});

export const db = getFirestore(app);

export const userExists = async (user:string) => {
  const userRef = db.collection('users').doc(user);
  const doc = await userRef.get();
  return doc.exists
}

export default app

