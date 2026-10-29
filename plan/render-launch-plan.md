# Launch Oread on Render: Prisma Postgres, accounts, multi-tenant

## Context
Oread currently runs as one local Node process. All its state lives in JSON files under `backend/data`: `stories`, `chats`, `memoryIndex`, `settings` and the legacy `personality`. Every write rewrites a whole document behind an in-process lock, and nothing is scoped to a user. To launch for many people, it needs:
- a real database
- accounts
- per-user isolation
- encrypted per-user provider keys
- hosting

**Decided with the user:**
- **Hosting:** Render, chosen over Vercel. An always-on Node server suits Oread: the local models load once, turns stream as long as they need, and there's no function size limit.
- **Database:** Prisma (ORM plus Prisma Postgres).
- **Provider keys:** each user brings their own.
- **Sign-in:** email and password, with email sent through Resend, which the user already has.
- **Existing data:** the user's current local data is imported into their account.

**What the code survey found:**
- **Storage:** only five modules touch the store: `storyRepository`, `chatRepository`, `memory/memoryIndex`, `settingsService` and `storyMigrationRunner`. `routes/data.js` also reaches into `services.store` directly. Every other service goes through those repositories, so the database can sit behind the same repository interfaces and the services stay as they are.
- **Request handler:** `createApp()` in `backend/src/app.js` already returns a plain `(request, response)` handler, and `server.js` already runs it as a long-lived server, which is exactly what Render runs.
- **Single-user assumptions:**
  - the fixed `DEFAULT_STORY_ID = "my-story"`
  - one settings document
  - environment-variable provider keys shared by everyone
  - a global `memoryIndex`
  - per-process state: the migration memo and `streamingChatIds`
- **Models:** the local models (about 145 MB) need about 1–2 GB of RAM and a place to cache. Render's normal disk is fine, since the models can be downloaded during the build.

## Step 0: finish the restyle first
The restyle stopped when plan mode began. Still to do (listed in `~/.claude/plans/scalable-sauteeing-breeze-agent-a07f40bfa39224f54.md`):
- the Chat page frame, sidebar, scene row and right panel
- the Settings sections and narration block
- screenshots in light, dark and Sage

Then stop its scratch servers on 4319 and 5174. Do this before the database work so the two don't collide.

## Data model (Prisma schema, `backend/prisma/schema.prisma`)
Every user-owned table has a `userId` and a composite primary key `(userId, id)`. Ids only need to be unique within a user, so `"my-story"` keeps working per user, and a query can't reach another user's row without that user's id.

- **Auth tables (Better Auth):** `User`, `Session`, `Account` (holds the password hash), `Verification`.
- **`UserSettings`:** `userId` PK. `data` JSONB holds the non-secret settings that live in today's `settings` document: provider choice, models, base URLs, generation, memory, engine, user name.
- **`ProviderSecret`:** `(userId, provider, field)`, holding `ciphertext`, `iv` and `authTag`. Encrypted with AES-256-GCM using the `OREAD_SECRET_KEY` env var, and decrypted only inside `settingsService.providerConfig()`.
- **`Story`:** `(userId, id)`, `title`, `updated`, plus `data` JSONB. The data is the full story aggregate: overview, rules, opening scene, characters with their memory entries, world notes and world state, exactly as today. A story is about 15 KB, so it is read and written as one row, which keeps `updateStory(id, change)` intact.
- **`Chat`:** `(userId, id)`, `storyId`, `title`, `updated`, `streamingSince` (nullable), plus `data` JSONB holding the chat aggregate (messages, scene, engines, profiles, turnLog).
- **`MemoryEmbedding`:** `(userId, entryId)`, `textHash`, `vector Float[]` (384 numbers). It replaces the 900 KB `memoryIndex` document. Search keeps the existing in-process cosine in `memory/vectorMath.js`, run over one story's entries. pgvector is a later option and isn't needed at this scale.

**Why rows of JSON rather than a fully normalized schema:** the services already work on story and chat aggregates. Moving them onto rows changes five storage modules instead of the dozens of call sites. Each update is a transaction that locks one row (`SELECT … FOR UPDATE`, apply the existing change function, write it back). That row lock replaces the global write lock. **Known limit:** a very long chat rewrites its whole row a few times per turn. If chats grow into the megabytes, moving messages into their own table is the follow-up.

## Backend changes
- **Prisma setup:**
  - Prisma 7 with the `prisma-client` generator and `@prisma/adapter-pg` over the pooled Prisma Postgres URL (`DATABASE_URL`).
  - Migrations in `backend/prisma/migrations`, applied with `prisma migrate deploy` in Render's pre-deploy command.
  - Confirm the exact Prisma 7 config with the prisma skills when building.
- **Storage:**
  - New `src/storage/prisma/` with `createStoryRepository(prisma, userId)`, `createChatRepository(prisma, userId)`, `createMemoryIndex(prisma, userId, embedder)` and `createSettingsStore(prisma, userId, cipher)`. Same interfaces as today.
  - The existing memory-backed versions stay for tests.
  - `routes/data.js` (export/import) moves onto the repositories.
- **Per-request tenant scope:**
  - `app.js` resolves the session for every `/api/v1` request except `/health`. No session gives a 401 `unauthenticated` error.
  - It then builds the services for that user with `createServices({ ...shared, repositories: forUser(userId) })`. Lore, templates and the local models stay shared, per process.
