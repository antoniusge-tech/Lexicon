# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Lexicon: a vocabulary flashcard web app built with React 18 and Firebase (Auth + Firestore). Most UI strings and many code comments are in Russian.

## Running

- `npm start` (or `npm run dev`) serves the repo root with `python3 -m http.server 3000`. Open http://localhost:3000.
- There is **no build step, bundler, linter or test suite**. `@babel/*` in `package.json` is unused at runtime.
- Deploy Firestore rules with `firebase deploy --only firestore:rules` (`firebase.json` only configures rules).
- `scripts/migrate-uid.mjs` is a one-off Node admin script built on `firebase-admin`. It moves a user's data from one uid to another and is a dry run unless you pass `--apply`. `firebase-admin` is installed in `node_modules` but is missing from `package.json`.

## Architecture

**In-browser JSX, shared global scope.** `index.html` loads React and ReactDOM (UMD), `@babel/standalone` and the Firebase **compat** SDK (v10) from CDNs. It then loads the app files as `<script type="text/babel">` in this fixed order:

`firebase.jsx` → `data.jsx` → `progress.jsx` → `components.jsx` → `auth.jsx` → `app.jsx`

- None of these files use `import`/`export`. Each one publishes its API with `Object.assign(window, {...})` at the bottom, and later files use those globals (often as `window.lwX`). A new file must be added to `index.html` in the correct position. A function used by another file must be added to that file's `Object.assign(window, …)` list.
- Naming convention: globals use the `lw` prefix for functions (`lwSetDoc`) and `LW_` for constants (`LW_KEYS`). React components use PascalCase.
- **All CSS** (design tokens on `:root`, the dark theme via `html[data-theme="dark"]`, and every component style) lives in the `<style>` block of `index.html`. No CSS files exist.
- **Design system: "Lucid Mentor"** (`stitch_/lingoflow/DESIGN.md`). Tokens are named after it: `--surface` (page background), `--surface-low`, `--surface-lowest` (cards), `--surface-high`/`--surface-highest`, `--on-surface`, `--on-surface-variant`, `--primary` (blue), `--secondary` (gold, used for correct/success), `--tertiary` (progress bars), `--error`. Fonts are Plus Jakarta Sans (`--font-display`) and Inter (`--font-body`). Follow the "no-line" rule: separate areas with background shifts and shadows, not 1px borders. Where a boundary is needed, use `var(--ghost)`. `DESIGN.md` defines no dark theme, so the dark values in `index.html` are our own. UI text is English.

**File responsibilities**
- `firebase.jsx` is the only place that talks to Firestore and Auth. It holds the config, register/login (username or email), account deletion, the live `onSnapshot` watchers, `lwSetDoc`/`lwDeleteDoc`, and the admin fetches.
- `data.jsx` holds device-local state. That covers the `LW_KEYS` localStorage keys with the `lwLoad`/`lwSave` helpers, photo resize and auto-lookup (Openverse, then Wikipedia), and the Gemini AI calls (`lwAiFillWord`, `lwAiFillWords`, `lwAiGenerateBatch`).
- `progress.jsx` holds pure spaced-repetition logic with no Firestore or React: the Leitner boxes (`LW_BOXES`: 10 min, 1 d, 3 d, 7 d, 14 d, 30 d; box 5 means Mastered), `lwNextProgress`, `lwWordStatus`, streak, XP and level.
- `components.jsx` contains shared UI: icons (`Ic`), `Flashcard`/`FillCard`, `Modal`, `WordForm`, `ImportView`, `GeminiKeyModal`.
- `auth.jsx` contains `AuthView`.
- `app.jsx` holds the root `App`, the shell (`AppBar`, `NavDrawer`, `TabBar`) and all page views (`LearnView` wrapping Study/Review/Choice/Fill, Reading, Library, Import, Profile, Admin). `CategoryView` is the group picker, shown in a bottom sheet (`<Modal sheet>`). It also mounts React.
- Navigation state is `nav = {tab, learnMode}`, persisted in `LW_KEYS.nav`. Tabs are `learn | reading | library | profile | import | admin`, and Learn modes are `cards | review | choice | fill`. Navigate with `goTo(name)`, which also accepts Learn modes, the legacy `'study'`, and `'category'` (opens the group sheet). Toast actions use these names. Below 1024px the UI is an app bar, a slide-in drawer and a bottom tab bar. From 1024px the drawer becomes a permanent sidebar.

