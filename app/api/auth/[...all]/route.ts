import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/auth";

/**
 * Better Auth's whole surface, served from Vercel.
 *
 * This is a filesystem route, so it wins over the `/api/*` proxy rewrite in
 * next.config.ts — auth resolves here and never travels to the box. That is
 * what lets a visitor sign in while the instance is stopped.
 *
 * It also publishes /api/auth/jwks, the public keys the gateway and chat use to
 * verify tokens independently.
 */
export const { GET, POST } = toNextJsHandler(auth);

export const dynamic = "force-dynamic";
