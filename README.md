# ShoppingMarket

Family-oriented supermarket price comparison and shopping-list application.

## Stack
- React + TypeScript + Vite
- Node.js + NestJS + TypeScript
- PostgreSQL 17
- Prisma ORM and migrations
- Swagger / OpenAPI
- npm workspaces

## Prerequisites
Node.js 22, npm 10+, Docker Engine and Docker Compose.

## Start locally
```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run dev
```

## URLs
- Web: http://localhost:5173
- API: http://localhost:3000/api
- Health: http://localhost:3000/api/health
- Swagger: http://localhost:3000/api/docs
- PostgreSQL: localhost:5432

## Commands
- `npm run dev`: start API and web app
- `npm run build`: build both workspaces
- `npm run db:generate`: generate Prisma Client
- `npm run db:migrate`: apply development migrations
- `npm run db:studio`: open Prisma Studio

## Layout
```text
apps/api   NestJS API, Prisma schema and migrations
apps/web   React application
packages   Reserved for shared contracts/utilities
```

The application is a modular monolith. Family-owned data is scoped through family membership. Catalog products and supermarkets are shared reference records; each family opts into the products and supermarkets it uses.

Prices are append-only observations. A null `shopping_list_item_id` represents a general historical price; a non-null value ties the observation to a shopping-list item. Prices and quantities use PostgreSQL decimal types.

The initial migration establishes the core data model. Business services must additionally validate that related products, supermarkets, shopping lists and prices belong to the same family; composite database constraints will be added alongside those workflows.

Never commit real environment files, secrets, or production credentials.
