# OBSIDIAN Storefront Backend API Service

Production-grade, highly secure RESTful backend API service engineered for the **OBSIDIAN Storefront Platform**.

---

## Features

- **Runtime & Language:** Node.js (TypeScript) & Express.js.
- **Identity & Authentication:** Supabase Authentication (JWT token verification with automatic user profile synchronization into PostgreSQL `public.users`).
- **Relational Persistence:** Supabase PostgreSQL with automated `updated_at` triggers, foreign-key cascades, and Row-Level Security (RLS).
- **Object Storage:** S3-compatible Supabase Storage bucket (`storefront-assets`) with strict 5MB size limits and MIME validation (JPEG, PNG, WebP).
- **Deployment Orchestration:** Direct integration with Vercel REST API (`/v13/deployments`), compiling in-memory storefront bundles (`index.html`, `store-config.json`) with selected design templates.
- **Template System:** Built-in template catalog (`obsidian-classic`, `obsidian-minimal`, `obsidian-luxury`, `obsidian-editorial`) with styling tokens and responsive layouts.
- **Security & Hygiene:** Zero secret leakage to clients, store ownership authorization checks (`403 Forbidden`), rate limiting (deploy endpoint capped at 5/hr), Helmet headers, and CORS control.
- **Offline / Mock Mode:** Built-in development fallback enabling immediate local boot, testing, and exploration even before third-party API keys are provisioned.

---

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js (ES2022) |
| Language | TypeScript 5.7 (Strict) |
| Web Framework | Express 4 |
| Authentication | Supabase Auth (JWT) |
| Database & Storage | Supabase (PostgreSQL + S3 Storage) |
| Deployment | Vercel REST API (`/v13/deployments`) |
| Validation | Zod |
| Security | Helmet, CORS, Express-Rate-Limit |

---

## Database Schema (PostgreSQL / Supabase)

The complete DDL is available at `database/schema.sql`.

- `users` — Primary user identity table synced with Supabase Auth (`id`, `email`, `full_name`, `avatar_url`).
- `stores` — Store identity, unique `slug`, business details, branding (`logo_url`, `banner_url`), social links, and Vercel project coordinates.
- `products` — Product catalog with price, discount price, stock, category, emoji, and store relation.
- `orders` — Customer orders tracking supporting storefront checkout.
- `deployments` — Deployment history tracking Vercel deployment IDs, status (`BUILDING`, `READY`, `ERROR`), and live URLs.

To run the schema in your Supabase project:
1. Open your Supabase Dashboard -> **SQL Editor**.
2. Paste the contents of `database/schema.sql` and click **Run**.

---

## Environment Variables

Create a `.env` file in the project root:

```env
# Server
PORT=4000
NODE_ENV=development
ALLOWED_ORIGIN=http://localhost:5173

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_never_expose_to_client
SUPABASE_STORAGE_BUCKET=storefront-assets

# Vercel Deployment Integration
VERCEL_API_TOKEN=your_vercel_bearer_token
VERCEL_TEAM_ID=
VERCEL_PROJECT_BASE_DOMAIN=obsidian.store
# Google Maps Platform Integration
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_never_expose_to_client
```

---

## API Endpoints Reference

### Authentication
- `POST /api/auth/sync` — Resolves Supabase Auth JWT token to database user profile. *(Auth required)*

### Store Management
- `GET /api/stores/me` — Lists all stores owned by authenticated user. *(Auth required)*
- `POST /api/stores` — Creates a new store with automatic collision-free slug and automatic Google Maps address geocoding. *(Auth required)*
- `GET /api/stores/:id` — Gets store details including location, coordinates, and formatted address. *(Auth required, ownership verified)*
- `PATCH /api/stores/:id` — Updates store details and branding with automatic address geocoding. *(Auth required, ownership verified)*
- `PUT /api/stores/:id` — Full update of store details with automatic address geocoding. *(Auth required, ownership verified)*
- `PATCH /api/stores/:id/location` — Direct coordinates and Google Maps location update. *(Auth required, ownership verified)*
- `DELETE /api/stores/:id` — Deletes store and cascades assets. *(Auth required, ownership verified)*
- `POST /api/stores/:id/upload` — Multipart upload for store logo, banner, or product images. *(Auth required, ownership verified)*
- `POST /api/stores/:id/select-template` — Selects design template. *(Auth required, ownership verified)*

### Maps & Geolocation
- `POST /api/maps/geocode` — Secure backend geocoding proxy converting address string to coordinates and place details without exposing the API key to clients. *(Auth required)*
- `POST /api/maps/place-details` — Fetches verified place metadata by Google Place ID. *(Auth required)*

### Product Catalog
- `GET /api/stores/:id/products` — Lists store products (supports `?search=` and `?category=`).
- `POST /api/stores/:id/products` — Adds new product. *(Auth required, ownership verified)*
- `PUT /api/stores/:id/products/:productId` — Updates product. *(Auth required, ownership verified)*
- `DELETE /api/stores/:id/products/:productId` — Deletes product. *(Auth required, ownership verified)*

### Orders
- `GET /api/stores/:id/orders` — Lists store orders for owner. *(Auth required, ownership verified)*
- `POST /api/stores/:id/orders` — Places a new customer order. *(Public)*

### Templates & Public Renderer
- `GET /api/templates` — Returns all available storefront design templates. *(Public)*
- `GET /api/public/store/:slug` — Read-only storefront data for live rendering. *(Public)*

### Vercel Deployment Orchestration
- `POST /api/stores/:id/deploy` — Compiles storefront files and triggers Vercel deployment. *(Auth required, ownership verified, rate-limited)*
- `GET /api/stores/:id/deployment-status` — Checks deployment status and URL. *(Auth required, ownership verified)*

---

## Scripts

```bash
# Install dependencies
npm install

# Run TypeScript compilation
npm run build

# Start production server
npm start

# Start local dev server with auto-reload
npm run dev

# Run automated integration tests
npm test
```
