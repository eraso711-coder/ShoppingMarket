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


## Family shopping lists

The first shopping-list workflow is available after signing in:

- Create shopping lists for your family.
- View lists and their items, filter active and completed lists, and see remaining-item counts.
- Add custom items with a quantity and optional note.
- Edit an item's name, quantity, and note; remove items when they are no longer needed.
- Mark items as purchased or move them back to the to-buy state.
- Complete a list and reopen it later.

All shopping-list endpoints require `Authorization: Bearer <token>`. The API checks the signed-in user's family membership before returning or changing a list, and checks that an item belongs to the requested list before updating or deleting it.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/shopping-lists` | List all shopping lists for the user's families, including their items |
| POST | `/api/shopping-lists` | Create a list (`name`, `familyId`, optional `dueAt`) |
| PATCH | `/api/shopping-lists/:listId` | Rename a list, set its due date, or change status |
| POST | `/api/shopping-lists/:listId/items` | Add an item (`name` or `productId`, optional `quantity` and `notes`) |
| PATCH | `/api/shopping-lists/:listId/items/:itemId` | Edit item name, quantity, notes, or status |
| DELETE | `/api/shopping-lists/:listId/items/:itemId` | Remove an item |

List statuses are `ACTIVE`, `COMPLETED`, and `ARCHIVED`. Item statuses are `TO_BUY`, `IN_CART`, `PURCHASED`, and `UNAVAILABLE`. Quantities must be positive and support up to three decimal places.

The shopping-list models and relations were already part of the initial Prisma schema, so this feature does not require a new database migration.


## Product catalogue and supermarket prices

The authenticated catalogue workspace lets household members:

- Search products by name, brand, or barcode.
- Create shared catalogue products with an optional brand, category, and unit.
- Browse product categories and create categories through the API.
- Maintain a supermarket directory, including optional chain and website details.
- Record manual price observations in EUR (or another three-letter currency code).
- Compare the latest recorded price for each supermarket.
- Add a catalogue product directly to the currently selected shopping list.

Catalogue API endpoints (all require a bearer token):

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/catalog/categories` | List categories |
| POST | `/api/catalog/categories` | Create a category (`name`, optional `parentId`) |
| GET | `/api/catalog/supermarkets` | List supermarkets |
| POST | `/api/catalog/supermarkets` | Add a supermarket (`name`, optional `chain`, `website`) |
| GET | `/api/catalog/products?q=milk` | Search products |
| POST | `/api/catalog/products` | Create a product |
| GET | `/api/catalog/products/:productId/prices` | Get the latest observation per supermarket |
| POST | `/api/catalog/products/:productId/prices` | Record a price observation (`supermarketId`, `price`, optional `currency`, `source`) |

Prices are observations, not overwritten values: each submission is timestamped so the application can build price history over time. Recording a price also creates or reactivates the product's supermarket offer.

This milestone reuses the existing `Category`, `Product`, `Supermarket`, `SupermarketProduct`, and `PriceObservation` tables. No schema migration is required. Price collection is manual at this stage; automated retailer integrations will need to be designed separately for each retailer and its data-access terms.
