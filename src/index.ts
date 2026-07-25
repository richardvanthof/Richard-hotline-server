// Packages
import express, { Express, Request, Response, Application } from 'express';
import dotenv from 'dotenv';
import path from 'path';

// Middleware
import { rateLimit } from 'express-rate-limit' // Rate limiting
import morgan from 'morgan'; // image upload library + manages accessing data from Express.
import cors from 'cors';

// Database
import initDB from './db/init';


import manageUserRoutes from './routes/manageUsers';
import managePosts from './routes/managePosts';
import manageEndpoints from './routes/manageEndpoints';
import uploadAssets from './routes/uploadAssets';

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
	message: { error: 'RATE_LIMITED', message: 'Too many uploads, please try again later.' },
})

app.set('trust proxy', 1)
// app.get('/ip', (request, response) => response.send(request.ip))

// Add middleware for getting request body
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(morgan('dev'));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Add middleware for rate limiting
app.use(limiter)

app.use(manageUserRoutes);
app.use(managePosts);
app.use(manageEndpoints);
app.use(uploadAssets);
app.get('/', (req: Request, res: Response):void => {
  res.send('You reached the Makker Hotline API');
});

app.get('/x-forwarded-for', (request, response) => {
  response.send(request.headers['x-forwarded-for'])
})

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
