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
The database name is **shopping_market**. Copy `backend/.env.example` to `backend/.env`, then run `docker compose up -d` from the repository root. From `backend/`, run `npm install`, `npm run db:generate`, and `npm run db:migrate`. Prisma schema is the source of truth; do not create tables manually.

## Run
Backend: `cd backend && npm run dev`
Frontend: `cd frontend && npm run dev`

API health: http://localhost:5002/api/health
Frontend: http://localhost:5173
