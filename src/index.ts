// Packages
import express, { Express, Request, Response, Application } from 'express';
import dotenv from 'dotenv';
const DatauriParser = require('datauri/parser');
import jwt, { Secret } from 'jsonwebtoken';
import query from './db/db_connect'; // Database connection

// Middleware
import { rateLimit } from 'express-rate-limit' // Rate limiting
import morgan from 'morgan'; // image upload library + manages accessing data from Express.
import cors from 'cors';

// Database
import initDB from './db/init';

// Authentication
import { createUser, login, generateToken, generateResetToken } from './authentication/authenticate';
import { authenticateToken } from './authorization/authorization';

import { inputValidationConfig } from './lib/validatorContext';



//For env File 
dotenv.config();

// Initialize database
initDB();

// Express server
export const app: Application = express();
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
// app.get('/ip', (request, response) => response.send(request.ip))

// Add middleware for getting request body
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cors())
app.use(morgan('dev'));

// Add middleware for rate limiting
app.use(limiter)

// ACCOUNT MANAGEMENT
app.post('/users', async (req: Request, res: Response):Promise<void> => {
  try {
    const resp = await createUser(req.body);
    res.status(201).send(resp);
  } catch(err) {
    res.status(500).send(err)
  }
});

app.get('/users', authenticateToken, async (req: Request, res: Response):Promise<void> => {
  res.send('success')
})

const getRefreshTokens = async (userId: string|number):Promise<string[]> => {
  try {
    console.log(userId);
    const tokens = await query('SELECT refresh_tokens FROM users WHERE id = $1', [userId]);
    return tokens.rows[0].refresh_tokens || [];
  } catch (err) {
    console.error('Error getting refresh tokens:', err);
    throw err;
  }
};

// Authenticate
app.post('/login', async (req: Request, res: Response):Promise<void> => {
  try {
    const {username, password} = req.body;
    const authenticated = await login(username, password);
    if(authenticated.success) {
      if(!process.env.ACCESS_TOKEN_SECRET) {res.status(500).send('Access token secret not found')};
      if(!process.env.REFRESH_TOKEN_SECRET) {res.status(500).send('Refresh token secret not found')};
      const {id, username} = authenticated.user;
      if(id) {
        const userData = {id, username};
        const refreshToken = await generateToken(userData, process.env.REFRESH_TOKEN_SECRET || '');
        let refreshTokens = await getRefreshTokens(id);
        refreshTokens.push(refreshToken);
        await query('UPDATE users SET refresh_tokens = $1 WHERE id = $2', [refreshTokens, id]);
        const accessToken = await generateToken(userData, process.env.ACCESS_TOKEN_SECRET || '', process.env.ACCESS_TOKEN_EXPIRATION);
        res.status(200).send({
          success: true,
          accessToken,
          accessTokenExpiration: process.env.ACCESS_TOKEN_EXPIRATION,
          refreshToken
        });
      } else {
        throw new Error('USER_ID_UNDEFINED');
      }
    }
    
  } catch(err) {
    if (err instanceof Error) {
      if(err.message === 'USER_NOT_FOUND' || err.message === 'INVALID_PASSWORD') {
        res.status(401).send('NOT_AUTHORIZED');
      } else {
        res.status(500).send(err.message);
      }
    }
  }
});

app.post('/refresh', async (req: Request, res: Response):Promise<void> => {
  try {
    const authHeaders = req.headers['authorization'] as string;
    const refreshToken:string = authHeaders && authHeaders.split(' ')[1];
    if(!refreshToken) {
      res.status(401).send('REFRESH_TOKEN_NOT_FOUND');
    } else if(!process.env.REFRESH_TOKEN_SECRET) {
      res.status(500).send('Refresh token secret not found');
    } else {
      const user = await jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
      const accessToken = await generateToken(user, process.env.ACCESS_TOKEN_SECRET || '', process.env.ACCESS_TOKEN_EXPIRATION);
      res.status(200).send({
        success: true,
        accessToken,
        accessTokenExpiration: process.env.ACCESS_TOKEN_EXPIRATION,
      });
    }
  } catch(err) {
    if (err instanceof Error) {
      if(err.message === 'jwt expired' || err.message === 'invalid token') {
        res.status(403).send('NOT_AUTHORIZED');
      } else {
        res.status(500).send(err.message);
      }
    }
  }
}); 

