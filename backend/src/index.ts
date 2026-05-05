import path from "node:path";
import fs from "node:fs";
import express from "express";
import cors from "cors";
import multer from "multer";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import { Prisma, type User } from "@prisma/client";
import { prisma } from "./lib/prisma.js";
import { authMiddleware, signToken, type AuthedRequest, verifyToken } from "./auth.js";

const PORT = Number(process.env.PORT ?? 4000);
const PUBLIC_URL = (process.env.PUBLIC_URL ?? `http://localhost:${PORT}`).replace(/\/$/, "");
const DEMO_LIVE = process.env.DEMO_LIVE === "1";

const EDIT_WINDOW_MS = 15 * 60 * 1000;

const app = express();
app.disable("x-powered-by");

app.use((_, res, next) => {
  res.setHeader("Content-Security-Policy", "frame-ancestors *");
  next();
});

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

app.use(
  "/uploads",
  express.static(uploadsDir, {
    setHeaders(res) {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

const messageInclude = {
  user: true,
  reactions: { include: { user: true } },
  attachments: true,
  _count: { select: { replies: true } },
} satisfies Prisma.MessageInclude;

type MsgRow = Prisma.MessageGetPayload<{ include: typeof messageInclude }>;

function serializeMessage(m: MsgRow) {
  const reactionsByEmoji = new Map<string, { emoji: string; userIds: string[]; count: number }>();
  for (const r of m.reactions) {
    const cur = reactionsByEmoji.get(r.emoji) ?? { emoji: r.emoji, userIds: [] as string[], count: 0 };
    cur.userIds.push(r.userId);
    cur.count += 1;
    reactionsByEmoji.set(r.emoji, cur);
  }
  return {
    id: m.id,
    channelId: m.channelId,
    conversationId: m.conversationId,
    userId: m.userId,
    user: publicUser(m.user),
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    editedAt: m.editedAt?.toISOString() ?? null,
    deletedAt: m.deletedAt?.toISOString() ?? null,
    parentId: m.parentId,
    replyCount: m._count?.replies ?? 0,
    reactions: [...reactionsByEmoji.values()],
    attachments: m.attachments.map((a) => ({
      id: a.id,
      url: a.url.startsWith("http") ? a.url : `${PUBLIC_URL}${a.url}`,
      kind: a.kind,
      width: a.width,
      height: a.height,
    })),
  };
}

function publicUser(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
    role: u.role,
    status: u.status,
    lastSeen: u.lastSeen.toISOString(),
  };
}

app.get("/api/demo/users", async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  res.json(users.map(publicUser));
});

app.post("/api/auth/demo", async (req, res) => {
  const parsed = z.object({ userId: z.string() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "userId required" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const token = signToken(user.id, user.email);
  res.json({ token, user: publicUser(user) });
});

app.get("/api/me", authMiddleware, async (req, res) => {
  const r = req as AuthedRequest;
  const user = await prisma.user.findUnique({ where: { id: r.userId } });
  if (!user) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(publicUser(user));
});

app.get("/api/users", authMiddleware, async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  res.json(users.map(publicUser));
});

app.get("/api/channels", authMiddleware, async (req, res) => {
  const r = req as AuthedRequest;
  const channels = await prisma.channel.findMany({
    where: { members: { some: { userId: r.userId } } },
    include: { _count: { select: { members: true, messages: true } } },
    orderBy: { name: "asc" },
  });
  res.json(
    channels.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      topic: c.topic,
      memberCount: c._count.members,
      messageCount: c._count.messages,
    }))
  );
});

app.get("/api/channels/:channelId/messages", authMiddleware, async (req, res) => {
  const r = req as AuthedRequest;
  const channelId = String(req.params.channelId);
  const limit = Math.min(Number(req.query.limit ?? 80), 120);
  const before = req.query.before ? new Date(String(req.query.before)) : undefined;
  const parentId = req.query.parentId !== undefined ? String(req.query.parentId || "") : undefined;
  const filterParent = parentId === undefined ? undefined : parentId === "" ? null : parentId;

  const member = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: r.userId } },
  });
  if (!member) {
    res.status(403).json({ error: "Not a member" });
    return;
  }

  const messages = await prisma.message.findMany({
    where: {
      channelId,
      deletedAt: null,
      ...(filterParent !== undefined ? { parentId: filterParent } : {}),
      ...(before ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: messageInclude,
  });

  res.json({ messages: messages.reverse().map(serializeMessage) });
});

