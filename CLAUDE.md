# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Basic Express scaffold in place. A `/api/health` route (checks DB connectivity) and a `devices` CRUD slice (routes → controller → service → Prisma) exist as the reference pattern. No auth or Ohstem Cloud integration yet — add them as the project grows and keep this file in sync.

## Stack

- Runtime: Node 20 (`engines.node >=20` in package.json)
- Framework: Express 5 (`express`)
- Database: MySQL, accessed via Prisma ORM (`@prisma/client` + `prisma` CLI) — chosen over a raw driver so switching to Postgres later is a `provider` + migration change, not a rewrite
- Other deps: `cors`, `morgan` (request logging), `dotenv` (env config), `nodemon` (dev reload), `swagger-ui-express` + `swagger-jsdoc` (interactive API docs)
- Domain: school IoT project — smart home. Web server exposes an API that talks to Yolobit microcontroller boards over Ohstem Cloud (Vietnamese IoT platform commonly paired with Yolobit in education contexts).

## Commands

- Node version is pinned via `.nvmrc` (20.20.2) — run `nvm use` before anything else if your shell defaults to a different Node. Prisma 6.x's schema engine needs Node 18+ (WASM `externref` support); on Node 16 `prisma migrate`/`generate` crash with an opaque `CompileError: WebAssembly.Module()` dump.
- `npm run dev` — start server with nodemon (auto-reload)
- `npm start` — start server with plain node
- `npm test` — placeholder, no test runner configured yet
- Copy `.env.example` to `.env` and fill in `DB_*` / `DATABASE_URL` / Ohstem credentials before running
- `npx prisma migrate dev --name <description>` — create + apply a migration after editing `prisma/schema.prisma` (also regenerates the client). This is the Laravel-`artisan migrate`-equivalent workflow.
- `npx prisma migrate deploy` — apply pending migrations without prompting (CI / teammate pulling new migrations)
- `npx prisma generate` — regenerate Prisma Client only, without a migration
- `npx prisma studio` — GUI to browse/edit DB rows

## Architecture

- `src/app.js` — entry point: loads `.env`, builds Express app (middleware, route mounting), starts HTTP listener
- `src/config/prisma.js` — Prisma Client singleton, imported wherever DB access is needed
- `src/routes/`, `src/controllers/`, `src/services/` — layering is routes → controllers → services → `config/prisma.js` client; see the `devices` slice as the reference pattern for new resources
- `src/config/swagger.js` — builds the OpenAPI spec from `@openapi` JSDoc comments above route handlers (see `devices.routes.js`); served at `/api-docs` via Swagger UI. Add a new `@openapi` block whenever you add a route so it stays documented and testable in the browser.
- `prisma/schema.prisma` — hand-edited source of truth for DB structure (models, enums, relations). Edit this, then run `npx prisma migrate dev --name <description>` to generate + apply the migration.
- `prisma/migrations/` — one directory per migration (timestamp + name), each with the generated `migration.sql`. Committed to git; this is the DB change history, don't hand-edit past migrations.
- `db/schema.sql` — original raw-SQL schema dump, kept only as historical reference for the initial table design. No longer the source of truth — `prisma/schema.prisma` + `prisma/migrations` are canonical now. Note the `alert_rules.condition_operator` enum uses `@map` since MySQL operator values (`>`, `<`, `>=`, `<=`, `=`) aren't valid Prisma enum identifiers.
- `updated_at` columns are managed by Prisma (`@updatedAt`) at the application layer, not by a MySQL `ON UPDATE CURRENT_TIMESTAMP` trigger — only writes going through Prisma Client will bump them.
- Device communication is indirect — the backend does not talk to Yolobit boards directly; it goes through Ohstem Cloud. Isolate Ohstem Cloud API calls behind a dedicated service module (e.g. `src/services/ohstem.service.js`) so device-protocol details don't leak into route handlers. `OHSTEM_API_BASE_URL` / `OHSTEM_API_KEY` are reserved in `.env.example` for this.
- MySQL is the source of truth for persistent state (users, devices, device state/history); Ohstem Cloud is the transport to hardware, not a data store to rely on long-term.