app.delete('/logout', authenticateToken, async (req: Request, res: Response):Promise<void> => {
  try {
    const {id} = req.user.userData;
    const {refreshToken} = req.body;
    if(id && refreshToken) {
      let refreshTokens = await getRefreshTokens(id);
      if(refreshTokens.some((token:string) => token === refreshToken)) {
        refreshTokens = refreshTokens.filter((token:string) => token !== refreshToken);
        await query('UPDATE users SET refresh_tokens = $1 WHERE id = $2', [refreshTokens, id]);
        res.status(403).send('LOGGED_OUT');
      } else {
        res.status(403).send('NOT_AUTHORIZED');
      }
    } 
  } catch(err) {
    if (err instanceof Error) {
      if(err.message === 'jwt expired' || err.message === 'invalid token') {
        res.status(403).send('SESSION_EXPIRED');
      } else {
        res.status(500).send(err.message);
      }
    }
    res.status(500).send(err)
  }
});

app.delete('/logout-all', authenticateToken, async (req: Request, res: Response):Promise<void> => {
  try {
    const {id} = req.user.userData;
    if(id) {
      await query('UPDATE users SET refresh_tokens = $1 WHERE id = $2', [[], id]);
      res.status(403).send('LOGGED_OUT_ALL');
    } 
  } catch(err) {
    if (err instanceof Error) {
      res.status(500).send(err.message);
    }
    res.status(500).send(err)
  }
});

app.post('/forgot-password', async (req: Request, res: Response):Promise<void> => {
  try {
    const {email} = req.body;
    if(!email) { res.status(300).send('EMAIL_UNDEFINED')}; 
    const resetToken = await generateResetToken(email);
    console.log({resetToken})
    res.status(200).send("RESET_TOKEN_GENERATED");
  } catch(err) {
    if (err instanceof Error) {
      if(err.message === 'USER_NOT_FOUND') {
        res.status(404).send(err.message);
      } else {
        res.status(500).send(err.message);
      }
      res.status(500).send(err.message);
    }
    res.status(500).send(err)
  }
});



// // ROUTES:

// // Root 
// app.get('/', (req: Request, res: Response):void => {
//   res.send('You reached the Richard Hotline API');
// });

// // Add message to database
// app.post('/users/:userId/add', async (req: Request, res: Response, next):Promise<void> => {
//   try {
//     const {userId} = req.params;
//     const resp = await add(userId, req.body);
    
//     if(!resp.success){
//       throw resp
//     }
//     res.send(resp);
//   } catch(err) {
//     // Send a 500 Internal Server Error response
//     res.status(500).send(err);
//   }
// });

// // Confirm receipt
// app.put('/users/:userId/confirm', async (req: Request, res: Response):Promise<void> => {
//   const {messageIds}:ConfirmRequest = req.body;
//   const {userId} = req.params;

//   const success: string[] = [] // List of messages where the status has been changed successfully
//   try {
//     const confirmations = await Promise.all(messageIds.map(async (message)=> {
//       try {
//         const resp:ConfirmResponse = await confirm(userId, message);
//         if (await resp.completed) {
//           return message
//         } else {
//           throw resp;
//         }
//       } catch (err) {
//         throw err
//       }
//     }));
    
//     res.send({
//       completed: true,
//       modified_messages: confirmations
//     });
//   } catch(err) {
//     res.status(500).send(err)
//   }
// });

// interface ErrObj {
//   code: number,
//   mssg: string
// }

// // Get user data
// // This includes the status of the printer
// app.get('/users/:userId', async (req: Request, res: Response):Promise<void> => {
//   try {
//     const {filter}:{filter?: string[]} = req.body;
//     const {userId} = req.params;
//     const resp = await getUserInfo(userId, filter);
//     res.send(resp)
//   } catch(err:ErrObj|any) {
//     res.status(err.code || 500).send(err.mssg || err)
//   }
// });

// // Update user data
// // This includes the status of the printer
// app.put('/users/:userId', async (req: Request, res: Response):Promise<void> => {
//   try {
//     const {data}:{user:string, data: UserInfoUpdate} = req.body;
//     const {userId} = req.params;
//     const resp = await setUserInfo(userId, data);
//     res.send(resp)
//   } catch(err) {
//     res.status(500).send(err)
//   }
// });

// // Upload assets to CDN and return links to resources
// app.post('/users/:userId/upload-images', upload.array('images', maxLength.images), async (req, res) => {
  
//   try {
//     const { path } = req.body
//     const { userId } = req.params
//     console.log(req.body)
//     const uploadedImages = await uploadImages(userId, path, req.files)

//     res.json({ images: uploadedImages });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: error });
//   }
// });



app.get('/', (req: Request, res: Response):void => {
  res.send('You reached the Makker Hotline API');
});

app.get('/x-forwarded-for', (request, response) => {
  response.send(request.headers['x-forwarded-for'])
})

app.listen(port, () => {
  console.log(`Server is Fire at http://localhost:${port}`);
});
