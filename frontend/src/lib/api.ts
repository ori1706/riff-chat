import type { Channel, ChatMessage, ConversationSummary, SearchHit, User } from "../types";
import { API_BASE } from "./apiBase";

function token(): string | null {
  return localStorage.getItem("riff_token");
}

export function setSession(tok: string, user: User) {
  localStorage.setItem("riff_token", tok);
  localStorage.setItem("riff_user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("riff_token");
  localStorage.removeItem("riff_user");
}

export function loadStoredUser(): User | null {
  const raw = localStorage.getItem("riff_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const t = token();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function fetchDemoUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/api/demo/users`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchUsers(): Promise<User[]> {
  return api("/api/users");
}

export async function fetchChannels(): Promise<Channel[]> {
  return api("/api/channels");
}

export async function fetchChannelMessages(
  channelId: string,
  opts?: { before?: string; parentId?: string | null }
): Promise<{ messages: ChatMessage[] }> {
  const q = new URLSearchParams();
  q.set("limit", "100");
  if (opts?.before) q.set("before", opts.before);
  if (opts?.parentId !== undefined) q.set("parentId", opts.parentId ?? "");
  return api(`/api/channels/${channelId}/messages?${q}`);
}

export async function fetchConversations(): Promise<ConversationSummary[]> {
  return api("/api/conversations");
}

export async function openDm(peerUserId: string): Promise<{
  id: string;
  peer: User;
  members: User[];
}> {
  return api("/api/dm/open", { method: "POST", body: JSON.stringify({ peerUserId }) });
}

export async function fetchDmMessages(
  conversationId: string,
  opts?: { before?: string; parentId?: string | null }
): Promise<{ messages: ChatMessage[] }> {
  const q = new URLSearchParams();
  q.set("limit", "100");
  if (opts?.before) q.set("before", opts.before);
  if (opts?.parentId !== undefined) q.set("parentId", opts.parentId ?? "");
  return api(`/api/conversations/${conversationId}/messages?${q}`);
}

export async function postMessage(body: {
  body: string;
  channelId?: string;
  conversationId?: string;
  parentId?: string;
  attachmentIds?: string[];
}): Promise<ChatMessage> {
  return api("/api/messages", { method: "POST", body: JSON.stringify(body) });
}

export async function patchMessage(id: string, body: string): Promise<ChatMessage> {
  return api(`/api/messages/${id}`, { method: "PATCH", body: JSON.stringify({ body }) });
}

export async function deleteMessage(id: string): Promise<void> {
  await api(`/api/messages/${id}`, { method: "DELETE" });
}

export async function toggleReaction(messageId: string, emoji: string): Promise<ChatMessage> {
  return api(`/api/messages/${messageId}/reactions`, {
    method: "POST",
    body: JSON.stringify({ emoji }),
  });
}

export async function searchMessages(q: string): Promise<{ results: SearchHit[] }> {
  return api(`/api/search?q=${encodeURIComponent(q)}`);
}

export async function uploadFile(file: File): Promise<{ id: string; url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const headers = new Headers();
  const t = token();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", headers, body: fd });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function demoLogin(userId: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE}/api/auth/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
