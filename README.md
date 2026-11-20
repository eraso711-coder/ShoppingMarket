# ShoppingMarket

Family-shared shopping lists and supermarket price comparison.

## Stack

- Frontend: React 19, TypeScript, Vite
- Backend: Node.js, Express 5, TypeScript
- Database: PostgreSQL
- ORM: Prisma 7 with the PostgreSQL driver adapter

## Project structure

- `frontend/`: React application
- `backend/`: Express API, Prisma schema, and migrations

## Database

ShoppingMarket uses your existing local PostgreSQL server.

| Setting | Value |
|---|---|
| Host | localhost |
| Port | 5432 |
| Database | shopping_market |
| Owner / User | robertsanchez |

The database is expected to exist already. The first Prisma migration will create the application tables; it will not create or drop the database itself.

Configure `backend/.env` using `backend/.env.example`. Replace the password placeholder in `DATABASE_URL` with the password for your local PostgreSQL user `robertsanchez`. URL-encode special characters in the password. Never commit `.env` files or credentials.

## Install dependencies

```bash
cd backend
npm install
npm run db:generate
```

In another terminal:

```bash
cd frontend
npm install
```

## Run locally

Start the API with `cd backend && npm run dev` and the frontend with `cd frontend && npm run dev`.

- Frontend: http://localhost:5175
- API root: http://localhost:5005
- API health (including PostgreSQL connectivity): http://localhost:5005/api/health

## Accounts and authentication

The first application flow supports account registration and sign-in. Registration creates a user and a family, and assigns the new user the `OWNER` role. Passwords are hashed with bcrypt; API sessions use signed JWT bearer tokens. Configure `JWT_SECRET` with a random value of at least 32 characters in `backend/.env` before starting the API. Never commit this secret.

Authentication endpoints:

- `POST /api/auth/register`: create an account and its first family (firstName, lastName, email, password, familyName).
- `POST /api/auth/login`: sign in with email and password.
- `GET /api/auth/me`: retrieve the signed-in user and their first family; requires an `Authorization: Bearer <token>` header.

The frontend stores the session token in browser local storage for this initial version. For a production deployment, review the session-storage approach, add rate limiting and email verification, and configure HTTPS.

## Database migrations

After installing backend dependencies and generating Prisma Client, create and apply the initial migration:

```bash
cd backend
npm run db:migrate -- --name init
```

For an environment where migrations already exist, use `npm run db:deploy`.

**Important:** Do not run a reset command against your existing database. Review the migration prompt and stop if Prisma proposes resetting the database.

## Build checks

Run `npm run typecheck` and `npm run build` in each of the `backend/` and `frontend/` directories.
