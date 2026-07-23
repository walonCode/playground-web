import { Hero } from "@/components/hero/Hero";
import { TrafficProvider } from "@/components/hero/TrafficContext";
import { Architecture } from "@/components/journey/Architecture";
import { Journey } from "@/components/journey/Journey";
import { SearchCachePanel } from "@/components/panels/SearchCachePanel";

export default function Home() {
  return (
    // The provider wraps both so a panel's request can light the hero's edges.
    <TrafficProvider>
      <Hero />

      <main className="mx-auto max-w-3xl px-5 pb-24 sm:px-8">
        <section className="py-12">
          <p className="font-mono text-[11px] tracking-[0.2em] text-text-low uppercase">
            01 / cache-aside
          </p>
          <p className="mt-4 max-w-xl leading-relaxed text-text-mid">
            Run a search, then drop the cache and run the same one again. The
            second is slower because it has to reach Postgres instead of Redis.
            Every number below is measured — copy the command under the panel
            and check it yourself.
          </p>
        </section>

        <SearchCachePanel />

        <section className="py-12">
          <p className="font-mono text-[11px] tracking-[0.2em] text-text-low uppercase">
            02 / how it ships
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
