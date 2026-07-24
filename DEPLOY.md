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

## Wake / sleep — arming the real EC2 start/stop

The box the demos run on sleeps when idle to save money. The control that wakes
it lives here in the Next app (Vercel, always-on) — never on EC2, because the
thing that powers a box on cannot run on the box it powers.

It ships **complete and inert**: state is tracked and the UI works, but the
`StartInstances`/`StopInstances` calls are dry-run until you arm them. Arming is
the only remaining step, and it is all configuration:

1. **Upstash** — create a free Redis database, copy `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN` into the Vercel env. (Required in production so the
   state survives across serverless invocations; dev uses in-memory.)
2. **IAM** — create a user with the policy below, scoped to your one instance.
   Put its `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` and `AWS_REGION` +
   `EC2_INSTANCE_ID` into the Vercel env.
3. **Arm it** — set `AWS_LIVE=true`. Until this is exactly `true`, no AWS call is
   ever made, even with everything else set.
4. **Protect the cron** — set `CRON_SECRET`; Vercel sends it to the scheduled
   sleep route as a bearer token. The cron itself is already declared in
   `vercel.json` (every 15 minutes).

### IAM policy (least privilege)

`StartInstances`/`StopInstances` are scoped to exactly one instance ARN.
`DescribeInstances` cannot be resource-scoped by IAM, so it is granted read-only
and pinned to the region.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "GlassBoxStartStop",
      "Effect": "Allow",
      "Action": ["ec2:StartInstances", "ec2:StopInstances"],
      "Resource": "arn:aws:ec2:<region>:<account-id>:instance/<instance-id>"
    },
    {
      "Sid": "GlassBoxDescribe",
      "Effect": "Allow",
      "Action": "ec2:DescribeInstances",
      "Resource": "*",
      "Condition": { "StringEquals": { "ec2:Region": "<region>" } }
    }
  ]
}
```

### The state machine

`asleep → waking → awake → sleeping → asleep`. Wake is idempotent and the
anti-spam protection is the state check, not the frontend: two visitors clicking
wake in the same second race on an atomic compare-and-set, and only the winner
calls `StartInstances`. `waking` flips to `awake` **only** once
`GET /api/health/deep` genuinely reports ready — reporting awake early is the
one sure way to show a visitor a broken demo. The cron stops the box after
`DEMO_IDLE_MS` of no real interaction.

## Build

```bash
bun run lint
bun run build
```

Both must pass before a deploy. Vercel runs `next build` itself.
