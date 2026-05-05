# Riff — realtime team chat (portfolio)

**Tagline:** Slack/Discord-inspired team chat with Socket.IO realtime, rich messages, threads, and iframe-first layout — built as **Project 4/5** for a career-page showcase.

After `npm run dev`, capture your own screenshot from `#general` for the README hero if desired.

## Architecture

```
┌─────────────────┐     HTTPS/WS      ┌──────────────────┐
│  Vite + React   │◄────────────────►│ Express +        │
│  (Tailwind)     │   REST + WS       │ Socket.IO        │
└────────┬────────┘                   └────────┬─────────┘
         │                                     │
         │ embed                               │
         ▼                                     ▼
   Parent career page (iframe)           PostgreSQL
```

## Tech stack

| Layer    | Choice |
| -------- | ------ |
| Frontend | React 19, Vite 8, TypeScript, Tailwind v4, framer-motion, react-virtuoso, react-markdown, react-syntax-highlighter, emoji-mart |
| Backend  | Node 22, Express, Socket.IO, Prisma, Zod, multer |
| Database | PostgreSQL (Supabase or Docker local) |
| Auth     | Demo identity picker → **JWT in `localStorage`** (iframe-friendly vs third-party cookies) |

## Local setup

### Prereqs

- Node 22+
- Docker (optional, for Postgres)

### 1) Database

```bash
docker compose up -d postgres
# default: postgresql://riff:riff@localhost:5435/riff?schema=public
```

### 2) Backend

```bash
cd backend
cp .env.example .env   # adjust DATABASE_URL if needed
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
# API + WebSocket: http://localhost:4000
```

### 3) Frontend

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
# http://localhost:5173 — proxies /api, /uploads, /socket.io → :4000
```

### Full stack (Docker)

```bash
docker compose up --build
# Frontend (nginx): http://localhost:5173
# API:              http://localhost:4000
```

## Environment

**Backend** (`backend/.env`):

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Sign demo JWTs |
| `PORT` | Default `4000` |
| `PUBLIC_URL` | Absolute URL for uploaded files (e.g. `https://api.example.com`) |
| `DEMO_LIVE` | `1` to enable ambient seed-user bot posts every 30–60s |

**Frontend** (`frontend/.env`):

| Variable | Purpose |
| -------- | ------- |
| `VITE_API_URL` | Empty in dev (use Vite proxy). In production static hosting, set to your API origin (e.g. `https://api.example.com`). |

## Database (overview)

- `User`, `Channel`, `ChannelMember`, `Conversation`, `ConversationMember`
- `Message` (optional `parentId` for threads), `Reaction`, `Attachment` (nullable `messageId` until linked after upload)

## Demo access

- No password. Open the splash screen and pick any seeded teammate.
- JWT is stored in `localStorage` under `riff_token` (documented for iframe demos).

## Features implemented

- Workspace shell: channels (**#general, #random, #design, #engineering, #showcase**), DMs, current user footer
- Channel + DM message timeline with **day separators**, virtualized list, auto-scroll + “new messages” pill
- Socket.IO: live messages, **typing** (debounced server timeout 3s), **presence** snapshot
- Markdown, **@mentions** (highlight), syntax-highlighted **code blocks**, **emoji picker**, **reactions**, **image upload**
- **Edit / delete** own messages (15-minute edit window)
- **Threads**: side panel + reply count
- **Search** (`/api/search`, case-insensitive)
- Seed data: 6 users, rich channel history, sample DM + thread
- **DEMO_LIVE** optional bot traffic

## Iframe embed

Parent page must **not** send `X-Frame-Options: DENY`. This app sets **`Content-Security-Policy: frame-ancestors *`** on API and nginx (Docker).

```html
<iframe
  src="https://<your-deployed-frontend-url>"
  width="100%"
  height="720"
  style="border:0;border-radius:16px"
  title="Riff"
  allow="autoplay; clipboard-write"
  loading="lazy"
></iframe>
```

Serve `iframe-test.html` from the repo root to validate embed + **800px / 1200px** widths (update the `src` port if Vite picks another port).

## Deployment

### GitHub

```bash
gh repo create ori1706/riff-chat --public --source=. --push --description "Riff — realtime chat demo (Socket.IO, Prisma, iframe-ready)"
```

### Frontend → Vercel

```bash
cd frontend
npx vercel --prod --yes
```

If the CLI requires interactive login, use the Vercel dashboard: set **Root Directory** to `frontend`, framework Vite, and env `VITE_API_URL` to your public API URL.

### Backend → Fly.io / Render

- **Fly:** from `backend/`, set secrets `DATABASE_URL`, `JWT_SECRET`, `PUBLIC_URL` (your Fly app URL), then `fly deploy`.
- **Render:** use repo `render.yaml` as a blueprint; set `DATABASE_URL` and `PUBLIC_URL` in the dashboard.

**Supabase:** create a project, paste `DATABASE_URL` into backend env, run `npx prisma db push && npm run db:seed` once.

## Browser verification (team checklist)

1. Splash → pick user → workspace loads with channels.
2. `#general` → history + day separators + scroll to bottom.
3. Send message → optimistic → confirmed; console clean.
4. Two browser tabs as two demo users → cross-send, typing, presence, reactions, edits.
5. DM flow, thread panel, search hits, image upload + reload.
6. Open `iframe-test.html` → app loads in iframe, WS works, layout uses **% height** (no `100vh` in app shell).

## License

MIT (portfolio / demonstration use).
