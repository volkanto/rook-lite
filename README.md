# Rook Lite

Rook Lite is the browser-local edition of Rook. The current implementation establishes the static application shell while preserving Rook's existing design, responsive navigation, themes, editor controls, and core screen structure.

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## GitHub Pages deployment

### Enable GitHub Pages

In the GitHub repository, open:

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

### Deployment

The `Deploy to GitHub Pages` workflow builds and deploys the site automatically whenever code is pushed to `main`.

It can also be started manually from:

```text
Actions → Deploy to GitHub Pages → Run workflow
```

The deployed URL normally uses this format:

```text
https://<username>.github.io/<repository-name>/
```

The workflow configures Vite's base path from GitHub Pages, so project Pages deployments work below the repository subdirectory. GitHub Pages only hosts the frontend; notes and settings remain in that browser origin's IndexedDB.

## Docker

```bash
docker build -t rook-lite .
docker run --rm -p 8080:8080 rook-lite
```

Notes remain in the browser's IndexedDB for the `http://localhost:8080` origin. The container stores no note data.

## Privacy

Rook Lite has no authentication, remote database, telemetry, hosted AI, or cloud synchronization. Ollama endpoints are restricted to loopback addresses. Notes leave IndexedDB only when the user explicitly exports or backs them up.

## Continuing Development

See [`HANDOFF.md`](./HANDOFF.md) for the current implementation status, verification baseline, known limitations, and recommended next work.
