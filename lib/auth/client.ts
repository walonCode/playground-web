"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Same-origin, so no baseURL is needed: the auth routes are part of this app.
 * `useSession` drives every gated control in the UI.
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;

/**
 * Fetches a short-lived JWT for talking to the box.
 *
 * The session cookie authenticates the visitor to *this* app; the box is a
 * different origin and verifies a signed token instead. Better Auth mints one
 * from the current session at /api/auth/token — this is the bridge between the
 * two halves of the system.
 */
export async function getBoxToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/token", { credentials: "include" });
    if (!res.ok) return null;
    const body = (await res.json()) as { token?: string };
    return body.token ?? null;
  } catch {
    return null;
  }
}
