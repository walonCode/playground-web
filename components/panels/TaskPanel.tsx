"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePulse } from "@/components/hero/TrafficContext";
import { CopyCurl, WireTrace } from "@/components/panel/Evidence";
import { Panel, PanelSection } from "@/components/panel/Panel";
import { Readout, ReadoutGrid } from "@/components/panel/Readout";
import type { Status } from "@/components/panel/StatusDot";
import {
  ApiError,
  curlFor,
  type TaskDto,
  type TaskStatsResponse,
  type TaskStatus,
  taskStats,
  todoCreate,
  todoDelete,
  todoList,
  todoRun,
  todoUpdate,
} from "@/lib/api";
import { useSession } from "@/lib/auth/client";

/** Statuses still in motion — while any todo is one of these, keep polling. */
const LIVE: TaskStatus[] = ["queued", "running"];

const STATUS_TONE: Record<TaskStatus, string> = {
  idle: "text-text-low",
  queued: "text-text-mid",
  running: "text-degraded",
  completed: "text-nominal",
  failed: "text-down",
  dead_lettered: "text-down",
  canceled: "text-text-low",
};

/**
 * A todo list whose items are real queue jobs.
 *
 * The list is ordinary CRUD, private to the signed-in account. "Run" is what
 * makes it more than a list: it pushes the todo onto the same BullMQ queue that
 * carries retries and dead-lettering, so the familiar surface and the actual
 * machinery are the same object.
 */
