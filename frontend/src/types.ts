export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  bio: string;
  role: string;
  status: string;
  lastSeen: string;
};

export type Channel = {
  id: string;
  name: string;
  slug: string;
  topic: string;
  memberCount: number;
  messageCount: number;
};

export type ReactionAgg = { emoji: string; userIds: string[]; count: number };

export type Attachment = {
  id: string;
  url: string;
  kind: string;
  width: number | null;
  height: number | null;
};

export type ChatMessage = {
  id: string;
  channelId: string | null;
  conversationId: string | null;
  userId: string;
  user: User;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  parentId: string | null;
  replyCount: number;
  reactions: ReactionAgg[];
  attachments: Attachment[];
  /** client-only */
  localStatus?: "sending" | "sent" | "failed";
  tempId?: string;
};

export type ConversationSummary = {
  id: string;
  title: string;
  peer: User | null;
  lastPreview: { body: string; userId: string; at: string } | null;
};

export type SearchHit = {
  id: string;
  body: string;
  createdAt: string;
  user: User;
  channelName: string | null;
  conversationId: string | null;
  channelId: string | null;
};