app.post("/api/dm/open", authMiddleware, async (req, res) => {
  const r = req as AuthedRequest;
  const parsed = z.object({ peerUserId: z.string() }).safeParse(req.body);
  if (!parsed.success || parsed.data.peerUserId === r.userId) {
    res.status(400).json({ error: "Invalid peer" });
    return;
  }
  const peer = await prisma.user.findUnique({ where: { id: parsed.data.peerUserId } });
  if (!peer) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const candidates = await prisma.conversation.findMany({
    where: {
      AND: [
        { members: { some: { userId: r.userId } } },
        { members: { some: { userId: peer.id } } },
      ],
    },
    include: { members: true },
  });
  const existing = candidates.find((c) => c.members.length === 2);

  if (existing) {
    const full = await prisma.conversation.findUnique({
      where: { id: existing.id },
      include: { members: { include: { user: true } } },
    });
    res.json({
      id: full!.id,
      peer: publicUser(peer),
      members: full!.members.map((m) => publicUser(m.user)),
    });
    return;
  }

  const conv = await prisma.conversation.create({
    data: {
      members: {
        create: [{ userId: r.userId }, { userId: peer.id }],
      },
    },
    include: { members: { include: { user: true } } },
  });
  res.json({
    id: conv.id,
    peer: publicUser(peer),
    members: conv.members.map((m) => publicUser(m.user)),
  });
});

app.get("/api/conversations", authMiddleware, async (req, res) => {
  const r = req as AuthedRequest;
  const convs = await prisma.conversation.findMany({
    where: { members: { some: { userId: r.userId } } },
    include: {
      members: { include: { user: true } },
      messages: {
        where: { deletedAt: null, parentId: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { user: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const result = convs.map((c) => {
    const others = c.members.map((m) => m.user).filter((u) => u.id !== r.userId);
    const title =
      others.length === 1
        ? others[0].name
        : others
            .map((u) => u.name)
            .slice(0, 3)
            .join(", ");
    const last = c.messages[0];
    return {
      id: c.id,
      title,
      peer: others[0] ? publicUser(others[0]) : null,
      lastPreview: last
        ? { body: last.body, userId: last.userId, at: last.createdAt.toISOString() }
        : null,
    };
  });
  res.json(result);
});

app.get("/api/conversations/:conversationId/messages", authMiddleware, async (req, res) => {
  const r = req as AuthedRequest;
  const conversationId = String(req.params.conversationId);
  const limit = Math.min(Number(req.query.limit ?? 80), 120);
  const before = req.query.before ? new Date(String(req.query.before)) : undefined;
  const parentId = req.query.parentId !== undefined ? String(req.query.parentId || "") : undefined;
  const filterParent = parentId === undefined ? undefined : parentId === "" ? null : parentId;

  const mem = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: r.userId } },
  });
  if (!mem) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      deletedAt: null,
      ...(filterParent !== undefined ? { parentId: filterParent } : {}),
      ...(before ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: messageInclude,
  });
  res.json({ messages: messages.reverse().map(serializeMessage) });
});

app.get("/api/search", authMiddleware, async (req, res) => {
  const r = req as AuthedRequest;
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) {
    res.json({ results: [] });
    return;
  }

  const memberChannels = await prisma.channelMember.findMany({
    where: { userId: r.userId },
    select: { channelId: true },
  });
  const channelIds = memberChannels.map((m) => m.channelId);

  const dmConvs = await prisma.conversationMember.findMany({
    where: { userId: r.userId },
    select: { conversationId: true },
  });
  const convIds = dmConvs.map((m) => m.conversationId);

  if (channelIds.length === 0 && convIds.length === 0) {
    res.json({ results: [] });
    return;
  }

  const scopeOr = [
    ...(channelIds.length ? [{ channelId: { in: channelIds } as const }] : []),
    ...(convIds.length ? [{ conversationId: { in: convIds } as const }] : []),
  ];

  const messages = await prisma.message.findMany({
    where: {
      deletedAt: null,
      parentId: null,
      body: { contains: q, mode: "insensitive" },
      OR: scopeOr,
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      user: true,
      channel: true,
      conversation: { include: { members: { include: { user: true } } } },
    },
  });

  const results = messages.map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    user: publicUser(m.user),
    channelName: m.channel?.name ?? null,
    conversationId: m.conversationId,
    channelId: m.channelId,
  }));
  res.json({ results });
});

