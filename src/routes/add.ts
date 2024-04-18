import { Request, Response } from 'express';
const { getFirestore, Timestamp, FieldValue, Filter } = require('firebase-admin/firestore');

import validator, { escape, isEmpty, isEmail } from 'validator';
import { inputValidationConfig } from '../lib/validatorContext';
import app, {db, userExists} from '../lib/firebase-server';
import sendMail from '../lib/send-mail';
export const config = {
  runtime: 'nodejs',
};

const key = process.env.DB_KEY;

interface Message {
  name: string,
  email: string,
  message: string,
  images: string[]
}

export default async function add_message(user:string, messageObject: Message) {
  // console.log(serviceAccount)
  const { name, email, message, images}: Message = messageObject;
  const { maxLength } = inputValidationConfig;

  try {
    if(isEmpty(message) || isEmpty(name) || isEmpty(email)) {
      throw 'Please fill in required all fields (name, email, message)'
    } else {
      if (name.length > maxLength.input || email.length > maxLength.input) {
        throw `Name and email cannot be longer than ${maxLength.input} chars.`
      }
      if ( message.length > maxLength.textArea) {
        throw `Message cannot be longer than ${maxLength.textArea} chars.`
      }
      if (!isEmail(email)) throw new Error('Please fill in a valid e-mail.');
    }

    
  } catch (error) {
    console.error({ error });
    return {
      success: false,
      code: 402,
      error: error
    }
  }

  try {
    if (!user || !userExists(user)) {
      throw new Error('Valid user not provided.');
    }
    const post = {
      name: escape(name),
      email: escape(email),
      message: escape(message),
      timestamp: Timestamp.now(),
      images: images || null,
      printed: false
    };
    console.log(post)
    const resp = await db.collection('users').doc(user).collection('messages').add(post);
    console.log(resp.id)
    return { success: true, id: resp.id };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      code: 500,
      error: error
    };
  }
}
