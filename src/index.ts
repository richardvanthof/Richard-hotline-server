// Packages
import express, { Express, Request, Response, Application } from 'express';
import dotenv from 'dotenv';
import {v2 as cloudinary} from 'cloudinary';
const DatauriParser = require('datauri/parser');
import * as openpgp from 'openpgp';

// Middleware
import { rateLimit } from 'express-rate-limit' // Rate limiting
import morgan from 'morgan'; // image upload library + manages accessing data from Express.
import multer from 'multer'; // logging network requests.
import cors from 'cors';

// Route logic
import add from './routes/add';
import confirm, {ConfirmRequest, ConfirmResponse} from './routes/confirm'
import { getUserInfo, setUserInfo, UserInfoUpdate, StatusResponse } from './routes/userInfo';
import uploadImages, { upload } from './routes/upload-images';

import { inputValidationConfig } from './lib/validatorContext';

//For env File 
dotenv.config();

// Express server
const app: Application = express();
const port = process.env.PORT || 9000;

// Rate limiting config
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 50, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
	// store: ... , // Redis, Memcached, etc. See below.
})

app.set('trust proxy', 1)
app.get('/ip', (request, response) => response.send(request.ip))

// Add middleware for getting request body
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cors())
app.use(morgan('dev'));

// Add middleware for rate limiting
app.use(limiter)

const { maxLength } = inputValidationConfig


// ROUTES:

// Root 
app.get('/', (req: Request, res: Response):void => {
  res.send('You reached the Richard Hotline API');
});

// Add message to database
app.post('/users/:userId/add', async (req: Request, res: Response, next):Promise<void> => {
  try {
    const {userId} = req.params;
    const resp = await add(userId, req.body);
    
    if(!resp.success){
      throw resp
    }
    res.send(resp);
  } catch(err) {
    // Send a 500 Internal Server Error response
    res.status(500).send(err);
  }
});

// Confirm receipt
app.put('/users/:userId/confirm', async (req: Request, res: Response):Promise<void> => {
  const {messageIds}:ConfirmRequest = req.body;
  const {userId} = req.params;

  const success: string[] = [] // List of messages where the status has been changed successfully
  try {
    const confirmations = await Promise.all(messageIds.map(async (message)=> {
      try {
        const resp:ConfirmResponse = await confirm(userId, message);
        if (await resp.completed) {
          return message
        } else {
          throw resp;
        }
      } catch (err) {
        throw err
      }
    }));
    
    res.send({
      completed: true,
      modified_messages: confirmations
    });
  } catch(err) {
    res.status(500).send(err)
  }
});

// Get user data
// This includes the status of the printer
app.get('/users/:userId', async (req: Request, res: Response):Promise<void> => {
  try {
    const {filter}:{filter?: string[]} = req.body;
    const {userId} = req.params;
    const resp = await getUserInfo(userId, filter);
    res.send(resp)
  } catch(err) {
    res.status(500).send(err)
  }
});

// Update user data
// This includes the status of the printer
app.put('/users/:userId', async (req: Request, res: Response):Promise<void> => {
  try {
    const {data}:{user:string, data: UserInfoUpdate} = req.body;
    const {userId} = req.params;
    const resp = await setUserInfo(userId, data);
    res.send(resp)
  } catch(err) {
    res.status(500).send(err)
  }
});

// Upload assets to CDN and return links to resources
app.post('/users/:userId/upload-images', upload.array('images', maxLength.images), async (req, res) => {
  
  try {
    const { path } = req.body
    const { userId } = req.params
    console.log(req.body)
    const uploadedImages = await uploadImages(userId, path, req.files)

    res.json({ images: uploadedImages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error });
  }
});

app.get('/x-forwarded-for', (request, response) => {
  response.send(request.headers['x-forwarded-for'])
})

app.listen(port, () => {
  console.log(`Server is Fire at http://localhost:${port}`);
});
