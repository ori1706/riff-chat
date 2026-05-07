import { AnimatePresence, motion } from "framer-motion";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import clsx from "clsx";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject, type Dispatch, type SetStateAction } from "react";
import type { Socket } from "socket.io-client";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { MarkdownBody } from "../components/MarkdownBody";
import { daySeparatorLabel } from "../lib/dayLabel";
import {
  deleteMessage,
  fetchChannelMessages,
  fetchChannels,
  fetchConversations,
  fetchDmMessages,
  fetchUsers,
  openDm,
  patchMessage,
  postMessage,
  searchMessages,
  toggleReaction,
  uploadFile,
} from "../lib/api";
import { createSocket } from "../lib/socket";
import type { Channel, ChatMessage, ConversationSummary, SearchHit, User } from "../types";

type View =
  | { kind: "channel"; channel: Channel }
  | { kind: "dm"; conversation: ConversationSummary; peer: User };

type Row = { t: "day"; id: string; label: string } | { t: "msg"; id: string; m: ChatMessage };

function buildRows(messages: ChatMessage[]): Row[] {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const out: Row[] = [];
  let last = "";
  for (const m of sorted) {
    if (m.deletedAt) continue;
    const day = new Date(m.createdAt).toDateString();
    if (day !== last) {
      last = day;
      out.push({ t: "day", id: `day-${day}`, label: daySeparatorLabel(m.createdAt) });
    }
    out.push({ t: "msg", id: m.id, m });
  }
  return out;
}

const REACTIONS = ["👍", "❤️", "😂", "🎉", "🔥"];

