# Rook Lite Handoff

Last updated: 2026-09-19

## Location

The standalone project is in:

```text
~/workspace/personal/rook-lite
```

This directory is not currently a Git repository. Initialize one before committing if desired.

## Current State

Rook Lite is a static Vite/TypeScript application that preserves the existing Rook CSS, assets, shell, navigation, editor styling, themes, and responsive behavior.

Implemented:

- No authentication, accounts, profiles, organizations, or remote database.
- IndexedDB database named `rook-lite`, version 1.
- Notes with create, edit, delete, categories, tags, dates, Markdown rendering, and draft recovery.
- Category create, rename, archive, delete, default seeding, and transactional detachment from notes.
- Local search across derived titles, content, categories, and tags, with year/category filters.
- Calendar activity display backed by local notes.
- Markdown task extraction and exact source-line completion.
- Deterministic rule-based summaries for weekly, monthly, yearly, and custom ranges.
- Optional loopback-only Ollama summaries with connection testing, model discovery, timeout handling, and rule-based fallback.
- Markdown directory export through File System Access API when available.
- Markdown ZIP download fallback.
- Versioned JSON backup, validation, confirmation, and transactional restore.
- Service worker and PWA manifest for offline operation.
- Static Nginx Docker image; browser IndexedDB remains the data store.
- Storage usage, persistence status, and live online/offline diagnostics.

## Important Files

- `src/main.ts`: UI shell, routing, page rendering, and interaction wiring.
- `src/db.ts`: IndexedDB schema, repositories, snapshots, restore, and transactions.
- `src/models.ts`: persistent data types.
- `src/services.ts`: notes, categories, drafts, search normalization, and task updates.
- `src/markdown.ts`: Markdown rendering, sanitization, title derivation, and tag extraction.
- `src/summaries.ts`: rule-based and Ollama summary engines.
- `src/data.ts`: Markdown export and JSON backup/restore.
- `src/app.css`: copied existing Rook stylesheet.
- `src/lite.css`: Lite-specific additions only.
- `public/sw.js`: offline application-shell caching.
- `Dockerfile` and `nginx.conf`: static Docker deployment.

## Verification Baseline

The following passed at handoff:

```bash
npm test
npm run build
npm audit
docker build --load -t rook-lite:local .
```

Results:

- 12 tests passing across 3 test files.
- TypeScript and Vite production build passing.
- `npm audit` reports 0 vulnerabilities.
- Docker image builds and loads successfully.

## How To Resume

```bash
cd ~/workspace/personal/rook-lite
npm install
npm run dev
```

Then open the URL printed by Vite, normally `http://localhost:5173`.

For the production container:

```bash
docker build --load -t rook-lite:local .
docker run --rm -p 8080:8080 rook-lite:local
```

Use the same browser origin consistently. IndexedDB is origin-scoped, so `localhost:5173` and `localhost:8080` contain separate local notebooks.

## Recommended Next Work

1. Add Playwright browser tests and screenshot baselines for desktop/mobile and light/dark modes.
2. Manually verify service-worker offline reload and update behavior in a production build.
3. Improve search snippets, relevance scoring, tag/date controls, and pagination for larger notebooks.
4. Add note archive UI if archive behavior is still required.
5. Expand rule-based summary heuristics and fixtures, especially Turkish text and repeated-term ranking.
6. Add mocked Ollama response tests for success, timeout, malformed response, unavailable model, and fallback persistence.
7. Expand backup validation to validate every field and add explicit older-backup migration functions before schema version 2.
8. Add Markdown import if round-trip Markdown restore is desired in addition to JSON restore.
9. Test File System Access permission re-grant and partial-write errors in Chromium.
10. Review and prune unused server-era CSS only after visual regression coverage exists.

## Known Limitations

- No real-browser or visual regression suite yet.
- The app uses client-rendered HTML rather than the old Thymeleaf/HTMX runtime.
- Search is a simple normalized local scan, not PostgreSQL full-text/trigram search.
- Task completion targets the exact current source line but does not yet retain rollover metadata.
- Ollama browser access may require `OLLAMA_ORIGINS` configuration because of CORS.
- File System Access directory export is Chromium-oriented; ZIP export is the fallback.
- Sensitive-note encryption is intentionally not implemented; the old server key-file design cannot be safely copied into a static browser app.
- The service worker is implemented but has not yet been covered by automated browser tests.
- Direct Docker bind-mounted export is not supported; that still requires the optional future Go bridge.

## Data Safety

Before changing IndexedDB schema:

- Increment the explicit database version in `src/db.ts`.
- Add a forward migration; never delete the database as an upgrade strategy.
- Add migration fixtures and preservation tests.
- Create a JSON backup before manual destructive testing.

Do not change the serving hostname, port, or scheme without first exporting a JSON backup, because browser storage belongs to the exact origin.
