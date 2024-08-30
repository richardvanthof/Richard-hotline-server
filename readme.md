# Richard Hotline Server
Backend API for the service.

### Dependencies
- Vercel CLI (if you're gonna deploy on Vercel)
- Firebase CLI
- Node
- Postman (for API debugging)

### Get started
1. Install packages: `yarn`
2. Install firebase CLI: `yarn global add firebase-tools`.
3. Create `.env` file with all the service credentials.
```js
# Transactional mails
SENDPULSE_ID=
SENDPULSE_SECRET=

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Firebase admin server SDK
FIREBASE_ACCOUNT_KEY= // Paste contents serviceAccountKey.json file here as one line.
```

4. Start dev server with one of the following options:
- Vercel emulator: `yarn vercel`
- Regular dev server: `yarn dev`
5. Start the Firestore emulator to interface with the database:
```
yarn db
```

Happy hacking!

### API-endpoints
View all API endpoints by opening the file [api-calls.postman_collection.json](api-calls.postman_collection.json) in Postman.
