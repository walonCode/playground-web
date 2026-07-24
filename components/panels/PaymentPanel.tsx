"use client";

import { useEffect, useState } from "react";
import { usePulse } from "@/components/hero/TrafficContext";
import { CopyCurl, SourceLink, WireTrace } from "@/components/panel/Evidence";
import { Panel, PanelSection } from "@/components/panel/Panel";
import { Readout, ReadoutGrid } from "@/components/panel/Readout";
import type { Status } from "@/components/panel/StatusDot";
import {
  ApiError,
  curlFor,
  type Instrument,
  type PaymentDto,
  type PaymentStatus,
  paymentCheckout,
  paymentInstruments,
  paymentRefund,
  REPO_BASE,
  type StepStatus,
} from "@/lib/api";

const AMOUNT_CENTS = 4200;

const STATUS_TONE: Record<
  PaymentStatus,
  "nominal" | "degraded" | "down" | "default"
> = {
  pending: "default",
  reserved: "degraded",
  charged: "degraded",
  confirmed: "nominal",
  failed: "down",
  compensated: "down",
  refunded: "default",
};

const STEP_TONE: Record<StepStatus, string> = {
  started: "text-degraded",
  succeeded: "text-nominal",
  failed: "text-down",
  compensated: "text-action",
};

const STEP_MARK: Record<StepStatus, string> = {
  started: "▸",
  succeeded: "✓",
  failed: "✕",
  compensated: "↩",
};

export function PaymentPanel() {
  const pulse = usePulse();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [instrument, setInstrument] = useState<string>("4242424242424242");
  const [payment, setPayment] = useState<PaymentDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void paymentInstruments()
      .then((r) => setInstruments(r.instruments))
      .catch(() => setInstruments([]));
  }, []);

  async function checkout() {
    if (busy) return;
    setBusy(true);
    setError(null);
    pulse(["gateway→payment"]);
    try {
      const result = await paymentCheckout({
        amountCents: AMOUNT_CENTS,
        instrument,
        idempotencyKey: `demo-${Date.now()}`,
      });
      setPayment(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "checkout failed");
    } finally {
      setBusy(false);
    }
  }

  async function refund() {
    if (!payment || busy) return;
    setBusy(true);
    setError(null);
    pulse(["gateway→payment"]);
    try {
      setPayment(await paymentRefund(payment.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "refund failed");
    } finally {
      setBusy(false);
    }
  }

  const status: Status = error
    ? "down"
    : payment === null
      ? "unknown"
      : "nominal";
  const canRefund = payment && payment.status === "confirmed";

  return (
    <Panel label="payment · saga" status={status}>
      <PanelSection>
        <p className="text-sm leading-relaxed text-text-mid">
          A checkout runs an authorize → charge → confirm saga. Pick a test card
          to force an outcome; a failure mid-saga compensates the steps that
          already ran. All simulated — no real money, no real card data.
        </p>
      </PanelSection>

      <PanelSection>
        <label
          className="mb-1.5 block font-mono text-[10px] tracking-[0.16em] text-text-low uppercase"
          htmlFor="pay-instrument"
        >
          test card
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            id="pay-instrument"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
            className="min-w-0 flex-1 border border-line bg-panel px-3 py-2 font-mono text-xs text-text-hi focus:border-line-bright focus:outline-none"
          >
            {instruments.map((i) => (
              <option key={i.number} value={i.number}>
                {i.label} · {i.number.slice(-4)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={checkout}
            disabled={busy}
            className="border border-line-bright px-4 py-2 font-mono text-[11px] tracking-[0.16em] text-text-hi uppercase transition-colors hover:bg-panel disabled:cursor-not-allowed disabled:text-text-low"
          >
            {busy ? "…" : "checkout $42"}
          </button>
        </div>
      </PanelSection>

      {payment && (
        <>
          <PanelSection>
            <ReadoutGrid>
              <Readout
                label="status"
                value={payment.status}
                tone={STATUS_TONE[payment.status]}
              />
              <Readout
                label="amount"
                value={`$${(payment.amountCents / 100).toFixed(2)}`}
              />
              <Readout
                label="intent"
                value={payment.intentId?.slice(0, 8) ?? "—"}
              />
            </ReadoutGrid>
          </PanelSection>

          <PanelSection>
            <p className="mb-3 font-mono text-[10px] tracking-[0.16em] text-text-low uppercase">
              saga steps
            </p>
            <ol className="flex flex-col gap-2">
              {payment.steps.map((s, i) => (
                <li
                  key={`${s.step}-${s.status}-${i}`}
                  className="flex items-center gap-3 font-mono text-[11px]"
                >
                  <span className={STEP_TONE[s.status]}>
                    {STEP_MARK[s.status]}
                  </span>
                  <span className="w-16 text-text-hi">{s.step}</span>
                  <span className={STEP_TONE[s.status]}>{s.status}</span>
                </li>
              ))}
            </ol>
            {canRefund && (
              <button
                type="button"
                onClick={refund}
                disabled={busy}
                className="mt-4 border border-action px-3 py-1.5 font-mono text-[11px] tracking-[0.16em] text-action uppercase transition-colors hover:bg-action-dim disabled:opacity-50"
              >
                refund
              </button>
            )}
          </PanelSection>
        </>
      )}

      {error && (
        <PanelSection>
          <p className="font-mono text-[11px] text-down">{error}</p>
        </PanelSection>
      )}

      <PanelSection className="flex flex-col gap-3">
        <WireTrace
          method="POST"
          path="/api/payments/checkout"
          pattern="payment.merchant.checkout"
          tookMs={null}
          failed={Boolean(error)}
        />
        <CopyCurl
          command={curlFor("/payments/checkout", {
            method: "POST",
            body: {
              amountCents: AMOUNT_CENTS,
              instrument,
              idempotencyKey: "demo-key",
            },
          })}
        />
        <SourceLink
          href={`${REPO_BASE}/apps/payment/src/payment.service.ts`}
          label="payment.service.ts"
        />
      </PanelSection>
    </Panel>
  );
}
