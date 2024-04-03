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
  images: string[],
  user: string
}

export default async function add_message(messageObject: Message) {
  // console.log(serviceAccount)
  const { name, email, message, images, user }: Message = messageObject;
  const { maxLength } = inputValidationConfig;

  try {
    [name, email, message].forEach((value: string) => {
      if (isEmpty(value)) {
        throw new Error(`${value} is empty`);
      }
      if (
        (Object.keys(value).includes('email') && value.length > maxLength.input) ||
        (Object.keys(value).includes('name') && value.length > maxLength.input)
      ) {
        throw new Error(`${Object.keys(value)} cannot be greater than ${maxLength.input} characters.`);
      }
    });

    if (!isEmail(email)) throw new Error('Please fill in a valid e-mail.');
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
