import type { Metadata } from "next";
import { Panel, PanelSection } from "@/components/panel/Panel";
import { Readout, ReadoutGrid } from "@/components/panel/Readout";
import { type Status, StatusDot } from "@/components/panel/StatusDot";
import { contrast, grade } from "@/lib/contrast";

export const metadata: Metadata = {
  title: "Design lab · Glass Box",
  description: "Tokens, type scale and panel chrome, rendered.",
};

const VOID = "#08090b";

/**
 * `surface` tokens are backgrounds and rules. Grading them against a text
 * contrast standard would report four permanent failures that mean nothing —
 * a lab that cries wolf gets ignored, so it reports what each token is for.
 */
const NEUTRALS = [
  { name: "void", hex: "#08090b", role: "page base", surface: true },
  { name: "panel", hex: "#0f1114", role: "raised surface", surface: true },
  { name: "line", hex: "#1e2227", role: "hairline rules", surface: true },
  {
    name: "line-bright",
    hex: "#2c323a",
    role: "hover, active rule",
    surface: true,
  },
  { name: "text-hi", hex: "#e8eaed", role: "primary text, values" },
  { name: "text-mid", hex: "#9ba1a9", role: "body, panel labels" },
  { name: "text-low", hex: "#79808a", role: "captions, pending" },
];

const HUES = [
  { name: "nominal", hex: "#34d8e8", role: "up · ready · live value · graph" },
  { name: "degraded", hex: "#f5a524", role: "degraded · waking · pending" },
  { name: "down", hex: "#ff4d4d", role: "down · failed · dead-lettered" },
  { name: "action", hex: "#f42bb0", role: "your action — never a status" },
];

const STATUSES: { status: Status; label?: string }[] = [
  { status: "nominal" },
  { status: "degraded" },
  { status: "down" },
  { status: "unknown" },
  { status: "degraded", label: "waking" },
  { status: "degraded", label: "compensating" },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] tracking-[0.2em] text-text-low uppercase">
      {children}
    </p>
  );
}

function Section({
  index,
  title,
  note,
  children,
}: {
  index: string;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line py-12">
      <div className="mb-8 flex flex-col gap-2">
        <Eyebrow>{index}</Eyebrow>
        <h2 className="display-wide text-2xl text-text-hi">{title}</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-text-mid">
          {note}
        </p>
      </div>
      {children}
    </section>
  );
}

function Swatch({
  name,
  hex,
  role,
  surface = false,
}: {
  name: string;
  hex: string;
  role: string;
  surface?: boolean;
}) {
  const ratio = contrast(hex, VOID);
  const verdict = surface ? "surface" : grade(ratio);

  return (
    <div className="flex items-center gap-4 border border-line p-3">
      <div
        className="size-12 shrink-0 border border-line-bright"
        style={{ background: hex }}
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-mono text-xs text-text-hi">{name}</span>
        <span className="tabular font-mono text-[11px] text-text-low uppercase">
          {hex}
        </span>
        <span className="truncate text-[11px] text-text-mid">{role}</span>
      </div>
      <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
        <span
          className={`tabular font-mono text-sm ${
            surface ? "text-text-low" : "text-text-hi"
          }`}
        >
          {ratio.toFixed(2)}
        </span>
        <span
          className={`font-mono text-[10px] tracking-[0.12em] uppercase ${
            verdict === "fail" ? "text-down" : "text-text-low"
          }`}
        >
          {verdict}
        </span>
      </div>
    </div>
  );
}

