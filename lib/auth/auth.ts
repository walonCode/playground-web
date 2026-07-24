import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { db } from "./db";
import * as schema from "./schema";

/**
 * Better Auth, running on Vercel rather than on the EC2 box.
 *
 * This placement is the whole point. Auth used to live on the instance, which
 * created a deadlock: you needed the box awake to sign in, and you needed to be
 * signed in to wake the box. Hosting identity on the always-on side breaks it —
 * sign-in works while the instance is stopped, and the resulting JWT is what
 * authorises the wake.
 *
 * The box never shares a secret with this. The jwt plugin signs with EdDSA and
 * publishes the public keys at /api/auth/jwks, so the gateway and chat verify
 * independently — a token this app issues is checked again on arrival.
 */
const baseURL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function socialProvider(idEnv: string, secretEnv: string) {
  const clientId = process.env[idEnv];
  const clientSecret = process.env[secretEnv];
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}

const github = socialProvider("GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET");
const google = socialProvider("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET");

/** What the sign-in screen should offer — only what is actually configured. */
export const enabledProviders = [
  "email",
  ...(github ? ["github"] : []),
  ...(google ? ["google"] : []),
];

export const auth = betterAuth({
  appName: "Glass Box",
  baseURL,
  basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET,

  trustedOrigins: [baseURL],

  database: drizzleAdapter(db, { provider: "pg", schema }),

  /**
   * No mail transport exists, so verification and reset are both off — there is
   * no way to deliver the message either would depend on. Sign-up is immediate.
   */
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  socialProviders: {
    ...(github ? { github } : {}),
    ...(google ? { google } : {}),
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["github", "google"],
      // Nothing here can send a verification mail, so every password account is
      // permanently unverified; left at its default a password user could never
      // later use the Google or GitHub button. Acceptable because every account
      // holds simulated demo data only.
      requireLocalEmailVerified: false,
    },
  },

  plugins: [
    jwt({
      jwt: {
        // Keep the token small — by default the whole user object is embedded,
        // and this travels on every request to the box.
        definePayload: ({ user }) => ({
          id: user.id,
          email: user.email,
          name: user.name,
        }),
        expirationTime: "15m",
      },
    }),
  ],
});

export type Auth = typeof auth;
