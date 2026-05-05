import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { demoLogin, fetchDemoUsers } from "../lib/api";
import type { User } from "../types";

export function Splash({ onSignedIn }: { onSignedIn: (token: string, user: User) => void }) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchDemoUsers()
      .then(setUsers)
      .catch((e) => setErr(String(e.message ?? e)));
  }, []);

  async function pick(userId: string) {
    setLoadingId(userId);
    setErr(null);
    try {
      const { token, user } = await demoLogin(userId);
      onSignedIn(token, user);
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(63,224,197,0.2),transparent),radial-gradient(900px_500px_at_100%_20%,rgba(106,123,255,0.18),transparent)] px-4 py-10">
      <div className="relative z-10 w-full max-w-5xl rounded-[28px] border border-white/10 bg-riff-panel/75 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-riff-muted">
              <span className="h-2 w-2 animate-pulse rounded-full bg-riff-teal" />
              Portfolio demo workspace
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">Welcome to Riff</h1>
            <p className="mt-2 max-w-60 text-sm text-riff-muted">
              Realtime channels, DMs, presence, typing, threads, reactions — optimized for iframe embeds. Pick a
              demo identity to enter (JWT in localStorage, iframe-friendly).
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-riff-muted">
            <div className="font-semibold text-white">Keyboard</div>
            <div className="mt-1 space-y-1">
              <div>
                <kbd className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5">⌘</kbd>{" "}
                <kbd className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5">K</kbd> quick switcher
              </div>
              <div>
                <kbd className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5">Esc</kbd> close panels
              </div>
            </div>
          </div>
        </div>

        {err ? (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        {users == null ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-2xl border border-white/5 bg-white/5"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {users.map((u, idx) => (
              <motion.button
                key={u.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={() => void pick(u.id)}
                disabled={loadingId != null}
                className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-riff-teal/40 hover:bg-white/10 disabled:opacity-60"
              >
                <img
                  src={u.avatarUrl}
                  alt=""
                  className="h-14 w-14 rounded-2xl border border-white/10 bg-black/20"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-white">{u.name}</div>
                  <div className="truncate text-xs text-riff-muted">{u.role}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-riff-muted">{u.bio}</div>
                </div>
                <div className="text-xs font-medium text-riff-teal opacity-0 transition group-hover:opacity-100">
                  Enter →
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