app.post("/api/messages", authMiddleware, async (req, res) => {
  const r = req as AuthedRequest;
  const parsed = z
    .object({
      body: z.string().max(16000).default(""),
      channelId: z.string().optional(),
      conversationId: z.string().optional(),
      parentId: z.string().optional(),
      attachmentIds: z.array(z.string()).optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { body, channelId, conversationId, parentId, attachmentIds } = parsed.data;
  if (!channelId && !conversationId) {
    res.status(400).json({ error: "channel or conversation required" });
    return;
  }

  if (channelId) {
    const m = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId: r.userId } },
    });
    if (!m) {
      res.status(403).json({ error: "Not in channel" });
      return;
    }
  } else if (conversationId) {
    const m = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: r.userId } },
    });
    if (!m) {
      res.status(403).json({ error: "Not in DM" });
      return;
    }
  }

  const msg = await prisma.message.create({
    data: {
      body,
      userId: r.userId,
      channelId: channelId ?? null,
      conversationId: conversationId ?? null,
      parentId: parentId ?? null,
    },
  });

  if (attachmentIds?.length) {
    await prisma.attachment.updateMany({
      where: { id: { in: attachmentIds }, messageId: null },
      data: { messageId: msg.id },
    });
  }

  if (conversationId) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {},
    });
  }

  const full = await prisma.message.findUnique({
    where: { id: msg.id },
    include: messageInclude,
  });

  const payload = serializeMessage(full as MsgRow);
  if (channelId) io.to(`channel:${channelId}`).emit("message:new", payload);
  if (conversationId) io.to(`dm:${conversationId}`).emit("message:new", payload);
  if (parentId) {
    const room = channelId ? `channel:${channelId}` : `dm:${conversationId}`;
    io.to(room).emit("thread:reply", { parentId, message: payload });
  }

  res.json(payload);
});

app.patch("/api/messages/:messageId", authMiddleware, async (req, res) => {
  const r = req as AuthedRequest;
  const messageId = String(req.params.messageId);
  const parsed = z.object({ body: z.string().max(16000) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid" });
    return;
  }
  const existing = await prisma.message.findUnique({ where: { id: messageId } });
  if (!existing || existing.userId !== r.userId || existing.deletedAt) {
    res.status(403).json({ error: "Cannot edit" });
    return;
  }
  if (Date.now() - existing.createdAt.getTime() > EDIT_WINDOW_MS) {
    res.status(403).json({ error: "Edit window expired" });
    return;
  }
  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { body: parsed.data.body, editedAt: new Date() },
    include: messageInclude,
  });
  const payload = serializeMessage(updated);
  if (updated.channelId) io.to(`channel:${updated.channelId}`).emit("message:updated", payload);
  if (updated.conversationId) io.to(`dm:${updated.conversationId}`).emit("message:updated", payload);
  res.json(payload);
});

app.delete("/api/messages/:messageId", authMiddleware, async (req, res) => {
  const r = req as AuthedRequest;
  const messageId = String(req.params.messageId);
  const existing = await prisma.message.findUnique({ where: { id: messageId } });
  if (!existing || existing.userId !== r.userId) {
    res.status(403).json({ error: "Cannot delete" });
    return;
  }
  await prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date(), body: "" },
  });
  if (existing.channelId) io.to(`channel:${existing.channelId}`).emit("message:deleted", { id: messageId });
  if (existing.conversationId)
    io.to(`dm:${existing.conversationId}`).emit("message:deleted", { id: messageId });
  res.json({ ok: true, id: messageId });
});

app.post("/api/messages/:messageId/reactions", authMiddleware, async (req, res) => {
  const r = req as AuthedRequest;
  const messageId = String(req.params.messageId);
  const parsed = z.object({ emoji: z.string().min(1).max(16) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "emoji required" });
    return;
  }
  const emoji = parsed.data.emoji;
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg || msg.deletedAt) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const existing = await prisma.reaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId: r.userId, emoji } },
  });
  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.reaction.create({
      data: { messageId, userId: r.userId, emoji },
    });
  }

  const full = await prisma.message.findUnique({
    where: { id: messageId },
    include: messageInclude,
  });
  const payload = serializeMessage(full as MsgRow);
  if (full!.channelId) io.to(`channel:${full!.channelId}`).emit("message:updated", payload);
  if (full!.conversationId) io.to(`dm:${full!.conversationId}`).emit("message:updated", payload);
  res.json(payload);
});

app.post("/api/upload", authMiddleware, upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "file required" });
    return;
  }
  const publicPath = `/uploads/${file.filename}`;
  const att = await prisma.attachment.create({
    data: {
      messageId: null,
      url: publicPath,
      kind: file.mimetype.startsWith("image/") ? "image" : "file",
    },
  });
  res.json({
    id: att.id,
    url: `${PUBLIC_URL}${publicPath}`,
    path: publicPath,
  });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
});

