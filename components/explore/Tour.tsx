"use client";

import { TOUR_STEPS } from "@/lib/tour";

/**
 * The step card. Docked bottom-centre, above everything including an open demo
 * overlay, so it stays readable on mobile where the overlay is full-width.
 */
export function Tour({
  step,
  onNext,
  onBack,
  onExit,
}: {
  step: number;
  onNext: () => void;
  onBack: () => void;
  onExit: () => void;
}) {
  const current = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;

  return (
    <div className="animate-rise pointer-events-auto fixed inset-x-0 bottom-0 z-30 flex justify-center p-4">
      <div className="w-full max-w-md border border-line-bright bg-void/95 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <span className="font-mono text-[10px] tracking-[0.16em] text-nominal uppercase">
            step {step + 1} / {TOUR_STEPS.length}
          </span>
          <button
            type="button"
            onClick={onExit}
            className="font-mono text-[10px] tracking-[0.16em] text-text-low uppercase transition-colors hover:text-text-hi"
          >
            skip
          </button>
        </div>

        <div className="px-4 py-3">
          <h3 className="display-wide text-lg text-text-hi">{current.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-text-mid">
            {current.body}
          </p>
        </div>

        {/* Progress rail — a filled tick per completed step. */}
        <div className="flex gap-1 px-4">
          {TOUR_STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`h-0.5 flex-1 ${i <= step ? "bg-nominal" : "bg-line"}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 p-4">
          <button
            type="button"
            onClick={onBack}
            disabled={step === 0}
            className="border border-line px-3 py-1.5 font-mono text-[11px] tracking-[0.16em] text-text-mid uppercase transition-colors hover:border-line-bright hover:text-text-hi disabled:opacity-40"
          >
            back
          </button>
          <button
            type="button"
            onClick={last ? onExit : onNext}
            className="border border-nominal px-4 py-1.5 font-mono text-[11px] tracking-[0.16em] text-nominal uppercase transition-colors hover:bg-nominal-dim"
          >
            {last ? "done" : "next ▸"}
          </button>
        </div>
      </div>
    </div>
  );
}