export function TaskPanel() {
  const pulse = usePulse();
  const { data: session } = useSession();
  const [todos, setTodos] = useState<TaskDto[]>([]);
  const [stats, setStats] = useState<TaskStatsResponse | null>(null);
  const [draft, setDraft] = useState("");
  const [failNext, setFailNext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const poll = useRef<number | null>(null);

  const signedIn = Boolean(session?.user);

  const refresh = useCallback(async () => {
    try {
      const [list, s] = await Promise.all([todoList(), taskStats()]);
      setTodos(list.tasks);
      setStats(s);
      return list.tasks;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setTodos([]);
      return [];
    }
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setTodos([]);
      return;
    }
    void refresh();
    return () => {
      if (poll.current) window.clearInterval(poll.current);
    };
  }, [signedIn, refresh]);

  // While something is queued or running, follow it so the visitor watches the
  // job move on its own rather than having to refresh.
  useEffect(() => {
    const moving = todos.some((t) => LIVE.includes(t.status));
    if (!moving) {
      if (poll.current) window.clearInterval(poll.current);
      poll.current = null;
      return;
    }
    if (poll.current) return;
    poll.current = window.setInterval(() => void refresh(), 800);
  }, [todos, refresh]);

  async function act<T>(fn: () => Promise<T>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    pulse(["gateway→task"]);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "that didn't work");
    } finally {
      setBusy(false);
    }
  }

  function add(e: FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    void act(async () => {
      await todoCreate(title);
      setDraft("");
    });
  }

  const status: Status = error ? "down" : signedIn ? "nominal" : "unknown";

  return (
    <Panel label="todos · queue" status={status}>
      <PanelSection>
        <p className="text-sm leading-relaxed text-text-mid">
          Your todo list — but each item is a real job. Run one and it goes onto
          the same BullMQ queue that handles retries and dead-lettering.
        </p>
      </PanelSection>

      {!signedIn ? (
        <PanelSection>
          <p className="font-mono text-[11px] text-degraded">
            sign in to see your todos — they're private to your account
          </p>
        </PanelSection>
      ) : (
        <>
          <PanelSection>
            <form onSubmit={add} className="flex gap-2">
              <label className="sr-only" htmlFor="todo-input">
                New todo
              </label>
              <input
                id="todo-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="add a todo"
                className="min-w-0 flex-1 border border-line bg-panel px-3 py-2 font-mono text-sm text-text-hi placeholder:text-text-low focus:border-line-bright focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy}
                className="border border-line-bright px-3 py-2 font-mono text-[11px] tracking-[0.16em] text-text-hi uppercase transition-colors hover:bg-panel disabled:opacity-50"
              >
                add
              </button>
            </form>
            <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 font-mono text-[11px] text-text-mid">
              <input
                type="checkbox"
                checked={failNext}
                onChange={(e) => setFailNext(e.target.checked)}
                className="size-3.5 accent-[var(--color-action)]"
              />
              make runs fail (to see retries + dead-letter)
            </label>
          </PanelSection>

          <PanelSection>
            {todos.length === 0 ? (
              <p className="font-mono text-[11px] text-text-low">
                nothing yet — add one above
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {todos.map((todo) => (
                  <li key={todo.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={todo.done}
                        aria-label={`Mark ${todo.title} done`}
                        onChange={(e) =>
                          void act(() =>
                            todoUpdate(todo.id, { done: e.target.checked }),
                          )
                        }
                        className="size-3.5 shrink-0 accent-[var(--color-nominal)]"
                      />
                      <span
                        className={`min-w-0 flex-1 truncate text-sm ${
                          todo.done
                            ? "text-text-low line-through"
                            : "text-text-hi"
                        }`}
                      >
                        {todo.title}
                      </span>
                      <button
                        type="button"
                        disabled={busy || LIVE.includes(todo.status)}
                        onClick={() =>
                          void act(() => todoRun(todo.id, failNext))
                        }
                        className="shrink-0 border border-action px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] text-action uppercase transition-colors hover:bg-action-dim disabled:opacity-40"
                      >
                        run
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`Delete ${todo.title}`}
                        onClick={() => void act(() => todoDelete(todo.id))}
                        className="shrink-0 border border-line px-2 py-0.5 font-mono text-[10px] text-text-low transition-colors hover:border-down hover:text-down disabled:opacity-40"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Only say something about the run once there has been one. */}
                    {todo.status !== "idle" && (
                      <p className="pl-6 font-mono text-[10px]">
                        <span className={STATUS_TONE[todo.status]}>
                          {todo.status}
                        </span>
                        <span className="text-text-low">
                          {" · attempt "}
                          {todo.attempts}/{todo.maxAttempts}
                          {todo.status === "running" && ` · ${todo.progress}%`}
                        </span>
                        {todo.error && (
                          <span className="text-down"> · {todo.error}</span>
                        )}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </PanelSection>
        </>
      )}

      {stats && signedIn && (
        <PanelSection>
          <p className="mb-3 font-mono text-[10px] tracking-[0.16em] text-text-low uppercase">
            queue · live from bullmq
          </p>
          <ReadoutGrid>
            <Readout label="waiting" value={stats.queue.waiting} />
            <Readout
              label="active"
              value={stats.queue.active}
              tone={stats.queue.active > 0 ? "degraded" : "default"}
            />
            <Readout
              label="completed"
              value={stats.queue.completed}
              tone="nominal"
            />
            <Readout
              label="failed"
              value={stats.queue.failed}
              tone={stats.queue.failed > 0 ? "down" : "default"}
            />
            <Readout label="delayed" value={stats.queue.delayed} />
            <Readout
              label="dead-letter"
              value={stats.byStatus.dead_lettered}
              tone={stats.byStatus.dead_lettered > 0 ? "down" : "default"}
            />
          </ReadoutGrid>
        </PanelSection>
      )}

      {error && (
        <PanelSection>
          <p className="font-mono text-[11px] text-down">{error}</p>
        </PanelSection>
      )}

      <PanelSection className="flex flex-col gap-3">
        <WireTrace
          method="POST"
          path="/api/todos/:id/run"
          pattern="task.todo.run"
          tookMs={null}
          failed={Boolean(error)}
        />
        <CopyCurl
          command={curlFor("/todos", {
            method: "POST",
            body: { title: "ship it" },
          })}
        />
      </PanelSection>
    </Panel>
  );
}
