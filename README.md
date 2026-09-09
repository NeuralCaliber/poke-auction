# Poké Auction

Blind multiplayer Pokémon auction. 2–6 players in a private room bid on hidden lots — generation and types only — then reveal and score a team.

No accounts, no payments, no analytics. Identity is a client-generated UUID in `localStorage`.

## Packages

- `/shared` — types, wire protocol, pure game logic, Vitest
- `/server` — Cloudflare Worker + SQLite Durable Object (one instance per room)
- `/client` — Vite + React + Tailwind

## Local development

Use two terminals:

```bash
pnpm install
pnpm test
pnpm dev:server    # wrangler dev → http://localhost:8787
pnpm dev:client    # vite → http://localhost:5173
```

The Vite dev server proxies `/api` (including WebSockets) to the Worker.

1. Open http://localhost:5173
2. Create a room — you land on `/r/ABCD`
3. Share that URL. Each device/browser profile is a different player (UUID is per origin storage)

## Deploy

Build the client, then publish the Worker (it also serves the UI):

```bash
pnpm deploy
```

Requires Wrangler auth (`npx wrangler login`). The Durable Object uses SQLite (`new_sqlite_classes`), which is required on the Workers free plan.

Same-origin deploys need no `VITE_API_ORIGIN`. For a separate static host, build with:

```
VITE_API_ORIGIN=https://your-worker.example.workers.dev pnpm build:client
```

## Rules (short)

Players start with a host-configured budget (default $25) and bid on lots one at a time. Passing leaves that lot. Last remaining bidder pays and receives a still-hidden Pokémon. When nobody can bid, leftovers are dealt for free, then rosters reveal.

Score = base stat total + 40 per distinct type + 30 per distinct generation + 10 per unspent dollar. Ties go to whoever spent fewer dollars.
