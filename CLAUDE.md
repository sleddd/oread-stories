# Oread — project rules

Oread is a roleplay chat driven by a personality lorebook. It has two parts:

- `backend/` — Node API service (no framework). Owns the lorebook, prompt building, storage, settings and model providers.
- `frontend/` — React interface built with atomic design, Zustand and styled-components, structured so it can move to React Native.

## Code standard (applies to every file)

Code must read like clear prose to a developer seeing it for the first time.

### Naming
- Use full, descriptive names for every variable, parameter, function and property. No single letters and no abbreviations:
  `personality`, not `p`; `message`, not `m`; `index`, not `i`; `event`, not `e` or `ev`; `settings`, not `s`.
- Names say what a thing is or does: `findChatById`, `isReplyStreaming`, `historyWindowSize`.
- Booleans read as questions: `isBusy`, `hasApiKey`, `shouldScrollToEnd`.
- Name magic numbers as constants: `const MAX_TITLE_LENGTH = 120`.

### Structure
- One statement per line. No comma-separated declarations (`let a = 1, b = 2`).
- Always use braces for `if`, `for` and `while`, even for one line.
- No nested or chained ternaries. Use `if`/`else` or a small named function.
- Keep functions short and single-purpose. If a function needs a comment to explain its parts, split it into named functions.
- Prefer early returns over deep nesting.
- Avoid clever one-liners: long `.map().filter().sort()` chains spread over named steps.
- One component, service or concept per file. File names match what they export.

### Comments
- Explain *why*, not *what*. A short header comment per file says what the module is for.

### Formatting
- 2-space indent, double quotes, semicolons, trailing commas in multi-line literals.
- Keep lines under about 100 characters.

## Backend
- Layers: `routes/` (HTTP only) → `services/` (behaviour) → `lore/` (pure personality logic) and `storage/`.
- All API routes live under `/api/v1`. Errors are `{ "error": { "code", "message", "details"? } }` with correct status codes, thrown as `HttpError`.
- Validate request bodies at the edge; services trust their inputs.
- The lorebook (`backend/lore/lore.json`) is static and read-only. Nothing in the API may change it.
- Tests: `node:test`, in `backend/test/`. Run with `npm test` in `backend/`.

## Frontend
- Stack: React, Zustand (state), styled-components (styles). Vite for the dev server and build.
- Atomic design: `components/atoms` → `molecules` → `organisms` → `templates`, then `pages`.
- React Native readiness:
  - Components never use DOM elements directly. They build on the primitives in `src/ui/primitives`
    (`View`, `Text`, `Pressable`, `TextInput`, `Slider`, `ScrollView`, `Select`), which use React Native–style props
    (`onPress`, `onChangeText`, `onValueChange`). A native build swaps that one folder.
  - Browser-only APIs (clipboard, files, confirm, storage, colour-scheme) go through `src/platform`.
  - Styles use theme tokens from `src/theme`, never hard-coded colours. Web-only CSS (grid, media queries, sticky)
    stays in templates.
- State lives in the Zustand store (`src/store`), split into slices. Components read with selectors and call store actions;
  they don't call the API directly.
- The API client (`src/api`) is the only code that talks to the backend.
- Tests: Vitest + React Testing Library (jsdom), in `frontend/test/`. Run with `npm test` in `frontend/`.
  Store slices are tested with the fake API and platform in `test/helpers.jsx`; components are rendered with
  `renderWithTheme` and checked through what a person sees and does (roles, labels, text), not class names.
