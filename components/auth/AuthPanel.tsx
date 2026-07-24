"use client";

import { type FormEvent, useState } from "react";
import { Panel, PanelSection } from "@/components/panel/Panel";
import { signIn, signUp } from "@/lib/auth/client";

type Mode = "sign-in" | "sign-up";

/**
 * Email/password sign-in, served from Vercel.
 *
 * There is no mail transport in this project, so there is no verification step
 * and no reset flow — sign-up is immediate. That is a deliberate limitation, not
 * an oversight, and every account holds simulated demo data only.
 */
export function AuthPanel({ onDone }: { onDone?: () => void }) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const result =
        mode === "sign-up"
          ? await signUp.email({ email, password, name: name || email })
          : await signIn.email({ email, password });

      if (result.error) {
        setError(result.error.message ?? "that didn't work");
        return;
      }
      onDone?.();
    } catch {
      setError("auth service unreachable");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel label={mode === "sign-in" ? "sign in" : "create account"}>
      <PanelSection>
        <p className="text-sm leading-relaxed text-text-mid">
          Actions that cost real resources — waking the box, queueing jobs,
          posting messages — need an account. Browsing stays open.
        </p>
      </PanelSection>

      <PanelSection>
        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === "sign-up" && (
            <Field
              id="auth-name"
              label="name"
              value={name}
              onChange={setName}
              placeholder="Ada Lovelace"
            />
          )}
          <Field
            id="auth-email"
            label="email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
          />
          <Field
            id="auth-password"
            label="password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="at least 8 characters"
          />

          <button
            type="submit"
            disabled={busy}
            className="mt-1 border border-nominal px-4 py-2 font-mono text-[11px] tracking-[0.16em] text-nominal uppercase transition-colors hover:bg-nominal-dim disabled:opacity-50"
          >
            {busy ? "…" : mode === "sign-in" ? "sign in" : "create account"}
          </button>
        </form>

        {error && (
          <p className="mt-3 font-mono text-[11px] text-down">{error}</p>
        )}

        <button
          type="button"
          onClick={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            setError(null);
          }}
          className="mt-3 font-mono text-[11px] text-text-low underline decoration-line-bright underline-offset-4 transition-colors hover:text-text-hi"
        >
          {mode === "sign-in"
            ? "no account? create one"
            : "already have an account? sign in"}
        </button>
      </PanelSection>

      <PanelSection>
        <p className="font-mono text-[10px] leading-relaxed text-text-low">
          auth runs on this origin, not on the demo box — which is what lets you
          sign in while the box is still asleep. the token it issues is verified
          again by the box on arrival.
        </p>
      </PanelSection>
    </Panel>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-mono text-[10px] tracking-[0.16em] text-text-low uppercase"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required
        autoComplete={type === "password" ? "current-password" : type}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border border-line bg-panel px-3 py-2 font-mono text-sm text-text-hi placeholder:text-text-low focus:border-line-bright focus:outline-none"
      />
    </div>
  );
}
