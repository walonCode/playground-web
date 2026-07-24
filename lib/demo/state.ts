import { Redis } from "@upstash/redis";
import type { DemoState } from "./config";

export interface StateSnapshot {
  state: DemoState;
  lastActivity: number | null;
  wokenAt: number | null;
  lastHealthAt: number | null;
}

/**
 * The shared source of truth for demo power state.
 *
 * `compareAndSet` is the load-bearing method: two visitors clicking wake in the
 * same second must not both trigger StartInstances. Whoever flips asleep→waking
 * first wins; the loser reads waking and does nothing.
 */
export interface StateStore {
  snapshot(): Promise<StateSnapshot>;
  compareAndSet(from: DemoState, to: DemoState): Promise<boolean>;
  setState(state: DemoState): Promise<void>;
  markWoken(): Promise<void>;
  touchActivity(): Promise<void>;
  markHealthChecked(): Promise<void>;
}

const KEYS = {
  state: "demo:state",
  lastActivity: "demo:last_activity",
  wokenAt: "demo:woken_at",
  lastHealth: "demo:last_health",
};

/**
 * Upstash-backed, for production. Its REST client runs anywhere a serverless
 * function does, which is exactly where this lives.
 */
class UpstashStore implements StateStore {
  constructor(private readonly redis: Redis) {}

  async snapshot(): Promise<StateSnapshot> {
    const [state, lastActivity, wokenAt, lastHealthAt] = await Promise.all([
      this.redis.get<DemoState>(KEYS.state),
      this.redis.get<number>(KEYS.lastActivity),
      this.redis.get<number>(KEYS.wokenAt),
      this.redis.get<number>(KEYS.lastHealth),
    ]);
    return {
      state: state ?? "asleep",
      lastActivity: lastActivity ?? null,
      wokenAt: wokenAt ?? null,
      lastHealthAt: lastHealthAt ?? null,
    };
  }

  // A missing key reads as 'asleep', so the very first wake can claim it.
  private static readonly CAS = `
    local cur = redis.call('GET', KEYS[1])
    if cur == false then cur = 'asleep' end
    if cur == ARGV[1] then
      redis.call('SET', KEYS[1], ARGV[2])
      return 1
    end
    return 0`;

  async compareAndSet(from: DemoState, to: DemoState): Promise<boolean> {
    const result = await this.redis.eval(
      UpstashStore.CAS,
      [KEYS.state],
      [from, to],
    );
    return result === 1;
  }

  async setState(state: DemoState): Promise<void> {
    await this.redis.set(KEYS.state, state);
  }
  async markWoken(): Promise<void> {
    await this.redis.set(KEYS.wokenAt, Date.now());
  }
  async touchActivity(): Promise<void> {
    await this.redis.set(KEYS.lastActivity, Date.now());
  }
  async markHealthChecked(): Promise<void> {
    await this.redis.set(KEYS.lastHealth, Date.now());
  }
}

/**
 * In-memory fallback for local development, where there are no Upstash creds.
 *
 * Held on globalThis so it survives dev hot-reloads. This is single-process
 * only — it must never be used in production, where serverless invocations each
 * get their own memory and the state would be nonsense. The factory enforces
 * that by preferring Upstash whenever its creds are present.
 */
class MemoryStore implements StateStore {
  private get s(): StateSnapshot {
    const g = globalThis as { __demoState?: StateSnapshot };
    g.__demoState ??= {
      state: "asleep",
      lastActivity: null,
      wokenAt: null,
      lastHealthAt: null,
    };
    return g.__demoState;
  }

  snapshot(): Promise<StateSnapshot> {
    return Promise.resolve({ ...this.s });
  }
  compareAndSet(from: DemoState, to: DemoState): Promise<boolean> {
    if (this.s.state !== from) return Promise.resolve(false);
    this.s.state = to;
    return Promise.resolve(true);
  }
  setState(state: DemoState): Promise<void> {
    this.s.state = state;
    return Promise.resolve();
  }
  markWoken(): Promise<void> {
    this.s.wokenAt = Date.now();
    return Promise.resolve();
  }
  touchActivity(): Promise<void> {
    this.s.lastActivity = Date.now();
    return Promise.resolve();
  }
  markHealthChecked(): Promise<void> {
    this.s.lastHealthAt = Date.now();
    return Promise.resolve();
  }
}

let store: StateStore | null = null;

export function getStateStore(): StateStore {
  if (store) return store;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  store =
    url && token
      ? new UpstashStore(new Redis({ url, token }))
      : new MemoryStore();
  return store;
}
