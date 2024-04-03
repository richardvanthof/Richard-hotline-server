import {v2 as cloudinary} from 'cloudinary';
import multer from 'multer';
import { userExists } from '../lib/firebase-server';
import path from 'path';
const DatauriParser = require('datauri/parser');



export interface ImgURIs {
  uris: string[],
  errors?: unknown[]
} 

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true 
});


const isValid = (data:{http_code: number}) => {
  if(data.http_code) {
    throw data
  } else {
    return true
  }
}

// Multer configuration
const storage = multer.memoryStorage();
export const upload = multer({ storage: storage });

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true 
});

const datauriParser = new DatauriParser();

// Upload assets to CDN and return links to resources
//@ts-ignore
const uploadImages = async (user:string, path?:string, files:any) => {
  const options = {
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    folder: `hotline/${user}/${path || 'message-assets'}`
  };

  try {
    const uploadedImages = [];
    if(!user || !userExists(user)) {
      throw 'user is undefined.'
    }
    for (const file of files as Express.Multer.File[]) {

      const dataUri = datauriParser.format(
        file.mimetype,
        file.buffer
      ).content;


      const result = await cloudinary.uploader.upload(dataUri, options);
      uploadedImages.push(result.secure_url);
    }

    return uploadedImages
  } catch (error) {
    throw error
  }
};

export default uploadImages