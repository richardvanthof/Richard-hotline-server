const { getFirestore, Timestamp, FieldValue, Filter } = require('firebase-admin/firestore');
import validator, { escape, isEmpty, isEmail } from 'validator';
import app from '../lib/firebase-server';
const db = getFirestore(app);

export interface StatusResponse {
  completed: boolean,
  user: string,
  updated: Date
}

export interface UserInfoUpdate {
  email?: string,
  name?: string,
  last_connection?: Date,
  printer_status?: string
}

export const getUserInfo = async (user: string, filter?: string[]):Promise<UserInfoUpdate> => {
  try {
    const userRef = db.collection('users').doc(user);
    const doc = await userRef.get();
    if (!doc.exists) {
      throw 'This user or data for this user was not found.';
    } else {
      console.log('Document data:', doc.data());
      return doc.data()
    }
    
  } catch(err) {
    console.error(err)
    throw err
  }
}

export const setUserInfo = async (user: string, data: UserInfoUpdate):Promise<StatusResponse> => {
  try {
    const userRef = db.collection('users').doc(user);
    const doc = await userRef.get();
    if(doc.exists) {
      // Data sanitation
      let newData:UserInfoUpdate = {
        last_connection: Timestamp.now()
      }
      if(data.name && newData.name) newData.name = escape(data.name)
      if(data.email && isEmail(data.email)) newData.email = escape(data.email)
      if(data.printer_status) newData.printer_status = escape(data.printer_status)

      // Add new data to database
      const resp = await userRef.update(newData)
      return {
        completed: true,
        user: user,
        updated: Timestamp.now()
      }
    } else {
      throw 'User does not exist'
    }
    
    
  } catch(err) {
    console.error(err)
    throw err
  }
}



export default getUserInfo
