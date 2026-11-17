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
The PostgreSQL database is **shopping_market**, owned by the dedicated application user **robertsanchez**.

1. Copy the root `.env.example` to `.env` and set a strong `DB_PASSWORD`. This file is read by Docker Compose and must not be committed.
2. Copy `backend/.env.example` to `backend/.env` and replace `REPLACE_WITH_DB_PASSWORD` in `DATABASE_URL` with the same password. URL-encode any special characters in the password.
3. Run `docker compose up -d` from the repository root.
4. From `backend/`, run `npm install`, `npm run db:generate`, and `npm run db:migrate`.

The Compose configuration initializes PostgreSQL with the `robertsanchez` user and `shopping_market` database. Prisma schema is the source of truth; do not create tables manually. The Docker volume persists database data between container restarts.

## Run
Backend: `cd backend && npm run dev`
Frontend: `cd frontend && npm run dev`

API health: http://localhost:5002/api/health
Frontend: http://localhost:5173
