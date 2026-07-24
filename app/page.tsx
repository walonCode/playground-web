import { Explorer } from "@/components/explore/Explorer";
import { TrafficProvider } from "@/components/hero/TrafficContext";
import { Architecture } from "@/components/journey/Architecture";
import { Journey } from "@/components/journey/Journey";

export default function Home() {
  return (
    // The provider wraps everything so a demo's request can light the mesh edges.
    <TrafficProvider>
      <Explorer />

      <main className="mx-auto max-w-3xl px-5 pb-24 sm:px-8">
        <section className="py-12">
          <p className="font-mono text-[11px] tracking-[0.2em] text-text-low uppercase">
            how it ships
          </p>
          <p className="mt-4 max-w-xl leading-relaxed text-text-mid">
            What a deploy of this repo actually does, replayed from a real run.
            The timings are wall-clock, not decoration.
          </p>
        </section>

        <Journey />

        <div className="mt-12">
          <Architecture />
        </div>
      </main>
    </TrafficProvider>
  );
}
