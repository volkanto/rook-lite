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
