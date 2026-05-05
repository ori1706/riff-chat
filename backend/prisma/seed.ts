import {
  PrismaClient,
  UserPresence,
} from "@prisma/client";

const prisma = new PrismaClient();

const avatar = (seed: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;

const usersData = [
  {
    name: "Alex Chen",
    email: "alex.chen@riff.demo",
    seed: "AlexChen",
    bio: "Staff engineer. Bikesheds in TypeScript threads.",
    role: "Staff Engineer",
  },
  {
    name: "Jordan Lee",
    email: "jordan.lee@riff.demo",
    seed: "JordanLee",
    bio: "Design systems lead. Thinks in spacing tokens.",
    role: "Design Lead",
  },
  {
    name: "Sam Rivera",
    email: "sam.rivera@riff.demo",
    seed: "SamRivera",
    bio: "Product. Translates customer pain into scoped MVPs.",
    role: "Product Manager",
  },
  {
    name: "Morgan Patel",
    email: "morgan.patel@riff.demo",
    seed: "MorganPatel",
    bio: "Infra & security. Redis wrangler.",
    role: "Platform Engineer",
  },
  {
    name: "Riley Kim",
    email: "riley.kim@riff.demo",
    seed: "RileyKim",
    bio: "Mobile + realtime. WebSocket obsessive.",
    role: "Mobile Engineer",
  },
  {
    name: "Casey Nguyen",
    email: "casey.nguyen@riff.demo",
    seed: "CaseyNguyen",
    bio: "Marketing. Keeps launches coherent when everything is on fire.",
    role: "Marketing",
  },
];

const channelSeeds: { slug: string; name: string; topic: string; lines: string[] }[] = [
  {
    slug: "general",
    name: "general",
    topic: "Company-wide announcements and watercooler",
    lines: [
      "Morning! Reminder: design critique moved to 3pm ET.",
      "Shipped the iframe-safe layout tweaks — **please** sanity-check on narrow widths.",
      "Who owns the Supabase backup checklist this week?",
      "Grabbing coffee, back in 20.",
      "The `/api/search` endpoint is *fast* now — nice work.",
      "Can we get a decision on default channel order for new workspaces?",
      "I'll post the incident retro notes in `docs/incidents`.",
      "Recruiting: we're opening a senior frontend role — @Sam has the JD.",
      "FYI: Vercel preview URLs will rotate after the org migration.",
      "Anyone seeing flaky websocket reconnects? Riley is digging.",
      "Bold take: we should **pin** the showcase channel during demos.",
      "Link: https://vercel.com/docs — for the deployment runbook.",
      "Emoji poll: 🚀 for ship today, ⏳ for hold.",
      "`pnpm db:seed` still the source of truth for demo users?",
      "I'll draft the changelog for the emoji picker upgrade.",
      "Parents on the team: heads-up, school holiday Monday in CA.",
      "Pushed a11y fixes to the message composer — tab order feels right now.",
      "We need a naming pass on DM vs conversation in the API.",
      "Standup notes archived under `wiki/standup/2026`.",
      "Testing image uploads with a 1MB png — multer limit OK.",
      "@Jordan can you review the thread panel motion curve?",
      "Infrastructure office hours at 5pm if anyone wants pairing.",
      "I'll be **AWAY** this afternoon — ping Morgan for deploys.",
      "Celebrating small wins: typing indicators shipped 🎉",
      "Can we add ILIKE search across DMs too? Already scoped.",
      "Nit: day separators should respect locale — filing ticket.",
      "Dogfood session Thursday — bring your roughest workflows.",
      "I'll capture screenshots for the README tonight.",
      "Shoutout to Casey for the launch copy — reads super clean.",
      "Reminder: no deploys after 4pm Friday unless critical.",
      "Has anyone reproduced the Safari clipboard quirk?",
      "I'll pair with Riley on socket auth edge cases tomorrow.",
      "Metrics: p95 message send < 120ms on my machine.",
      "Uploads go to `backend/uploads/` locally — document in README.",
      "Question: should deleted messages show a tombstone in threads?",
      "I'll thread replies under the migration announcement.",
      "Bringing donuts Monday if we hit the demo checklist ✅",
      "Cross-posting: engineering roundtable moved to #engineering.",
      "Let's keep `/showcase` channel focused on portfolio chatter.",
      "Who's on point for the Fly.io Dockerfile review?",
      "I'll drop a Loom walkthrough of the quick-switcher.",
      "Markdown tables — do we support them or nah?",
      "Perf win: virtualized list now stable at 400+ messages.",
      "Snack channel energy leaking into general again 😅",
      "I'll update seed bios to sound less corporate.",
      "Security note: JWT in `localStorage` is **demo-only**.",
      "Calling it: Riff feels more alive than our last Slack theme.",
      "Thanks everyone for keeping calls short today.",
      "I'll verify iframe height at 800px and 1200px tonight.",
      "Random: what's the best keyboard shortcut we've added? Mine is ⌘K.",
      "Publishing the brand palette to Figma after lunch.",
      "If websocket drops, UI should show subtle reconnect — added issue.",
      "Microcopy for 'N new messages' pill finalized.",
      "I'll normalize user presence enums in the API response.",
      "Heads-down afternoon — slack me only if prod is red.",
      "Love the subtle glass sidebar — matches the career page vibe.",
      "I'll seed an extra batch of messages for #random later.",
      "Reminder to hydrate your demo databases before recording.",
      "Anyone want async feedback on my PR description?",
      "I'll capture network traces for the team lead review.",
      "Gif policy: use sparingly in #general please 🙏",
      "Socket.IO rooms naming: `channel:` vs `dm:` — documented.",
      "I'll add fly.toml and render.yaml before EOD.",
      "Celebrating: first cross-tab typing indicator test **green**.",
      "FYI dicebear avatars hotlink fine with CORS for our demo.",
      "I'll tighten the 15-minute edit window toast copy.",
      "Standup: I'm blocked on nothing — rare flex.",
      "Let's keep reactions to the shortlist for the demo recording.",
      "I'll chase the double-scroll bug in the thread drawer.",
      "Thanks for the thoughtful review on mentions regex.",
      "Paging virtuoso — working great with framer-motion fades.",
      "I'll post-deployment checklist in #engineering after merge.",
      "Wildcard Friday: share a playlist link? (Optional)",
      "Signing off — great momentum on Riff this week.",
    ],
  },
  {
    slug: "random",
    name: "random",
    topic: "Memes, pets, and non-work rabbit holes",
    lines: [
      "Drop your pet pics. Mine is a menace in socks.",
      "Wordle streak: lost. Dignity: intact.",
      "What's the best keyboard you've typed on? Keychron fan here.",
      "Hot take: pineapple on pizza is a deployment risk.",
      "TIL `console.table` still slaps for debugging seeds.",
      "Recommendations for noise cancelling under $200?",
      "I'm learning pottery — my first bowl is *technically* food safe.",
      "Anyone else binge the same playlist on repeat?",
      "GIF battle: reply with your most cursed work meme.",
      "Just saw a dog in a backpack on the train — highlight of my week.",
      "Cooking experiment: miso butter pasta — 8/10 would ship.",
      "What's your go-to lunch order near the office?",
      "Random tip: stretch wrists before long typing sessions.",
      "I'm convinced Markdown parsers have feelings.",
      "Who schedules meetings at 4:55pm? villains.",
      "Weekend plans: touch grass, maybe tweak dotfiles.",
      "Found a coffee shop with actual quiet zones 🙌",
      "Sending virtual donuts to whoever fixed the flaky test.",
      "What's the spiciest take about IDE themes?",
      "I'll trade one (1) sticker for a good sourdough recipe.",
      "Procrastinating by theming the terminal again.",
      "Does anyone else name their branches like song titles?",
      "Rainy day = lo-fi + refactor guilt.",
      "Unpopular opinion: tabs > spaces (fight me respectfully).",
      "I tried cold brew concentrate. Heart now sonic boom.",
      "Show me your desk plants — need inspiration.",
      "Accidentally replied-all with a meme once. Legend status?",
      "What's your guilty pleasure sci-fi series?",
      "Trying to learn juggling to impress no one.",
      "What's the best airport wifi you've survived?",
      "Tell me your favorite tiny UX delight from any app.",
      "I bought LEDs. Productivity unchanged. Vibes improved.",
      "Who else runs their own DNS for fun?",
      "Random appreciation thread for good documentation writers.",
      "I will not start a new side project. I will not—",
      "Best bug you caused that became a feature?",
      "Rate my sandwich: grilled cheese, tiny burnt, still elite.",
      "Any board game groups recruiting?",
      "What's your harmless superstition before deploys?",
      "Sending good vibes to anyone on-call this week 💜",
      "What song is stuck in your head? Mine: something ungoogleable.",
      "I promise to stop buying notebooks I won't use. Starting Monday.",
      "Who wins in a race: your CI pipeline or microwave popcorn?",
      "Post your favorite reaction emoji usage etiquette.",
      "Hydration check — go drink water.",
      "What's a small win you're proud of this week?",
      "I'll trade sprint points for nap points.",
      "Accidentally merged with a meme in the PR title. Worth it.",
      "What's the best ramen in the city? Go.",
      "Random: favorite pixel art game?",
      "If your git history was a movie genre, what would it be?",
      "I'm three tabs deep in mechanical keyboard YouTube again.",
      "Petition to rename Friday to 'merge friday' (non-binding).",
      "Who else talks to their linter like it's a coworker?",
      "Show off your sticker-bombed laptop (SFW only).",
      "What's the most underrated keyboard shortcut?",
      "I tried meditating between meetings. 10/10 recommend.",
      "What's your go-to emoji when everything is fine (it's not)?",
      "Posting one (1) wholesome meme for timeline balance.",
      "I'm convinced merge conflicts build character. Painful character.",
      "What's your comfort show? Mine: cozy mysteries.",
      "Rate today's standup energy 1-10.",
      "Wild idea: standup walking meetings — yay or nay?",
      "Random compliment: your message threads read like good docs.",
      "If bugs were Pokémon, I'd have caught them all by now.",
      "I'll see you all in #random after deploy celebrations.",
      "Signing off with a virtual high-five ✋",
    ],
  },
  {
    slug: "design",
    name: "design",
    topic: "Product design critiques and UX research",
    lines: [
      "Exploring a calmer default theme for iframe embeds — thoughts?",
      "Can we tighten the line-height on markdown code blocks?",
      "User test takeaway: users expect ⌘K everywhere now.",
      "Iterations on the sidebar density are in Figma — link soon.",
      "Proposal: thread drawer 420px wide at desktop.",
      "Micro-interaction on send button: subtle scale OK?",
      "Accessibility pass scheduled with external audit next month.",
      "Should reaction bar appear on hover-only or always visible?",
      "Research: newer users confused by demo identity splash — iterative copy.",
      "Color contrast on teal-on-slate passes WCAG AA in latest tokens.",
      "Motion preference: respect `prefers-reduced-motion` in thread transitions.",
      "Placeholder text for empty DM — warmer tone drafted.",
      "Iconography audit: replace ambiguous 'hash' glyph.",
      "Exploring skeleton loaders for channel switch — framer presets ready.",
      "Do we show member count in header on mobile iframe widths?",
      "Sticky composer shadow: 8px blur vs 12px?",
      "User quote: 'typing indicator feels human' — nice.",
      "File upload drag target — extend hit area to full dropzone?",
      "Typography scale: bump message body to 15px for readability.",
      "Dark mode token rename: `--riff-surface-elevated` approved.",
      "Illustration for splash: abstract waveform vs chat bubbles?",
      "Poll: default emoji skin tone settings?",
      "Design QA: image lightbox focus trap verified.",
      "Edge case: very long channel names truncation + tooltip.",
      "Spacing between day separators — 24px vertical rhythm.",
      "Critique invite: thread panel hierarchy at 4pm.",
      "Should we expose channel topic inline editable for admins?",
      "Exploration: mini avatar stack for overlapping typing users.",
      "Onboarding tooltip copy for mentions typeahead updated.",
      "Visual bug: reaction pill misaligned on Safari 17 — filed.",
      "Moodboard for 'Riff' brand — electric teal + midnight slate.",
      "Considering softer borders on message bubbles in DMs.",
      "Design debt: unify hover states on sidebar rows.",
      "UX copy for optimistic send states: 'Sending…' vs 'In flight'",
      "Research synthesis landing in Notion Friday.",
      "Proposal: cap inline image width at 480 in message column.",
      "Sticker pack for internal celebrations — scope creep but fun.",
      "Mobile-first pass deferred — iframe portfolio priority.",
      "Design pairing with Riley on realtime toast patterns.",
      "Question: show edit history indicator beyond '(edited)'?",
      "Exploration: subtle noise texture on app background.",
      "Feedback welcome on new empty search state illustration.",
      "Iterations on emoji picker categories — fewer taps to 😂",
      "Component audit: extract `AvatarWithPresence` shared primitive.",
      "Should we surface read receipts in demo build? leaning no.",
      "Figma auto-layout woes — who has tips?",
      "Design tokens pipeline: Style Dictionary experiment ongoing.",
      "Inline code styling: border-radius 6px proposal.",
      "User test clips trimmed for leadership review.",
      "Motion curve for thread open: easeOutCubic feels right.",
      "Considering brand wordmark weight for marketing site.",
      "Polish pass on DM header avatars — stacked vs single.",
      "Thanks for thoughtful feedback on channel list icons.",
      "Next: align composer formatting toolbar with career page styles.",
      "I'll export redlines for engineering handoff tonight.",
      "Design sync: async comments close EOD Thursday.",
      "Exploration: gradient hairline on active channel pill.",
      "Question: default thread sort — oldest first locked?",
      "UX nit: Esc should close quick switcher *and* thread panel.",
      "I'll pair with Morgan on loading perf vs skeleton duration.",
      "Design QA checklist updated in the wiki.",
      "Considering haptic patterns for mobile web (optional).",
      "Ship small, iterate: toast stack v1 scoped.",
      "Brand voice: witty but not snarky — examples drafted.",
      "Thanks everyone — design critique notes posted.",
    ],
  },
  {
    slug: "engineering",
    name: "engineering",
    topic: "Backend, frontend, infra, and code review",
    lines: [
      "Socket auth middleware now validates JWT from handshake — review please.",
      "Proposal: move reaction toggles to idempotent POST with server truth.",
      "Investigating Prisma `in: []` edge in search — guarded now.",
      "Dockerfile uses multi-stage build — image ~180MB.",
      "Added `frame-ancestors *` header — verify with curl -I.",
      "Reminder: do **not** use `helmet.frameguard` — breaks iframes.",
      "Express static uploads served with CORP cross-origin for canvas safety.",
      "Debounce typing events 300ms on client — agree?",
      "Seed script generates 60+ msgs/channel — CI time acceptable.",
      "Fly.io vs Render: websockets sticky sessions notes in README.",
      "Postgres in docker-compose on port **5435** to avoid collisions.",
      "Bugfix: DM conversation finder now checks exactly-two members.",
      "We should rate-limit upload endpoint before public demo.",
      "Thoughts on storing attachment metadata before message row?",
      "Migration plan: nullable `Attachment.messageId` unblocks upload UX.",
      "Integration test idea: mock socket.io client for CI.",
      "JWT rotation out of scope for portfolio demo — documented risk.",
      "Caching channel member counts — low priority until scale.",
      "Observability: add request ids on REST routes next sprint.",
      "Sharp consider for image dimension metadata on upload.",
      "Thread reply counts denormalized via `_count` — perf OK.",
      "Search uses Prisma `contains` — good enough for demo scale.",
      "Investigate occasional double `message:new` if client retries.",
      "WebSocket CORS `origin: true` matches shared spec.",
      "Helm? k8s? not yet — Fly blueprint first.",
      "TypeScript strict mode enabled across backend.",
      "Frontend env: `VITE_API_URL` for prod flexibility.",
      "Consider extracting `serializeMessage` for tests.",
      "Added demo bot behind `DEMO_LIVE=1` — safe default off.",
      "Review: ensure soft-deleted messages excluded from search.",
      "N+1 check on message list — prisma includes look sane.",
      "Devtools: prisma studio on `5555` documented.",
      "Edge case: edit window uses server `createdAt` — good.",
      "We should backoff reconnect with jitter in socket client.",
      "Markdown renderer: sanitize HTML from user content TODO.",
      "Redis adapter for socket.io scale — future work.",
      "CI could run `docker compose up` smoke — nice-to-have.",
      "Expose healthcheck endpoint `/health`? quick win.",
      "Added `/health` returning `{ok:true}` — wire in probes.",
      "CSP note: only setting frame-ancestors; avoid img-src pitfalls.",
      "Verify dicebear svg loads inside iframe — CORS OK.",
      "Load test later: 500 concurrent sockets on small Fly machine.",
      "Potential leak: typing stop not fired on abrupt tab close — acceptable.",
      "Discuss: message pagination cursor vs offset — cursor chosen.",
      "Ensure delete broadcasts after DB commit — ordering matters.",
      "Audit multer file filter for mime types.",
      "We gzip JSON responses? not yet — CDN may handle.",
      "Backend tests stub auth middleware — scaffolding next.",
      "Prisma migration vs db push — using push for demo velocity.",
      "Reviewed seed random timestamps — spread across 7 days ✔",
      "TODO: unify error JSON shape `{error:string}`.",
      "Thanks for the thorough review on socket room naming.",
      "I'll draft architecture ASCII for README section.",
      "Next hardening sprint: CSRF not applicable for bearer JWT demo.",
      "Signing off — green builds on local docker path.",
    ],
  },
  {
    slug: "showcase",
    name: "showcase",
    topic: "Portfolio embeds, demos, and recruiter-facing polish",
    lines: [
      "Career page iframe height plan: 720px default — aligns with spec.",
      "We need a one-paragraph 'demo flow' for visitors.",
      "Recording checklist: two tabs, typing, reactions, image upload.",
      "Heads-up: parent page is dark — match contrast in embed.",
      "Screenshot pass after tailwind token tweaks.",
      "Verify ⌘K quick switcher inside iframe focus traps.",
      "I'll prepare embed snippet for README + final report.",
      "Marketing wants a 30s silent screen capture — OK to share?",
      "Todo: list seed users with bios in final handoff.",
      "Confirm websocket works when iframe `src` is prod URL.",
      "Double-check no `100vh` in layout — use `height:100%` chain.",
      "Modals must portal to app root — not parent document.",
      "I'll walk through `iframe-test.html` in browser MCP session.",
      "Polish: 'N new messages' pill screenshot for deck.",
      "Ensure upload persistence after full page reload.",
      "Guest viewers may mute audio — not applicable but noted.",
      "Add fly.toml region `iad` default — discuss.",
      "Render blueprint includes healthcheck path `/health`.",
      "I'll verify network tab: no socket reconnect storm.",
      "Story for recruiters: realtime collab without accounts — neat hook.",
      "Cross-link from #general if portfolio milestones land.",
      "Consider lightweight 'What is Riff?' tooltip on splash.",
      "Brand slug GitHub `riff-chat` — matches deploy artifacts.",
      "Document Supabase alternative path — env `DATABASE_URL` swap.",
      "I'll capture 800px vs 1200px iframe screenshots.",
      "QA: image lightbox closes on Esc within iframe.",
      "Portfolio narrative: emphasize Prisma + Socket.IO integration.",
      "Note: demo identities pre-seeded — no password fragility.",
      "I'll time the ambient bot messages for video recording.",
      "Risk register: hosting auth for Vercel/Render still manual.",
      "Nice-to-have: subtle sound on send — skipped for autoplay policy.",
      "Confirm README includes docker-compose one-liner.",
      "I'll list features completed vs optional thread panel.",
      "Mention markdown + mentions + emoji in feature list.",
      "Final report fields per shared spec — tracking in checklist.",
      "I'll validate CORS headers on preflight from Vercel preview.",
      "Embed snippet uses `loading=lazy` per spec example.",
      "If deploy blocked, README still wins — emphasize that.",
      "Coordination: other agents building parallel demos — avoid cross-repo edits.",
      "I'll keep language accessible per user preference.",
      "Polish grammar in seed messages after content freeze.",
      "Deck slide: architecture diagram from README.",
      "I'll export seed user table for team lead message.",
      "Reminder: JWT comment in README about iframe tradeoff.",
      "Verify `allow` attribute on iframe example includes clipboard.",
      "Add nit: framer-motion reduces motion respect.",
      "I'll proofread deploy instructions for Fly CLI auth blocker.",
      "Success metric: recruiter says 'this feels real'.",
      "Shot list: splash → channel → DM → reaction → edit/delete.",
      "I'll queue browser regression after each deploy.",
      "Thanks squad — showcase channel is our launch pad.",
      "Tag me when deploy URLs are live for final pass.",
      "Celebrating parallel builds across five portfolio apps 🚀",
      "I'll prep quick demo script for live screenshare interviews.",
      "Last call for copy tweaks before we tag v1.",
      "Posting embed HTML in final handoff for parent integration.",
    ],
  },
];

function spreadDates(count: number): Date[] {
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  return Array.from({ length: count }, (_, i) => {
    const t = now - Math.random() * week - i * 60_000;
    return new Date(t);
  }).sort((a, b) => a.getTime() - b.getTime());
}

async function main() {
  await prisma.reaction.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.message.deleteMany();
  await prisma.channelMember.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.conversationMember.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.user.deleteMany();

  const users = await prisma.$transaction(
    usersData.map((u) =>
      prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          avatarUrl: avatar(u.seed),
          bio: u.bio,
          role: u.role,
          status: UserPresence.OFFLINE,
        },
      })
    )
  );

  const userByEmail = Object.fromEntries(users.map((x) => [x.email, x]));

  const channels = await prisma.$transaction(
    channelSeeds.map((c) =>
      prisma.channel.create({
        data: {
          name: c.name,
          slug: c.slug,
          topic: c.topic,
          members: {
            create: users.map((u) => ({ userId: u.id })),
          },
        },
      })
    )
  );

  const channelBySlug = Object.fromEntries(channels.map((c) => [c.slug, c]));

  for (const seed of channelSeeds) {
    const ch = channelBySlug[seed.slug]!;
    const lineCount = Math.min(seed.lines.length, 45 + Math.floor(Math.random() * 25));
    const picks = seed.lines.slice(0, lineCount);
    const times = spreadDates(picks.length);

    await prisma.$transaction(
      picks.map((body, i) => {
        const author = users[i % users.length]!;
        return prisma.message.create({
          data: {
            channelId: ch.id,
            userId: author.id,
            body,
            createdAt: times[i]!,
          },
        });
      })
    );
  }

  // Sample DM between Alex and Jordan
  const alex = userByEmail["alex.chen@riff.demo"]!;
  const jordan = userByEmail["jordan.lee@riff.demo"]!;
  const dm = await prisma.conversation.create({
    data: {
      members: {
        create: [{ userId: alex.id }, { userId: jordan.id }],
      },
    },
  });
  const dmTimes = spreadDates(12);
  const dmBodies = [
    "Hey — got a minute to review the thread panel spacing?",
    "Yep! Send the Figma frame?",
    "Linked in `#design` pin. Worry about 900px iframe.",
    "On it. Might nudge padding-left 4px.",
    "Hero. Also: thoughts on default channel order?",
    "alphabetical feels safe; showcase pinned later.",
    "Sounds good. I'll note in README.",
    "Thanks! I'll sync with Riley on socket rooms naming.",
    "💜",
    "btw avatar tooltips should show role — added to backlog",
    "Noted. I'll align with seed `role` field.",
    "You're the best. Coffee later?",
  ];
  await prisma.$transaction(
    dmBodies.map((body, i) =>
      prisma.message.create({
        data: {
          conversationId: dm.id,
          userId: i % 2 === 0 ? alex.id : jordan.id,
          body,
          createdAt: dmTimes[i]!,
        },
      })
    )
  );

  // Thread sample in general
  const general = channelBySlug["general"]!;
  const parent = await prisma.message.create({
    data: {
      channelId: general.id,
      userId: alex.id,
      body: "Kicking off a thread: migration checklist for Supabase → verify RLS policies.",
    },
  });
  await prisma.message.create({
    data: {
      channelId: general.id,
      userId: jordan.id,
      body: "Added a section on service role keys — please don't commit them 🙃",
      parentId: parent.id,
    },
  });
  await prisma.message.create({
    data: {
      channelId: general.id,
      userId: users[2]!.id,
      body: "I'll own the backup restore drill Friday.",
      parentId: parent.id,
    },
  });

  // Seed reactions on a few messages
  const someMsgs = await prisma.message.findMany({
    where: { channelId: general.id, parentId: null },
    take: 5,
    orderBy: { createdAt: "desc" },
  });
  const emojiCycle = ["👍", "❤️", "😂", "🎉"];
  let ei = 0;
  for (const m of someMsgs) {
    await prisma.reaction.create({
      data: {
        messageId: m.id,
        userId: users[ei % users.length]!.id,
        emoji: emojiCycle[ei % emojiCycle.length]!,
      },
    });
    ei++;
  }

  console.log("Seed complete:", { users: users.length, channels: channels.length });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
