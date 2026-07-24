# Richard Hotline Server
Backend API for the service.

### Dependencies
- Node
- Postman (for API debugging)
- Docker

### Get started
1. Install packages: `yarn`
2. Create `.env` file with all the service credentials.
```js
# GENERAL
DOMAIN=hotline.example.com

# DB
POSTGRES_USER=hotline-service-user
POSTGRES_PASSWORD=******
POSTGRES_DB=hotline-server-db
POSTGRES_HOST=db.example.com
POSTGRES_PORT=5432

# JWT
REFRESH_TOKEN_SECRET=***generate_random_long_string_here***
ACCESS_TOKEN_SECRET=***generate_random_long_String_here***
ACCESS_TOKEN_EXPIRATION=15m

# SMTP
SMTP_HOST=smtp@example.com
SMTP_PORT=587
SMTP_USER=******
SMTP_PASS=********

# EMAIL
MAIL_FROM_EMAIL='no-reply@example.com'
MAIL_FROM_NAME='Hotline Service'

# BLOB STORAGE
R2_ENDPOINT=https://24****20.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=c20****0aee
R2_SECRET_ACCESS_KEY=8795******b4480
R2_BUCKET_NAME=hotline-assets
R2_PUBLIC_DOMAIN=assets.hotline.therichard.space
# we use Cloudflare blob storage, but you can use any S3 compatible service.
# Learn more at: https://developers.cloudflare.com/r2/api/tokens/
```

4. Start dev server with one of the following options:
- Vercel emulator: `yarn vercel`
- Regular dev server: `yarn dev`
- Docker (includes Postgress DB): `docker compose up --build`
5. Start the Firestore emulator to interface with the database:
```
yarn db
```

Happy hacking!

### API-endpoints
View all API endpoints by opening the file [api-calls.postman_collection.json](api-calls.postman_collection.json) in Postman.