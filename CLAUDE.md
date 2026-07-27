# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Basic Express scaffold in place. A `/api/health` route (checks DB connectivity), a `devices` CRUD slice (routes → controller → service → Prisma), and a JWT `auth` slice (sign-up, sign-in, sign-out, refresh-token — see `src/services/auth.service.js`) exist as reference patterns. Refresh tokens are stored hashed (SHA-256) in the `refresh_tokens` table and rotated on every refresh; access tokens are short-lived JWTs verified with `JWT_ACCESS_SECRET`. `src/middlewares/auth.middleware.js` exports `requireAuth`, a bearer-token guard that verifies the access token and sets `req.user`; the `devices` routes are protected with it (`router.use('/devices', requireAuth)` in `devices.routes.js` — note the path-scoped `.use`, since routers sharing the same `/api` mount prefix in `app.js` would otherwise leak an unscoped `.use` middleware into sibling routes). No Ohstem Cloud integration yet — add it as the project grows and keep this file in sync.

## Stack

- Runtime: Node 20 (`engines.node >=20` in package.json)
- Framework: Express 5 (`express`)
- Database: MySQL, accessed via Prisma ORM (`@prisma/client` + `prisma` CLI) — chosen over a raw driver so switching to Postgres later is a `provider` + migration change, not a rewrite
- Other deps: `cors`, `morgan` (request logging), `dotenv` (env config), `nodemon` (dev reload), `swagger-ui-express` + `swagger-jsdoc` (interactive API docs), `multer` (multipart file upload, memory storage), `face-api.js` + `canvas` (face detection/recognition — see Face ID section below)
- Domain: school IoT project — smart home. Web server exposes an API that talks to Yolobit microcontroller boards over Ohstem Cloud (Vietnamese IoT platform commonly paired with Yolobit in education contexts).

## Commands

