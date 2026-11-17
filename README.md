# ShoppingMarket

Family-shared shopping lists and supermarket price comparison.

## Stack

- Frontend: React 19, TypeScript, Vite
- Backend: Node.js, Express 5, TypeScript
- Database: PostgreSQL
- ORM: Prisma 7 with PostgreSQL driver adapter

The folder layout and backend conventions follow the Inventory application.

## Structure

- `frontend/`: React application
- `backend/`: Express API and Prisma schema

## Database

ShoppingMarket uses a local PostgreSQL server.

| Setting | Value |
|---|---|
| Host | localhost |
| Port | 5432 |
| Database | shopping_market |
| Owner / User | robertsanchez |

The database has already been created. Prisma migrations will manage its tables and schema.

Configure `backend/.env` using `backend/.env.example`. Replace the placeholder in `DATABASE_URL` with the password for the local PostgreSQL user `robertsanchez`.

URL-encode special characters in the password if necessary.

Never commit `.env` files or database credentials.

## Run

Backend: `cd backend && npm run dev`

Frontend: `cd frontend && npm run dev`

API health: http://localhost:5002/api/health

Frontend: http://localhost:5173
