# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Full stack (recommended)
```bash
docker compose up --build   # start frontend + backend + MySQL
docker compose down          # stop all services
```

### Frontend only
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc + vite build
```

### Backend only
```bash
cd backend
dotnet restore
dotnet run       # http://localhost:8080
```
Requires MySQL running locally. The connection string is read from the `CONNECTION_STRING` env var, falling back to `Server=localhost;Port=3306;Database=flexjob;Uid=root;Pwd=rootpassword;`.

## Architecture

Three Docker services: `frontend` (React + TypeScript + Vite, port 5173), `backend` (.NET 8 Minimal API, port 8080), `db` (MySQL 8.0, port 3306).

### Backend (`backend/`)

All API routes are defined inline in `Program.cs` using ASP.NET Core Minimal API — there are no controllers or separate route files. Authentication uses ASP.NET cookie middleware (`FlexJobSession` cookie).

`Database.cs` is the only data access layer. It exposes three static methods:
- `ExecuteQuery` — returns `List<Dictionary<string, object>>`
- `ExecuteNonQuery` — for INSERT/UPDATE/DELETE
- `Initialize()` — called at startup to create tables and seed mock data if the `users` table is empty

There is no ORM. All SQL is written inline in `Program.cs` and `Database.cs`. Password hashing is SHA-256 (not bcrypt — this is a demo).

**DB schema:** `users`, `jobs`, `applications`, `availabilities`, `messages`, `reviews`. See `Database.cs` `Initialize()` for full `CREATE TABLE` definitions.

**Seeded test accounts** (all with password `123456`):
- Employers: `cafeaurora@email.com`, `lxeventos@email.com`, `nortelog@email.com`
- Workers: `ines@email.com`, `miguel@email.com`, `sara@email.com`, `beatriz@email.com`

### Frontend (`frontend/src/`)

Single-page app with **no router library**. Navigation is driven by the `AppView` state (`"map" | "jobs" | "workers" | "wallet" | "profile"`) in `App.tsx`. Pages are rendered conditionally as a `Record<AppView, JSX.Element>`.

**`utils/api.ts`** is the single API client. All backend calls go through the `api` object. `BASE_URL` is an empty string because Vite proxies `/api/*` requests to the backend — see `vite.config.ts`.

**Important schema mismatch:** The frontend maps both jobs and worker availabilities to the same `Opportunity` type (`src/types.ts`). When workers are fetched from `/api/workers`, fields are remapped: `w.name → title`, `w.hourlyRate → pay`, `w.radius → hours`, etc. This means `Opportunity.hours` is actually the worker's radius (km) when in worker mode.

**i18n:** All user-facing strings go through `translations.ts`. `App.tsx` passes a `t(key: TranslationKey)` helper down to pages. Only Portuguese (`pt`) and English (`en`) are supported.

**Maps:** Leaflet + react-leaflet. `MapPage.tsx` renders job pins and worker pins on an OpenStreetMap base layer.

**Auth flow:** On mount, `App.tsx` calls `api.me()`. If the cookie is valid the user is set; otherwise the landing/login page is shown. The `api.login()` call hardcodes the password to `"123456"` — registration also auto-sets this password. This is intentional for the demo.

**Role-based views:**
- Workers see: Map, Jobs, Wallet, Profile
- Employers see: Map, Workers, Wallet, Profile

Job photos are stored as base64 strings in a `LONGTEXT` MySQL column.