- Node version is pinned via `.nvmrc` (20.20.2) — run `nvm use` before anything else if your shell defaults to a different Node. Prisma 6.x's schema engine needs Node 18+ (WASM `externref` support); on Node 16 `prisma migrate`/`generate` crash with an opaque `CompileError: WebAssembly.Module()` dump.
- `npm run dev` — start server with nodemon (auto-reload)
- `npm start` — start server with plain node
- `npm test` — runs the Jest suite (per-route-slice files under `tests/`, e.g. `auth.test.js`, `devices.test.js`, `face-profiles.test.js`, `door-access-verify-face.test.js`) via Supertest against the real Express app. These are integration tests, not mocked — they hit the actual dev MySQL DB through Prisma (make sure it's running and migrated first), creating and cleaning up their own rows (unique per-run emails/device codes, `afterAll` deletes what they created). No test DB isolation yet, so don't point `DATABASE_URL` at a DB with data you can't afford to touch. The face-related test files call `jest.setTimeout(30000)` — the first face-api.js inference call in a process takes several seconds (pure-JS CPU backend, see Face ID section).
- Copy `.env.example` to `.env` and fill in `DB_*` / `DATABASE_URL` / Ohstem credentials before running
- `npm install` triggers a `postinstall` script (`scripts/download-face-models.js`) that fetches the face-api.js model weight files into `weights/face-api/` (gitignored, ~12.5MB) if not already present — needs network access once; safe to re-run manually if it fails partway.
- `npx prisma migrate dev --name <description>` — create + apply a migration after editing `prisma/schema.prisma` (also regenerates the client). This is the Laravel-`artisan migrate`-equivalent workflow.
- `npx prisma migrate deploy` — apply pending migrations without prompting (CI / teammate pulling new migrations)
- `npx prisma generate` — regenerate Prisma Client only, without a migration
- `npx prisma studio` — GUI to browse/edit DB rows

## Architecture

- `src/app.js` — builds and exports the Express app (middleware, route mounting) but does not listen; kept separate from the HTTP listener so tests can `require` it and drive it with Supertest without binding a real port
- `src/server.js` — entry point (`npm start`/`npm run dev` point here now): loads `.env`, requires `src/app.js`, starts the HTTP listener
- `tests/` — Jest + Supertest integration tests per route slice (`auth.test.js`, `devices.test.js`); see the `npm test` note above for how they use the real DB
- `src/config/prisma.js` — Prisma Client singleton, imported wherever DB access is needed
- `src/routes/`, `src/controllers/`, `src/services/` — layering is routes → controllers → services → `config/prisma.js` client; see the `devices` slice as the reference pattern for new resources
- `src/config/swagger.js` — builds the OpenAPI spec from `@openapi` JSDoc comments above route handlers (see `devices.routes.js`); served at `/api-docs` via Swagger UI. Add a new `@openapi` block whenever you add a route so it stays documented and testable in the browser.
- `prisma/schema.prisma` — hand-edited source of truth for DB structure (models, enums, relations). Edit this, then run `npx prisma migrate dev --name <description>` to generate + apply the migration.
- `prisma/migrations/` — one directory per migration (timestamp + name), each with the generated `migration.sql`. Committed to git; this is the DB change history, don't hand-edit past migrations.
- `db/schema.sql` — original raw-SQL schema dump, kept only as historical reference for the initial table design. No longer the source of truth — `prisma/schema.prisma` + `prisma/migrations` are canonical now. Note the `alert_rules.condition_operator` enum uses `@map` since MySQL operator values (`>`, `<`, `>=`, `<=`, `=`) aren't valid Prisma enum identifiers.
- `updated_at` columns are managed by Prisma (`@updatedAt`) at the application layer, not by a MySQL `ON UPDATE CURRENT_TIMESTAMP` trigger — only writes going through Prisma Client will bump them.
- Device communication is indirect — the backend does not talk to Yolobit boards directly; it goes through Ohstem Cloud. Isolate Ohstem Cloud API calls behind a dedicated service module (e.g. `src/services/ohstem.service.js`) so device-protocol details don't leak into route handlers. `OHSTEM_API_BASE_URL` / `OHSTEM_API_KEY` are reserved in `.env.example` for this.
- MySQL is the source of truth for persistent state (users, devices, device state/history); Ohstem Cloud is the transport to hardware, not a data store to rely on long-term.

## Face ID (door unlock via face)

Implements the design in `docs/FACE-ID-PLAN-FRONTEND.md` (usage guide for the FE/API surface: `docs/FACE-ID-USAGE.md`).

- `src/services/face-recognition.service.js` wraps `face-api.js`: loads SSD MobileNet v1 (detector) + 68-point landmark net + the recognition net (128-d embeddings) from `weights/face-api/` on first use (`loadModels()`, memoized), exposes `computeFaceDescriptor(buffer)` (throws `HttpError(422, ...)` if it finds zero or 2+ faces), `euclideanDistance`, and `findBestMatch`.
- **Do not add `@tensorflow/tfjs-node`.** It was tried and reverted — `face-api.js` bundles `@tensorflow/tfjs-core@1.7.0` internally, and loading the modern `@tensorflow/tfjs-node` (4.x) alongside it registers a second, incompatible kernel/engine and crashes (`forwardFunc_1 is not a function`) on real inference calls. `face-api.js` runs on tfjs-core's pure-JS CPU backend instead — noticeably slower per call (~8-10s for `detectAllFaces` the first time a process runs it, once models are loaded) but fine for this project's scale (occasional enroll/verify calls, not a hot path). If a faster path is ever needed, look at forks that track modern tfjs (e.g. `@vladmandic/face-api`) rather than forcing `@tensorflow/tfjs-node` into this one.
- `face_profiles.face_embedding` (`LongText`) stores `JSON.stringify(Array.from(descriptor))` — a 128-number array — never returned to clients (`face-profiles.service.js`'s `present()` strips it before serialization).
- `FACE_MATCH_THRESHOLD` (env, default `0.6`) is the max Euclidean distance between two embeddings to count as a match; tune it against real enrollment photos once available.
- `src/middlewares/upload.middleware.js` (`faceImageUpload`) is a `multer` memory-storage middleware shared by both face routes — 5MB limit, jpeg/png only.
- Uploaded enrollment photos are saved to `uploads/faces/<uuid>.<ext>` (gitignored, local disk — fine for a single-instance school project; would need object storage for multi-instance deploys) and served statically at `/uploads/faces/...` (`app.js`). `face_profiles.image_url` stores the relative filename; `src/utils/face-image-storage.js`'s `faceImageUrl(req, filename)` builds the absolute URL per-request.
- `POST /api/door-access/verify-face` (`door-access.service.js`'s `verifyFace`) does the match-and-open in one request, matching the security rationale in the plan doc: it writes `door_access_logs` itself and, on a match within threshold, calls `device-command.service.js`'s `createDeviceCommand(..., 'open', 'face')` in the same request — callers must not separately call `/devices/:id/commands` after a `success` response.
- Multipart routes (`face-profiles.routes.js`, the `verify-face` route in `door-access.routes.js`) decamelize `req.body` manually with `humps.decamelizeKeys` in their controllers — the global case-conversion middleware (`case.middleware.js`) only touches `req.body` when it's already an object (i.e. JSON requests parsed by `express.json()`); it runs before `multer` populates `req.body` for multipart requests, so it never sees those fields.
- `tests/fixtures/face-single-1.jpg`, `face-single-2.jpg` (two different real people, single face each) and `face-multi.jpg` (three faces) are committed fixtures for the enrollment/verify tests — cropped/masked from face-api.js's own public example photos. No-face-detected tests generate a solid-color JPEG on the fly with `canvas` instead of a fixture.