const onlineUsers = new Map<string, Set<string>>();
const socketUser = new Map<string, string>();

function addOnline(userId: string, socketId: string) {
  let set = onlineUsers.get(userId);
  if (!set) {
    set = new Set();
    onlineUsers.set(userId, set);
  }
  set.add(socketId);
}

function removeOnline(socketId: string) {
  const userId = socketUser.get(socketId);
  if (!userId) return;
  const set = onlineUsers.get(userId);
  if (set) {
    set.delete(socketId);
    if (set.size === 0) onlineUsers.delete(userId);
  }
  socketUser.delete(socketId);
}

function broadcastPresence() {
  const snapshot: Record<string, boolean> = {};
  for (const id of onlineUsers.keys()) snapshot[id] = true;
  io.emit("presence:snapshot", snapshot);
}

io.use((socket, next) => {
  try {
    const token = String(socket.handshake.auth?.token ?? "");
    if (!token) throw new Error("no token");
    const p = verifyToken(token);
    (socket.data as { userId: string }).userId = p.sub;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket: Socket) => {
  const userId = (socket.data as { userId: string }).userId;
  socketUser.set(socket.id, userId);
  addOnline(userId, socket.id);
  void prisma.user.update({
    where: { id: userId },
    data: { status: "ONLINE", lastSeen: new Date() },
  });
  broadcastPresence();

  socket.on("join:channel", (channelId: string) => {
    socket.join(`channel:${channelId}`);
  });
  socket.on("leave:channel", (channelId: string) => {
    socket.leave(`channel:${channelId}`);
  });
  socket.on("join:dm", (conversationId: string) => {
    socket.join(`dm:${conversationId}`);
  });
  socket.on("leave:dm", (conversationId: string) => {
    socket.leave(`dm:${conversationId}`);
  });

  socket.on("typing:start", (payload: { channelId?: string; conversationId?: string }) => {
    const target =
      payload.channelId != null
        ? `channel:${payload.channelId}`
        : payload.conversationId != null
          ? `dm:${payload.conversationId}`
          : null;
    if (!target) return;
    socket.to(target).emit("typing:update", {
      userId,
      state: "start",
      channelId: payload.channelId,
      conversationId: payload.conversationId,
    });
  });
  socket.on("typing:stop", (payload: { channelId?: string; conversationId?: string }) => {
    const target =
      payload.channelId != null
        ? `channel:${payload.channelId}`
        : payload.conversationId != null
          ? `dm:${payload.conversationId}`
          : null;
    if (!target) return;
    socket.to(target).emit("typing:update", {
      userId,
      state: "stop",
      channelId: payload.channelId,
      conversationId: payload.conversationId,
    });
  });

  socket.on("disconnect", () => {
    removeOnline(socket.id);
    void prisma.user
      .update({
        where: { id: userId },
        data: { status: "OFFLINE", lastSeen: new Date() },
      })
      .catch(() => {});
    broadcastPresence();
  });
});

async function demoBotLoop() {
  if (!DEMO_LIVE) return;
  const channels = await prisma.channel.findMany();
  const users = await prisma.user.findMany();
  if (channels.length === 0 || users.length === 0) return;

  const snippets = [
    "Pushed a small fix to the draft PR — can someone sanity-check the thread replies?",
    "Looping in @everyone: standup notes are in #engineering",
    "Microcopy tweak on the invite modal is live on staging.",
    "I'll be AFK for an hour — ping @Alex if builds break.",
    "/rfc on message retention: 90d vs forever for showcase demo data?",
    "Gif battle in #random continues 🎸",
    "Dark mode contrast pass landed — shout if anything feels muddy.",
    "Socket reconnect looks clean in latest build 🙌",
  ];

  setInterval(async () => {
    try {
      const ch = channels[Math.floor(Math.random() * channels.length)]!;
      const u = users[Math.floor(Math.random() * users.length)]!;
      const body = snippets[Math.floor(Math.random() * snippets.length)]!;
      const msg = await prisma.message.create({
        data: { channelId: ch.id, userId: u.id, body },
      });
      const full = await prisma.message.findUnique({
        where: { id: msg.id },
        include: messageInclude,
      });
      if (full) io.to(`channel:${ch.id}`).emit("message:new", serializeMessage(full));
    } catch (e) {
      console.error("demo bot", e);
    }
  }, 30000 + Math.random() * 30000);
}

httpServer.listen(PORT, () => {
  console.log(`Riff API + WS on ${PORT}`);
  void demoBotLoop();
});
