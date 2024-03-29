import { Request, Response } from 'express';
import { getFirestore, Timestamp, FieldValue, Filter } from 'firebase-admin/firestore';

import validator, { escape, isEmpty, isEmail } from 'validator';
import { inputValidationConfig } from '../src/lib/validatorContext';
import app from '../lib/firebase-server';
import sendMail from '../lib/send-mail';

import { MessageData } from '@/lib/types';

export const config = {
  runtime: 'nodejs',
};

const key = process.env.DB_KEY;

export default async function handler(request: Request, response: Response) {

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', '*');
  response.setHeader('Access-Control-Max-Age', '2592000'); // 30 days

  const db = getFirestore(app);

  const { name, email, message, images }: MessageData = request.body;
  const { maxLength } = inputValidationConfig;
  
  if (request.method !== 'POST') {
    return response.status(405).json({ status: 'failed', error: 'Method not allowed' });
  }

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
    if (images.length > maxLength.images) throw new Error(`You can't send more than ${maxLength.images} images.`);
  } catch (error) {
    console.error({ error });
    return response.status(400).json({
      status: 'failed',
      message: error.message
    });
  }

  try {
    if (!key) {
      throw new Error('Database authentication key not provided.');
    }
    const post = {
      name: escape(name),
      email: escape(email),
      message: escape(message),
      images: images,
      timestamp: Timestamp,
      printed: false,
      auth: key
    };
    const resp: FirebaseResponse = await addDoc(collection(db, "messages"), post);
    
    return response.status(200).json({ success: true, message: resp._key });
  } catch (error) {
    console.error(error);
    return response.status(500).json({
      status: 'failed',
      message: error.message
    });
  }
}
