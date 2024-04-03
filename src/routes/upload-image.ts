import { upload } from '@testing-library/user-event/dist/upload';
import {v2 as cloudinary} from 'cloudinary';
          
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true 
});

const uploadImage = async (imagePath, user) => {

  // Use the uploaded file's name as the asset's public ID and 
  // allow overwriting the asset with new versions
  const options = {
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    folder: `hotline/${user}/`
  };

  try {
    // Upload the image
    const result = await cloudinary.uploader.upload(imagePath, options);
    // console.log(result);
    return result.url;
  } catch (error) {
    console.error(error);
    return error
  }
};

const isValid = data => {
  if(data.http_code) {
    throw data
  } else {
    return true
  }
}

export default async function handler(req, res) {
  if(req.method == "POST") {
    try {
      const {img, user} = req.body;
      // console.log(Array.isArray(img))
      // if(Array.isArray(img)) {
      //   let urls = [];
      //   for (asset in img) {
      //     const resp = await uploadImage(asset, user)
      //     isValid(await resp)
      //     console.log('debug')
      //     console.log(await resp)
      //     urls.push(await resp)
      //   }
      //   return res.status(200).json({
      //     success: true,
      //     urls: urls
      //   })
      // } else {
        const resp = await uploadImage(img, user)
        if(isValid(resp)) {
          return res.status(200).json({
            success: true,
            urls: resp
          })
        }
        
      // }
      
    } catch(err) {
      return res.status(500).json({
        success: false,
        message: err
      })
    }
    
  } else {
    return res.status(405).json({status: 'failed', message: 'Method not allowed'})
  }
}