export function Workspace({
  token,
  user,
  onLogout,
}: {
  token: string;
  user: User;
  onLogout: () => void;
}) {
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [view, setView] = useState<View | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadOpen, setThreadOpen] = useState<ChatMessage | null>(null);
  const [threadMessages, setThreadMessages] = useState<ChatMessage[]>([]);

  const [composer, setComposer] = useState("");
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherQ, setSwitcherQ] = useState("");

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[] | null>(null);

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQ, setMentionQ] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);

  const [presence, setPresence] = useState<Record<string, boolean>>({});
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [typing, setTyping] = useState<Record<string, string[]>>({});

  const [pendingUploads, setPendingUploads] = useState<string[]>([]);

  const [atBottom, setAtBottom] = useState(true);
  const [newWhileScrolled, setNewWhileScrolled] = useState(0);
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const activeChannelIdRef = useRef<string | null>(null);
  const activeDmIdRef = useRef<string | null>(null);

  const rows = useMemo(() => buildRows(messages), [messages]);

  const contextKey = view?.kind === "channel" ? `c:${view.channel.id}` : view ? `d:${view.conversation.id}` : "";

  const viewChannelId = view?.kind === "channel" ? view.channel.id : null;
  const viewDmId = view?.kind === "dm" ? view.conversation.id : null;

  const viewRef = useRef(view);
  const atBottomRef = useRef(atBottom);
  const meRef = useRef(user);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    atBottomRef.current = atBottom;
  }, [atBottom]);
  useEffect(() => {
    meRef.current = user;
  }, [user]);

  const loadLists = useCallback(async () => {
    const [ch, conv, us] = await Promise.all([fetchChannels(), fetchConversations(), fetchUsers()]);
    setChannels(ch);
    setConversations(conv);
    setUsers(us);
    const general = ch.find((c) => c.slug === "general") ?? ch[0];
    if (general) setView({ kind: "channel", channel: general });
  }, []);

  useEffect(() => {
    void loadLists().catch(console.error);
  }, [loadLists]);

  function pushMessage(msg: ChatMessage) {
    if (msg.parentId) return;
    const v = viewRef.current;
    if (!v) return;
    const matches =
      v.kind === "channel" ? msg.channelId === v.channel.id : msg.conversationId === v.conversation.id;
    if (!matches) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      if (!atBottomRef.current) setNewWhileScrolled((n) => n + 1);
      return [...prev, msg];
    });
  }

  useEffect(() => {
    const s = createSocket(token);
    socketRef.current = s;
    s.on("presence:snapshot", (snap: Record<string, boolean>) => {
      setPresence(snap);
    });
    s.on(
      "typing:update",
      (payload: { userId: string; state: "start" | "stop"; channelId?: string | null; conversationId?: string | null }) => {
        const key = payload.channelId ? `c:${payload.channelId}` : payload.conversationId ? `d:${payload.conversationId}` : "";
        if (!key) return;
        setTyping((prev) => {
          const cur = new Set(prev[key] ?? []);
          if (payload.state === "start") cur.add(payload.userId);
          else cur.delete(payload.userId);
          return { ...prev, [key]: [...cur] };
        });
        if (typingTimers.current[payload.userId]) clearTimeout(typingTimers.current[payload.userId]);
        if (payload.state === "start") {
          typingTimers.current[payload.userId] = setTimeout(() => {
            setTyping((prev) => {
              const cur = new Set(prev[key] ?? []);
              cur.delete(payload.userId);
              return { ...prev, [key]: [...cur] };
            });
          }, 3000);
        }
      }
    );
    s.on("message:new", (msg: ChatMessage) => {
      pushMessage(msg);
    });
    s.on("message:updated", (msg: ChatMessage) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...msg, ...(m.userId === meRef.current.id ? { localStatus: "sent" as const } : {}) } : m
        )
      );
      setThreadMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
    });
    s.on("message:deleted", ({ id }: { id: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setThreadMessages((prev) => prev.filter((m) => m.id !== id));
      setThreadOpen((p) => (p?.id === id ? null : p));
    });
    s.on("thread:reply", ({ parentId }: { parentId: string }) => {
      setMessages((prev) => prev.map((m) => (m.id === parentId ? { ...m, replyCount: m.replyCount + 1 } : m)));
    });
    return () => {
      s.removeAllListeners();
      s.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    if (!view) return;
    let cancelled = false;
    (async () => {
      setLoadingThread(true);
      setMessages([]);
      setThreadOpen(null);
      setThreadMessages([]);
      setNewWhileScrolled(0);
      try {
        if (view.kind === "channel") {
          const { messages: ms } = await fetchChannelMessages(view.channel.id);
          if (!cancelled) {
            setMessages(ms);
            requestAnimationFrame(() => virtuosoRef.current?.scrollToIndex({ index: "LAST", align: "end" }));
          }
        } else {
          const { messages: ms } = await fetchDmMessages(view.conversation.id);
          if (!cancelled) {
            setMessages(ms);
            requestAnimationFrame(() => virtuosoRef.current?.scrollToIndex({ index: "LAST", align: "end" }));
          }
        }
      } finally {
        if (!cancelled) setLoadingThread(false);
      }
    })().catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [viewChannelId, viewDmId]);

  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;
    const prevCh = activeChannelIdRef.current;
    const prevDm = activeDmIdRef.current;
    if (prevCh) s.emit("leave:channel", prevCh);
    if (prevDm) s.emit("leave:dm", prevDm);
    activeChannelIdRef.current = null;
    activeDmIdRef.current = null;
    if (view?.kind === "channel") {
      s.emit("join:channel", view.channel.id);
      activeChannelIdRef.current = view.channel.id;
    } else if (view?.kind === "dm") {
      s.emit("join:dm", view.conversation.id);
      activeDmIdRef.current = view.conversation.id;
    }
    return () => {
      if (view?.kind === "channel") s.emit("leave:channel", view.channel.id);
      if (view?.kind === "dm") s.emit("leave:dm", view.conversation.id);
    };
  }, [view]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSwitcherOpen((o) => !o);
        setSwitcherQ("");
      }
      if (e.key === "Escape") {
        setSwitcherOpen(false);
        setSearchOpen(false);
        setPickerOpen(false);
        setThreadOpen(null);
        setLightbox(null);
        setMentionOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function openThread(parent: ChatMessage) {
    setThreadOpen(parent);
    if (!view) return;
    try {
      if (view.kind === "channel") {
        const { messages: ms } = await fetchChannelMessages(view.channel.id, {
          parentId: parent.id,
        });
        setThreadMessages(ms);
      } else {
        const { messages: ms } = await fetchDmMessages(view.conversation.id, {
          parentId: parent.id,
        });
        setThreadMessages(ms);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function emitTypingStart() {
    const s = socketRef.current;
    if (!s || !view) return;
    if (view.kind === "channel") s.emit("typing:start", { channelId: view.channel.id });
    else s.emit("typing:start", { conversationId: view.conversation.id });
  }
  function emitTypingStop() {
    const s = socketRef.current;
    if (!s || !view) return;
    if (view.kind === "channel") s.emit("typing:stop", { channelId: view.channel.id });
    else s.emit("typing:stop", { conversationId: view.conversation.id });
  }

  function handleComposerChange(v: string) {
    setComposer(v);
    emitTypingStart();
    const pos = composerRef.current?.selectionStart ?? v.length;
    const before = v.slice(0, pos);
    const m = /@([\w.-]*)$/.exec(before);
    if (m) {
      setMentionOpen(true);
      setMentionQ(m[1] ?? "");
      setMentionStart(pos - (m[1].length + 1));
    } else {
      setMentionOpen(false);
      setMentionStart(null);
    }
  }

  function insertMention(u: User) {
    if (mentionStart == null) return;
    const pos = composerRef.current?.selectionStart ?? composer.length;
    const start = mentionStart;
    const next = `${composer.slice(0, start)}@${u.name}${composer.slice(pos)}`;
    setComposer(next);
    setMentionOpen(false);
    setMentionStart(null);
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  async function sendMessage(body: string, attachmentIds?: string[]) {
    if (!view) return;
    const trimmed = body.trim();
    if (!trimmed && (!attachmentIds || attachmentIds.length === 0)) return;

    const tempId = crypto.randomUUID();
    const optimistic: ChatMessage = {
      id: tempId,
      tempId,
      channelId: view.kind === "channel" ? view.channel.id : null,
      conversationId: view.kind === "dm" ? view.conversation.id : null,
      userId: user.id,
      user,
      body: trimmed,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
      parentId: null,
      replyCount: 0,
      reactions: [],
      attachments: [],
      localStatus: "sending",
    };
    setMessages((prev) => [...prev, optimistic]);
    emitTypingStop();
    requestAnimationFrame(() => virtuosoRef.current?.scrollToIndex({ index: "LAST", align: "end" }));

    try {
      const payload =
        view.kind === "channel"
          ? await postMessage({
              body: trimmed,
              channelId: view.channel.id,
              attachmentIds,
            })
          : await postMessage({
              body: trimmed,
              conversationId: view.conversation.id,
              attachmentIds,
            });
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...payload, localStatus: "sent" } : m)));
    } catch (e) {
      console.error(e);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, localStatus: "failed" } : m)));
    }
  }

  async function sendThreadReply(body: string) {
    if (!threadOpen || !view) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    try {
      const payload =
        view.kind === "channel"
          ? await postMessage({
              body: trimmed,
              channelId: view.channel.id,
              parentId: threadOpen.id,
            })
          : await postMessage({
              body: trimmed,
              conversationId: view.conversation.id,
              parentId: threadOpen.id,
            });
      setThreadMessages((prev) => [...prev, payload]);
      setMessages((prev) =>
        prev.map((m) => (m.id === threadOpen.id ? { ...m, replyCount: m.replyCount + 1 } : m))
      );
    } catch (e) {
      console.error(e);
    }
  }

  const typingNames = (typing[contextKey] ?? [])
    .filter((id) => id !== user.id)
    .map((id) => users.find((u) => u.id === id)?.name)
    .filter(Boolean) as string[];

  const portalEl = typeof document !== "undefined" ? document.getElementById("portal-root") : null;

  const filteredMentions = useMemo(() => {
    const q = mentionQ.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 6);
  }, [mentionQ, users]);

  const switcherItems = useMemo(() => {
    const q = switcherQ.toLowerCase();
    const ch = (channels ?? []).filter((c) => `${c.name} ${c.slug}`.toLowerCase().includes(q));
    const dm = conversations.filter((c) => c.title.toLowerCase().includes(q));
    return { ch, dm };
  }, [channels, conversations, switcherQ]);

  async function runSearch() {
    if (searchQ.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const { results } = await searchMessages(searchQ.trim());
    setSearchResults(results);
  }

  const headerTitle =
    view?.kind === "channel" ? `#${view.channel.name}` : view ? `DM · ${view.peer.name}` : "…";
  const headerSub =
    view?.kind === "channel"
      ? view.channel.topic || `${view.channel.memberCount} members`
      : view
        ? "Direct message"
        : "Pick a channel";

  return (
    <div id="app-shell" className="relative flex h-full min-h-0 w-full bg-slackord-midnight text-slackord-text">
      <aside className="flex w-[280px] shrink-0 flex-col border-r border-slackord-border bg-slackord-slate/80 backdrop-blur">
        <div className="flex items-center gap-3 border-b border-white/5 px-4 py-4">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-slackord-teal to-indigo-500 text-sm font-black text-slackord-void">
            R
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">Slackord</div>
            <div className="truncate text-[11px] text-slackord-muted">Realtime workspace demo</div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slackord-muted">Channels</div>
          <div className="space-y-1">
            {(channels ?? []).map((c) => {
              const active = view?.kind === "channel" && view.channel.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setView({ kind: "channel", channel: c })}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition",
                    active ? "bg-white/10 text-white" : "text-slackord-muted hover:bg-white/5 hover:text-white"
                  )}
                >
                  <span className="text-slackord-muted">#</span>
                  <span className="truncate font-medium">{c.name}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slackord-muted">
            Direct messages
          </div>
          <div className="space-y-1">
            {users
              .filter((u) => u.id !== user.id)
              .map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={async () => {
                    const conv = await openDm(u.id);
                    setConversations(await fetchConversations());
                    setView({
                      kind: "dm",
                      conversation: {
                        id: conv.id,
                        title: u.name,
                        peer: conv.peer,
                        lastPreview: null,
                      },
                      peer: conv.peer,
                    });
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slackord-muted transition hover:bg-white/5 hover:text-white"
                >
                  <Avatar user={u} presence={presence} />
                  <span className="truncate">{u.name}</span>
                </button>
              ))}
          </div>
        </div>

        <div className="mt-auto border-t border-white/5 p-3">
          <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2">
            <Avatar user={user} presence={presence} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{user.name}</div>
              <div className="truncate text-[11px] text-slackord-muted">{user.role}</div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-slackord-muted hover:text-white"
            >
              Leave
            </button>
          </div>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-white/5 bg-slackord-panel/40 px-6 py-4 backdrop-blur">
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold text-white">{headerTitle}</div>
            <div className="truncate text-xs text-slackord-muted">{headerSub}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSearchOpen(true);
                setSearchQ("");
                setSearchResults(null);
              }}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slackord-muted hover:text-white"
            >
              Search
            </button>
            <div className="hidden items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slackord-muted sm:flex">
              <span className="rounded border border-white/10 bg-black/30 px-1">⌘</span>
              <span className="rounded border border-white/10 bg-black/30 px-1">K</span>
            </div>
          </div>
        </header>

        {typingNames.length ? (
          <div className="border-b border-white/5 px-6 py-2 text-xs text-slackord-muted">
            {typingNames.slice(0, 3).join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
          </div>
        ) : null}

        <div className="relative min-h-0 flex-1">
          {loadingThread ? (
            <div className="absolute inset-0 z-10 grid place-items-center bg-slackord-midnight/40 backdrop-blur-sm">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-slackord-teal" />
            </div>
          ) : null}

          <Virtuoso
            ref={virtuosoRef}
            className="h-full"
            totalCount={rows.length}
            atBottomStateChange={(b) => {
              setAtBottom(b);
              if (b) setNewWhileScrolled(0);
            }}
            followOutput="auto"
            itemContent={(index) => {
              const row = rows[index]!;
              if (row.t === "day") {
                return (
                  <div className="flex justify-center py-3">
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slackord-muted">
                      {row.label}
                    </div>
                  </div>
                );
              }
              return (
                <MessageRow
                  message={row.m}
                  users={users}
                  me={user}
                  presence={presence}
                  onReact={async (emoji) => {
                    const updated = await toggleReaction(row.m.id, emoji);
                    setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
                  }}
                  onOpenThread={() => void openThread(row.m)}
                  onEdit={async (body) => {
                    const updated = await patchMessage(row.m.id, body);
                    setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
                  }}
                  onDelete={async () => {
                    await deleteMessage(row.m.id);
                  }}
                  onImage={(u) => setLightbox(u)}
                />
              );
            }}
          />

          {!atBottom && newWhileScrolled > 0 ? (
            <button
              type="button"
              className="absolute bottom-20 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-slackord-panel px-4 py-2 text-xs font-semibold text-white shadow-lg"
              onClick={() => {
                virtuosoRef.current?.scrollToIndex({ index: "LAST", align: "end" });
                setNewWhileScrolled(0);
              }}
            >
              ↓ {newWhileScrolled} new messages
            </button>
          ) : null}
        </div>

        <Composer
          value={composer}
          onChange={handleComposerChange}
          textareaRef={composerRef}
          onSend={() => {
            void sendMessage(composer, pendingUploads.length ? pendingUploads : undefined);
            setComposer("");
            setPendingUploads([]);
            emitTypingStop();
          }}
          disabled={!view}
          setPickerOpen={setPickerOpen}
          onUpload={async (file) => {
            const up = await uploadFile(file);
            setPendingUploads((p) => [...p, up.id]);
          }}
        />

        {mentionOpen && filteredMentions.length ? (
          <div className="absolute bottom-24 left-6 z-30 w-64 overflow-hidden rounded-2xl border border-white/10 bg-slackord-panel shadow-xl">
            {filteredMentions.map((u) => (
              <button
                key={u.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
                onClick={() => insertMention(u)}
              >
                <Avatar user={u} presence={presence} size="sm" />
                <span className="truncate">{u.name}</span>
              </button>
            ))}
          </div>
        ) : null}
      </main>

      <AnimatePresence>
        {threadOpen ? (
          <motion.aside
            key="thread"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="flex w-[380px] shrink-0 flex-col border-l border-slackord-border bg-slackord-panel/70 backdrop-blur"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <div className="text-sm font-semibold text-white">Thread</div>
              <button
                type="button"
                className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-slackord-muted hover:text-white"
                onClick={() => setThreadOpen(null)}
              >
                Close
              </button>
            </div>
            <div className="max-h-[35vh] overflow-y-auto border-b border-white/5 px-4 py-3 text-sm">
              <div className="mb-2 text-xs font-semibold text-slackord-muted">Original</div>
              <div className="text-sm text-white/90">{threadOpen.body}</div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {threadMessages.map((m) => (
                <MessageRow
                  key={m.id}
                  message={m}
                  users={users}
                  me={user}
                  presence={presence}
                  compact
                  onReact={async (emoji) => {
                    const updated = await toggleReaction(m.id, emoji);
                    setThreadMessages((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                  }}
                  onOpenThread={() => {}}
                  onEdit={async () => {}}
                  onDelete={async () => {}}
                  onImage={setLightbox}
                />
              ))}
            </div>
            <ThreadComposer onSend={(t) => void sendThreadReply(t)} />
          </motion.aside>
        ) : null}
      </AnimatePresence>

      {switcherOpen ? (
        <div className="absolute inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-24">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slackord-panel p-3 shadow-2xl">
            <input
              autoFocus
              value={switcherQ}
              onChange={(e) => setSwitcherQ(e.target.value)}
              placeholder="Jump to channel or DM…"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-slackord-teal/40"
            />
            <div className="mt-2 max-h-72 overflow-y-auto text-sm">
              {switcherItems.ch.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-white/5"
                  onClick={() => {
                    setView({ kind: "channel", channel: c });
                    setSwitcherOpen(false);
                  }}
                >
                  <span className="text-slackord-muted">#</span>
                  <span>{c.name}</span>
                </button>
              ))}
              {switcherItems.dm.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-white/5"
                  onClick={async () => {
                    const peer = d.peer;
                    if (!peer) return;
                    const conv = await openDm(peer.id);
                    setView({
                      kind: "dm",
                      conversation: {
                        id: conv.id,
                        title: peer.name,
                        peer: conv.peer,
                        lastPreview: d.lastPreview,
                      },
                      peer: conv.peer,
                    });
                    setSwitcherOpen(false);
                  }}
                >
                  <span className="text-slackord-muted">@</span>
                  <span>{d.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {searchOpen ? (
        <div className="absolute inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-20">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slackord-panel p-4 shadow-2xl">
            <div className="flex gap-2">
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch();
                }}
                placeholder="Search messages (min 2 chars)…"
                className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-slackord-teal/40"
              />
              <button
                type="button"
                className="rounded-xl bg-slackord-teal px-4 py-2 text-sm font-semibold text-slackord-void"
                onClick={() => void runSearch()}
              >
                Go
              </button>
            </div>
            <div className="mt-3 max-h-80 overflow-y-auto text-sm">
              {(searchResults ?? []).map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  className="mb-2 w-full rounded-xl border border-white/5 bg-white/5 p-3 text-left hover:border-white/10"
                  onClick={() => {
                    if (hit.channelId) {
                      const ch = (channels ?? []).find((c) => c.id === hit.channelId);
                      if (ch) setView({ kind: "channel", channel: ch });
                    } else if (hit.conversationId) {
                      const d = conversations.find((c) => c.id === hit.conversationId);
                      if (d?.peer) {
                        setView({ kind: "dm", conversation: d, peer: d.peer });
                      }
                    }
                    setSearchOpen(false);
                  }}
                >
                  <div className="text-xs text-slackord-muted">{hit.channelName ? `#${hit.channelName}` : "DM"}</div>
                  <div className="mt-1 line-clamp-2 text-white/90">{hit.body}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {lightbox && portalEl
        ? createPortal(
            <button
              type="button"
              className="fixed inset-0 z-[200] grid place-items-center bg-black/80 p-6"
              onClick={() => setLightbox(null)}
            >
              <img src={lightbox} alt="" className="max-h-[85%] max-w-full rounded-2xl border border-white/10" />
            </button>,
            portalEl
          )
        : null}

      {pickerOpen && portalEl
        ? createPortal(
            <div className="fixed bottom-24 right-8 z-[150]">
              <Picker
                data={data}
                theme="dark"
                onEmojiSelect={(e: { native: string }) => {
                  setComposer((c) => `${c}${e.native}`);
                  setPickerOpen(false);
                }}
              />
            </div>,
            portalEl
          )
        : null}

      <div id="portal-root" />
    </div>
  );
}

function Avatar({
  user,
  presence,
  size = "md",
}: {
  user: User;
  presence: Record<string, boolean>;
  size?: "sm" | "md";
}) {
  const online = presence[user.id];
  const dim = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  return (
    <span className="relative inline-block" title={`${user.name} · ${user.role}`}>
      <img src={user.avatarUrl} alt="" className={clsx(dim, "rounded-xl border border-white/10 bg-black/20")} />
      <span
        className={clsx(
          "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slackord-panel",
          online ? "bg-emerald-400" : user.status === "AWAY" ? "bg-slackord-amber" : "bg-slackord-muted"
        )}
      />
    </span>
  );
}

function MessageRow({
  message: m,
  users,
  me,
  presence,
  compact,
  onReact,
  onOpenThread,
  onEdit,
  onDelete,
  onImage,
}: {
  message: ChatMessage;
  users: User[];
  me: User;
  presence: Record<string, boolean>;
  compact?: boolean;
  onReact: (emoji: string) => void;
  onOpenThread: () => void;
  onEdit: (body: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onImage: (url: string) => void;
}) {
  const mine = m.userId === me.id;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.body);
  const canEdit = mine && Date.now() - new Date(m.createdAt).getTime() < 15 * 60 * 1000;

  return (
    <div className={clsx("px-6 py-2", compact && "px-3")}>
      <div className="flex gap-3">
        <Avatar user={m.user} presence={presence} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold text-white">{m.user.name}</span>
            <span className="text-[11px] text-slackord-muted">
              {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {m.editedAt ? <span className="text-[11px] text-slackord-muted">(edited)</span> : null}
            {m.localStatus === "sending" ? <span className="text-[11px] text-slackord-amber">Sending…</span> : null}
            {m.localStatus === "sent" ? <span className="text-[11px] text-emerald-300">✓</span> : null}
          </div>

          {editing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="min-h-[80px] w-full rounded-xl border border-white/10 bg-black/30 p-2 text-sm outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-slackord-teal px-3 py-1 text-xs font-semibold text-slackord-void"
                  onClick={() => {
                    void onEdit(draft).then(() => setEditing(false));
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/10 px-3 py-1 text-xs"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-1 text-sm">
              {m.body ? <MarkdownBody text={m.body} users={users} /> : null}
              {m.attachments.map((a) =>
                a.kind === "image" ? (
                  <button key={a.id} type="button" onClick={() => onImage(a.url)} className="mt-2 block">
                    <img src={a.url} alt="" className="max-h-72 max-w-full rounded-xl border border-white/10" />
                  </button>
                ) : null
              )}
            </div>
          )}

          {!editing ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {REACTIONS.map((emoji) => {
                const agg = m.reactions.find((r) => r.emoji === emoji);
                const active = agg?.userIds.includes(me.id);
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => void onReact(emoji)}
                    className={clsx(
                      "rounded-full border px-2 py-0.5 text-[12px]",
                      active ? "border-slackord-teal/50 bg-slackord-teal/10" : "border-white/10 bg-white/5"
                    )}
                  >
                    {emoji} {agg?.count ?? 0}
                  </button>
                );
              })}
              {!m.parentId ? (
                <button type="button" className="text-[11px] text-slackord-muted hover:text-white" onClick={onOpenThread}>
                  Thread{m.replyCount ? ` · ${m.replyCount}` : ""}
                </button>
              ) : null}
              {mine ? (
                <>
                  {canEdit ? (
                    <button
                      type="button"
                      className="text-[11px] text-slackord-muted hover:text-white"
                      onClick={() => setEditing(true)}
                    >
                      Edit
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="text-[11px] text-red-300/80 hover:text-red-200"
                    onClick={() => void onDelete()}
                  >
                    Delete
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Composer({
  value,
  onChange,
  onSend,
  disabled,
  textareaRef,
  setPickerOpen,
  onUpload,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  setPickerOpen: Dispatch<SetStateAction<boolean>>;
  onUpload: (f: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="border-t border-white/5 bg-slackord-panel/45 p-4 backdrop-blur">
      <div className="flex items-end gap-2">
        <button
          type="button"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
          onClick={() => setPickerOpen((o) => !o)}
        >
          😊
        </button>
        <button
          type="button"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
          onClick={() => fileRef.current?.click()}
        >
          📎
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onUpload(f);
            e.target.value = "";
          }}
        />
        <textarea
          ref={textareaRef}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={disabled ? "" : "Message… (Enter to send, Shift+Enter newline)"}
          rows={3}
          className="min-h-[84px] flex-1 resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-slackord-teal/40"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={onSend}
          className="rounded-2xl bg-slackord-teal px-4 py-3 text-sm font-semibold text-slackord-void disabled:opacity-40"
        >
          Send
        </button>
      </div>
      <div className="mt-2 text-[11px] text-slackord-muted">Markdown supported · @mentions highlight for teammates</div>
    </div>
  );
}

function ThreadComposer({ onSend }: { onSend: (t: string) => void }) {
  const [t, setT] = useState("");
  return (
    <div className="border-t border-white/5 p-3">
      <textarea
        value={t}
        onChange={(e) => setT(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend(t);
            setT("");
          }
        }}
        rows={3}
        className="w-full resize-none rounded-xl border border-white/10 bg-black/30 p-2 text-sm outline-none"
        placeholder="Reply in thread…"
      />
    </div>
  );
}
