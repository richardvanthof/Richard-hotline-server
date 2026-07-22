# Richard Hotline Server
Backend API for the service.

### Dependencies
- Vercel CLI (if you're gonna deploy on Vercel)
- Firebase CLI
- Node
- Postman (for API debugging)

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

## troubleshooting
- If you get an error like the following, an error has occured with the Docker caching. Delete all containers and data and rebuild or use `docker compose up --build.`
```
Dockerfile:17

--------------------

  15 |     

  16 |     # Build the TypeScript code

  17 | >>> RUN npm run build

  18 |     

  19 |     # Expose the port the app runs on

--------------------

failed to solve: process "/bin/sh -c npm run build" did not complete successfully: exit code: 2
```
