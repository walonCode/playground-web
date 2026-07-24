"use client";

import { useState } from "react";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { clearBoxToken } from "@/lib/api";
import { signOut, useSession } from "@/lib/auth/client";

/**
 * Session state in the HUD, and the door to signing in.
 *
 * Deliberately not a wall: the mesh, the live status and every read stay open
 * to anonymous visitors. This only appears when an action needs an identity —
 * a recruiter should see the system working before being asked for anything.
 */
export function AuthControl() {
  const { data: session, isPending } = useSession();
  const [open, setOpen] = useState(false);

  async function out() {
    await signOut();
    // Drop the cached box JWT too, or the next request would still carry it.
    clearBoxToken();
  }

  return (
    <>
      <div className="pointer-events-auto flex items-center gap-2 border border-line bg-void/90 px-3 py-2 backdrop-blur-sm">
        {isPending ? (
          <span className="font-mono text-[10px] text-text-low">…</span>
        ) : session?.user ? (
          <>
            <span className="size-1.5 bg-nominal" aria-hidden="true" />
            <span className="max-w-[9rem] truncate font-mono text-[11px] text-text-mid">
              {session.user.name || session.user.email}
            </span>
            <button
              type="button"
              onClick={out}
              className="font-mono text-[10px] tracking-[0.14em] text-text-low uppercase transition-colors hover:text-text-hi"
            >
              out
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="font-mono text-[10px] tracking-[0.16em] text-nominal uppercase transition-colors hover:text-text-hi"
          >
            sign in
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-void/80 p-4 backdrop-blur-sm">
          <div className="animate-rise w-full max-w-sm">
            <AuthPanel onDone={() => setOpen(false)} />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 w-full border border-line py-2 font-mono text-[10px] tracking-[0.16em] text-text-low uppercase transition-colors hover:border-line-bright hover:text-text-hi"
            >
              close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