export default function DesignLab() {
  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 sm:px-8">
      <header className="py-16">
        <Eyebrow>Design lab</Eyebrow>
        <h1 className="display-wide mt-4 text-4xl leading-[0.95] text-text-hi sm:text-6xl">
          One box.
          <br />
          Every layer visible.
        </h1>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-text-mid">
          The locked tokens, rendered rather than described. Contrast ratios
          below are computed from the hex values at render time, so a token that
          drifts out of compliance says so here first.
        </p>
      </header>

      <Section
        index="01 / type"
        title="Three faces, three jobs"
        note="Archivo carries the display voice, set wide and tight in uppercase so it reads as instrument signage. IBM Plex Sans handles body copy. IBM Plex Mono takes every measurement — which, on a site about systems, is most of the page."
      >
        <div className="flex flex-col gap-8">
          <div className="border border-line p-5">
            <Eyebrow>Archivo · display · wdth 112 · -0.02em</Eyebrow>
            <p className="display-wide mt-4 text-5xl text-text-hi">
              Cache hit rate
            </p>
            <p className="display-wide mt-2 text-2xl text-text-mid">
              Consumer lag · Saga state
            </p>
          </div>

          <div className="border border-line p-5">
            <Eyebrow>IBM Plex Sans · body</Eyebrow>
            <p className="mt-4 max-w-2xl leading-relaxed text-text-hi">
              Click evict and run the same query again. The second one is slower
              because it has to reach Postgres instead of Redis.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-mid">
              Secondary copy sits at text-mid. Captions and pending states drop
              to text-low.
            </p>
          </div>

          <div className="border border-line p-5">
            <Eyebrow>IBM Plex Mono · data · tabular</Eyebrow>
            <table className="tabular mt-4 w-full font-mono text-sm">
              <tbody className="text-text-hi">
                {[
                  ["took", "12 ms", "hit rate", "0.847"],
                  ["source", "redis", "keys", "1,204"],
                  ["results", "10", "hits / misses", "423 / 76"],
                ].map(([a, b, c, d]) => (
                  <tr key={a} className="border-b border-line last:border-b-0">
                    <td className="py-2 text-text-low">{a}</td>
                    <td className="py-2 text-right">{b}</td>
                    <td className="py-2 pl-8 text-text-low">{c}</td>
                    <td className="py-2 text-right">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-[11px] text-text-low">
              Digits are tabular so values do not jitter sideways as they
              update.
            </p>
          </div>
        </div>
      </Section>

      <Section
        index="02 / colour"
        title="Four hues, one job each"
        note="Cyan means nominal and live value at once — a number ticking in cyan is the healthy state, so the two never need separate colours. Fuchsia is reserved for what you caused and is never a status. Status contexts never use fuchsia; fuchsia contexts never use status hues."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {HUES.map((c) => (
            <Swatch key={c.name} {...c} />
          ))}
        </div>

        <div className="mt-10 mb-4">
          <Eyebrow>Neutrals</Eyebrow>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {NEUTRALS.map((c) => (
            <Swatch key={c.name} {...c} />
          ))}
        </div>

        <p className="mt-6 max-w-2xl text-[11px] leading-relaxed text-text-low">
          Ratios are against void (#08090b). The accent hues are used for
          headings and large readouts, where AA Large is the applicable bar —
          never for paragraph text.
        </p>
      </Section>

      <Section
        index="03 / status"
        title="The language, learned once"
        note="A square lamp, not a round bullet. The same six states appear in health panels, pipeline stages, task rows and saga steps — identical colour, identical wording, everywhere."
      >
        <div className="flex flex-wrap gap-x-10 gap-y-5 border border-line p-5">
          {STATUSES.map((s) => (
            <StatusDot
              key={`${s.status}-${s.label ?? "default"}`}
              status={s.status}
              label={s.label}
            />
          ))}
        </div>
      </Section>

      <Section
        index="04 / panel"
        title="The chrome every demo inherits"
        note="Header rail, then hairline-separated bands. Zero radius, 1px rules, no shadow, surface the same value as the page. The readout below shows a pending value as an em dash — a reading that has not arrived must never look like one that has."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel label="search · cache" status="nominal">
            <PanelSection>
              <ReadoutGrid>
                <Readout label="took" value="12" unit="ms" tone="nominal" />
                <Readout label="source" value="redis" />
                <Readout label="results" value="10" />
                <Readout label="hit rate" value="0.847" />
                <Readout label="keys" value="1,204" />
                <Readout label="hits / misses" value="423 / 76" />
              </ReadoutGrid>
            </PanelSection>
            <PanelSection>
              <p className="font-mono text-[11px] text-text-low">
                wire{" "}
                <span className="text-text-mid">
                  GET /api/search → search.query → 12ms
                </span>
              </p>
            </PanelSection>
          </Panel>

          <Panel label="search · cache" status="down" statusLabel="down">
            <PanelSection>
              <ReadoutGrid>
                <Readout label="took" value={null} unit="ms" />
                <Readout label="source" value={null} />
                <Readout label="results" value={null} />
                <Readout label="hit rate" value={null} />
                <Readout label="keys" value={null} />
                <Readout label="hits / misses" value={null} />
              </ReadoutGrid>
            </PanelSection>
            <PanelSection>
              <p className="font-mono text-[11px] text-down">
                search did not respond within 5s
              </p>
            </PanelSection>
          </Panel>
        </div>
      </Section>
    </main>
  );
}