**Data model (Firestore)**
- `users/{uid}` stores `{username, role: 'user'|'premium'|'admin', lang}`. `usernames/{lowercased}` stores `{uid}` and enforces unique usernames.
- `groups` and `words` are flat collections. Every doc has `userId`, `username` and `shared`. Groups nest one level deep through `parentId`. Words belong to a group through `groupId`, and only leaf groups (`lwLeafGroups`) can hold words.
- Clients see their own docs **plus** docs with `shared: true`; `lwWatchUserAndSharedCollection` merges the two queries. Only admins can create shared docs, and anything an admin creates or imports is written with `shared: true`.
- `firestore.rules` enforces this. `list` queries must carry filters (`userId == uid` or `shared == true`) that prove every result is allowed, so new queries need those filters too. One example is the extra `userId` filter in `lwDeleteWordsByGroup` for non-admins. `lwSetDoc` strips `undefined` fields because Firestore rejects them.
- Legacy accounts sign in with a synthetic email `<username>@lexicon.local`. Newer accounts use real emails.
- `progress/{uid}_{wordId}` stores `{userId, wordId, box, due, reps, lapses, lastSeen, lastMode}`, one doc per user per word. It sits in a separate collection because users can't write shared words. `activity/{uid}_{YYYY-MM-DD}` (device-local date) stores `{userId, date, answers, correct, xp, goalMet}`. Both are written together by `lwRecordAnswer` (one batch, `merge` + `increment`, no transaction). Total XP is the sum of `activity.xp`. The daily goal is `users/{uid}.dailyGoal`, default 20 answers.
- The rules define an `ai_usage` collection meant to be written by a Cloud Function, but no functions code exists in this repo.

**State flow in `App`**
- Auth state → user doc → live subscriptions to groups and words. All data lives in `App` state and reaches the views as props.
- `App` also subscribes to `progress` and `activity` and owns `recordAnswer(wordId, known, mode)`. Study, Fill, Choice and Review call it on every answer except skip. Know only moves a word up a box once it is due, so reviewing early keeps the box. Review (`ReviewView`) queues every word whose `due` has passed, across all groups.
- Device-only settings (theme, selected groups, study direction, last batch of reading cards, the user's **personal Gemini API key**) persist in localStorage under the versioned `lw_*_v1` keys.
- Long-running AI jobs (reading-text generation, AI fill on import) run as promises owned by `App` (`startReadingGeneration`, `startImportAiFill`), so they survive tab switches. Results come back as toasts. `genIdRef` discards stale responses.
- Gemini is called straight from the browser with the user's own key. AI helpers throw errors whose `.code` is `no-key`, `bad-key`, `quota`, `refusal` or `network`, and `app.jsx` maps those codes to messages (`LW_READING_ERROR_MSG`, `LW_IMPORT_ERROR_MSG`).

## Other directories and files

- `stitch_/` holds design mockups only (`code.html` plus `screen.png` per screen, and `lingoflow/DESIGN.md`). It is not loaded by the app. The live app implements `DESIGN.md` by hand in `index.html` (no Tailwind). The integration plan and per-stage plans are in `stitch_/INTEGRATION_PLAN.md`, `STAGE1_PLAN.md` and `STAGE2_PLAN.md`.
- `service-account.json` is a Firebase Admin key used only by the migration script. It is gitignored. Don't read it or commit it.
