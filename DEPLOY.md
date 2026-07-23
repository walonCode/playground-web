# Deploying `web` to Vercel

The site is a standard Next.js 16 app; Vercel auto-detects the framework and the
bun package manager from `bun.lock`. No `vercel.json` is needed.

## How the browser reaches the backend

The site is served over HTTPS. The backend (`api/`) runs on EC2 over plain HTTP.
A browser on an HTTPS page **cannot** fetch an HTTP URL — it is blocked as mixed
content — so the browser never calls the backend directly.

Instead, `next.config.ts` proxies this origin's `/api/*` to the backend
**server-side**, where HTTP is fine:

```
browser ──HTTPS──▶ vercel /api/search ──HTTP──▶ EC2 :3001 /api/search
```

Consequences, all of them good:

- **No mixed content** — the browser only ever talks to the Vercel origin.
- **No CORS** — same origin, so no preflight and no `TRUSTED_ORIGINS` change.
- **No TLS on the box** — the certificate lives at Vercel's edge.
- The `tookMs` numbers stay honest: they are measured inside the search service
  and returned in the body, unaffected by the proxy hop.

When the box is asleep the proxy destination is unreachable, the calls fail, and
the UI shows `unknown` / `—` rather than crashing. Waking it is the lifecycle
feature (not yet built).

## Environment variables (set in the Vercel dashboard)

| Variable | Example | Why |
|---|---|---|
| `API_ORIGIN` | `http://<elastic-ip>:3001` | Backend origin the `/api` proxy forwards to. Server-only. |
| `NEXT_PUBLIC_SITE_URL` | `https://glassbox.vercel.app` | Page metadata + the absolute URL in the copyable curl commands. |

Leave `NEXT_PUBLIC_API_URL` **unset** in production — that switches the browser
to call the backend directly and is for local development only.

## Local development

```bash
bun install
bun run dev            # http://localhost:3000
```

`.env.local` already sets `NEXT_PUBLIC_API_URL=http://localhost:3001/api`, so the
browser hits the gateway directly and skips the proxy. Run the backend alongside:

```bash
cd ../api && pnpm infra:up && pnpm dev:all
```

## Build

```bash
bun run lint
bun run build
```

Both must pass before a deploy. Vercel runs `next build` itself.