- **New-user setup:** `storyMigrationRunner` becomes `ensureUserSetup(userId)`. It creates the user's "My story" with the default character when it's missing; the legacy personality path is kept only for the import. It runs at sign-up and lazily on first request.
- **Streaming guard:** `streamingChatIds` is replaced by a conditional update on `Chat.streamingSince`. It is claimed only when empty or older than 10 minutes, and cleared in a `finally`. One instance doesn't strictly need this, but it keeps the guard correct if Render is later scaled to two or more instances, or during a zero-downtime deploy, when an old and a new instance overlap.
- **Provider keys:**
  - Keys are saved encrypted per user. `publicView()` still returns only hints.
  - The environment-variable fallback is off when `OREAD_MULTI_TENANT=true`, so no one ever uses the owner's keys. It stays on for local development.
  - User-supplied `baseUrl` values must be `https` and must not point at private or loopback addresses (SSRF guard), except in local development.
- **Auth: Better Auth with its Prisma adapter, mounted at `/api/auth/*` through `toNodeHandler`:**
  - email and password
  - `requireEmailVerification`
  - password reset
  - database-backed rate limiting
  - HTTP-only, secure, same-site cookies

  Verification and reset emails go through Resend (`RESEND_API_KEY`, `OREAD_MAIL_FROM` on a verified domain), as small templates in `src/mail/`. Deleting an account cascades to every row the user owns.
- **One Render web service serves the API and the app:**
  - `server.js` also serves the built `frontend/dist` (static files, with a fallback to `index.html` for the single-page app) for anything outside `/api`. This lives in a small `http/staticFiles.js`.
  - The same origin means no CORS and no cross-site cookie problems, and there's one service to pay for.
  - In production it listens on `0.0.0.0:$PORT`.
- **`render.yaml` blueprint**, checked in:
  - **Build:** `npm ci` in both folders, `vite build`, `prisma generate`, and `npm run models:fetch`. That new script downloads both models into `backend/models`, so they ship with the build and are never downloaded at boot.
  - **Pre-deploy:** `prisma migrate deploy`.
  - **Start:** `node backend/src/server.js`.
  - **Health check:** `/api/v1/health`.
  - **Env vars:** listed with `sync: false` for the secrets.
  - **Instance:** a paid plan with about 2 GB RAM (Standard), so the two models fit beside Node.
- **Local models:** they load once at start, as they do today. Existing fallbacks still cover a failed load: `engine_skipped` for the emotion model, and recency-only memory picks for search.
- **Long turns:** Render keeps HTTP streams open, so a turn of up to three provider calls streams as it does locally. A small heartbeat line every 20 seconds while waiting on a provider keeps any proxy from closing an idle stream. The client already ignores events it doesn't know.
- **One-time import:** `backend/scripts/importLocalData.js --email <your email>`.
  - It reads `backend/data/*.json` and runs the existing story migration.
  - It writes your stories, chats, embeddings and settings into your account, encrypting the saved keys.
  - It is safe to re-run, because it upserts by id. Local files are only read.

## Frontend changes
- **Auth slice:** the session, `signIn`, `signUp`, `signOut`, `requestPasswordReset`, `resetPassword` and `resendVerification`. Everything goes through `src/api`, the only code that calls the backend.
- **401 handling:** the API client handles a 401 by setting the store to signed out.
- **Screens** (atomic design, primitives only, styled like the mockups):
  - `AuthTemplate`
  - organisms `SignInForm`, `SignUpForm`, `CheckYourEmail`, `ForgotPasswordForm` and `ResetPasswordForm`
  - an email-verified landing page

  `App` shows the auth screens until there's a session.
- **Account:** Settings gains an Account section: email, change password, sign out, and delete account (with a confirmation through `src/platform`). The header gets a sign-out entry.
- **API base:** `VITE_API_BASE_URL` defaults to `/api/v1` in production builds, which is the same origin as the app. Local development keeps Vite on 5173, with a Vite proxy for `/api` so cookies work there too.

## Build order
1. Finish the restyle (step 0).
2. Prisma schema, migrations, the Prisma repositories and the cipher, plus contract tests against both the memory and Prisma implementations.
3. Better Auth and Resend, the session middleware, per-user services, `ensureUserSetup`, the streaming guard, key encryption and the SSRF guard.
4. Frontend auth screens and the Account section.
5. Static serving from `server.js`, the Vite proxy, `models:fetch`, the heartbeat and `render.yaml`; a first deploy to Render.
6. Import your data into your account.
7. Copy this plan to `plan/render-launch-plan.md`, and update `CLAUDE.md` and the README.

## What you'll need to provide
- A Prisma Postgres database (Console or `prisma postgres link`), which sets `DATABASE_URL`.
- A Render account, with the GitHub repo connected so it can deploy from the blueprint.
- Resend: an API key and a verified sending domain.
- Two random secrets, `OREAD_SECRET_KEY` and `BETTER_AUTH_SECRET`. I'll generate them for you to paste into Render.
- Later, if you want one: a custom domain.

## Verification
- **Backend tests** (still `node:test`, with no database needed by default):
  - the repository contract suite on the memory implementation
  - the same suite on Prisma when `TEST_DATABASE_URL` is set (a temporary `create-db` database)
  - tenant isolation: user B gets 404 for user A's story, chat, memory and search, and import and export are scoped to the user
  - a 401 without a session
  - the cipher round trip, and that keys are never returned
  - no env-key fallback in multi-tenant mode
  - the SSRF guard
  - the streaming claim across two service graphs
  - `ensureUserSetup`
  - the import script against a copy of today's data
- **Frontend tests:** the auth slice and forms, the 401 sign-out, and the Account section.
- **Locally:** a production-style run, `vite build` and then `node backend/src/server.js`, against a temporary `create-db` database. Check that the app and API are served from one port and that cookies work.
- **Manual (on Render):**
  - Sign up two accounts and verify both by email.
  - Reset a password.
  - Play a story turn with streaming and the hidden notes.
  - Confirm each account sees only its own data.
  - Check the boot time with the models loaded and the memory use against the instance size.
  - Confirm there are no console errors.
