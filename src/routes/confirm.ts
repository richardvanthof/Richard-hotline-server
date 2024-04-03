<<<<<<< HEAD
const { getFirestore, Timestamp, FieldValue, Filter } = require('firebase-admin/firestore');
import {isEmpty} from 'validator';
import sendMail from '../lib/send-mail';
import app, { userExists } from '../lib/firebase-server';
export interface ConfirmResponse {
  completed: boolean,
  message?: string | object,
  modified_message?: string
}

export interface ConfirmRequest {
  user: string, 
  messageIds: string[]
}

const confirm = async(user:string, messageId:string): Promise<ConfirmResponse> => {
  try {
    if(!user || !userExists(user)) throw 'valid user not provided.'
    const db = getFirestore(app);
    const resp = await db.collection('users').doc(user).collection('messages').doc(messageId).update({
      printed: true,
      printed_timestamp: Timestamp.now()
    })
    return {
      completed: true,
      modified_message: messageId,
      message: resp
    }
  } catch (err) {
    console.log(err)
    return {
      completed: false,
      message: err || 'something went wrong'
    }
  }
}

export default confirm

=======
import app from '../src/lib/firebase';
import { getFirestore, collection, addDoc, serverTimestamp, connectFirestoreEmulator } from 'firebase/firestore';
import {isEmpty} from 'validator';
import sendMail from '../lib/send-mail';

connectFirestoreEmulator(db, '127.0.0.1', 8083);


export default async function handler(request, response) {
  try{
    if(request.method == "PUT") {
      // const resp = await sendMail()
      const resp:string = 'test';
      // console.log(resp)
      return response.status(200).json({status: resp});
    } else {
      return response.status(405).json({status: 'failed', error: 'Method not allowed'})
    }
  } catch(err) {
    return response.status(500).json({status: 'failed', error: err.message})
  }
}

>>>>>>> c01a8ee (Initial commit)
