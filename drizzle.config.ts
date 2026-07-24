import { defineConfig } from "drizzle-kit";

/**
 * Auth schema only. This database is deliberately separate from the box's —
 * sign-in must work while the instance is stopped, so identity cannot live on
 * the instance. Neon in production, local Postgres in development.
 */
export default defineConfig({
  schema: "./lib/auth/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.AUTH_DATABASE_URL ??
      "postgres://playground:playground@localhost:5432/web_auth_db",
  },
});
