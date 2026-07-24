import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * The auth database — deliberately NOT the box's Postgres.
 *
 * Sign-in has to work while the EC2 instance is asleep, which is exactly when
 * the box's database is unreachable. So identity lives in its own always-on
 * Postgres (Neon in production) and the box's databases hold only demo data.
 *
 * Neon speaks the normal Postgres wire protocol, so this is the same driver and
 * the same Drizzle schema as the rest of the project — only the connection
 * string differs between local development and production.
 */
const connectionString =
  process.env.AUTH_DATABASE_URL ??
  "postgres://playground:playground@localhost:5432/web_auth_db";

declare global {
  // eslint-disable-next-line no-var
  var __authPool: Pool | undefined;
}

/**
 * Reused across serverless invocations and dev hot-reloads. Creating a pool per
 * invocation is the classic way to exhaust a Postgres connection limit.
 */
const pool =
  globalThis.__authPool ??
  new Pool({
    connectionString,
    // Neon pools aggressively at its own proxy; a small local ceiling is right.
    max: 5,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== "production") globalThis.__authPool = pool;

export const db = drizzle(pool, { schema });
