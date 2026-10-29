# Oread

A roleplay chat driven by a personality lorebook. Move the dials and the next reply is generated from the new prompt.

The app is split in two:

- **backend/** — the API service. It owns the lorebook, builds the prompt, stores the personality, chats and settings, and calls the model providers. API keys never leave it.
- **frontend/** — the interface, built with atomic design. It only talks to the backend API.

## Run it

```sh
npm start            # backend on http://127.0.0.1:4317, interface on http://127.0.0.1:5173
```

Requires Node 20+. Run `npm install` in `frontend/` once. Open http://127.0.0.1:5173, then add a provider key in **Settings** (Claude, OpenAI or compatible, Gemini, or AWS Bedrock). Keys can also come from environment variables: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `GEMINI_API_KEY`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_BEARER_TOKEN_BEDROCK`.

Backend environment: `PORT`, `HOST`, `OREAD_DATA` (data folder), `OREAD_LORE` (lorebook file), `CORS_ORIGINS` (the interface's address). The interface finds the API through the `oread-api` meta tag in `frontend/index.html`.

## Backend

```
backend/lore/lore.json        the lorebook (read-only; edit this file to change it)
backend/data/                 personality, chats and settings
backend/src/server.js         entry point
backend/src/app.js            routes under /api/v1, JSON errors, CORS, NDJSON streaming
backend/src/http/             router, request parsing, responses, errors, validation
backend/src/lore/             engine (bands, mood, patterns), prompt builder, shift markers, public controls
backend/src/services/         settings, personality, chats, model calls, request context
backend/src/providers/        Anthropic, OpenAI-compatible, Gemini, Bedrock adapters
backend/src/storage/          JSON file store with atomic writes
```

API (`/api/v1`): `GET /health` · `GET /lore` · `GET|PUT|PATCH /personality`, `POST /personality/randomize|reset|presets/:id` · `GET|POST /chats`, `GET|PATCH|DELETE /chats/:id`, `POST /chats/:id/messages` and `POST /chats/:id/reply` (stream NDJSON), `GET /chats/:id/context`, `POST /chats/:id/shift/undo`, `PATCH|DELETE /chats/:id/messages/:mid` · `GET|PATCH /settings`, `GET /providers/:id/models`, `POST /providers/:id/test` · `GET /export`, `POST /import`. Errors are `{ "error": { "code", "message", "details"? } }` with matching status codes.

```sh
npm test             # backend and frontend tests (or run npm test inside either folder)
```

## Frontend

React, Zustand and styled-components, served by Vite, built with atomic design and structured to move to React Native.

```
frontend/src/ui/primitives/   View, Row, Text, Pressable, TextInput, Slider, Select, ScrollView — the only
                              place that renders DOM elements, with React Native–style props
frontend/src/platform/        browser-only services: clipboard, files, confirm, storage, colour scheme
frontend/src/theme/           design tokens (light and dark) and global web styles
frontend/src/components/      atoms → molecules → organisms → templates (presentational, props only)
frontend/src/pages/           ChatPage, LorebookPage, SettingsPage — connect the store to the components
frontend/src/store/           Zustand store in slices: ui, personality, chat, reply, settings
frontend/src/api/             the API client and the NDJSON stream reader
frontend/src/content/         interface wording and provider forms
```

A React Native build replaces `ui/primitives` and `platform` and keeps everything else.

Tests (Vitest and React Testing Library) live in `frontend/test/`: store slices, the API client, helpers, and every atom, molecule and organism.

The full prompt and reply for every response are logged to the browser console.

Code standard and project rules: see `CLAUDE.md`.
