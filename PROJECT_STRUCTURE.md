# Project Structure

```
src/
├── components/        # Shared UI
│   ├── layout/        # App shell (Layout.tsx)
│   ├── StatCard.tsx   # KPI card used by Dashboard and Profile
│   └── DonutCard.tsx  # Donut chart card used by Profile
├── pages/             # One folder per route
│   ├── auth/          # sign-in and registration
│   ├── dashboard/
│   ├── insights/      # heatmap, best hour, weekly trend
│   ├── pomodoro/      # includes Pomodoro.test.tsx
│   ├── tasks/
│   ├── rewards/
│   ├── profile/
│   └── settings/
├── api/               # fetch client, React Query hooks, mappers, legacy import, push subscription
├── sw.ts, sw/         # service worker (offline shell, push) and its testable logic
├── store/             # Zustand stores for UI-only state (theme, sound, notifications)
├── test/setup.ts      # Vitest setup (jsdom polyfills)
├── theme.ts           # MUI theme (light and dark)
├── types.ts           # Shared domain types
├── App.tsx            # Theme provider and routes (pages are lazy-loaded)
└── main.tsx           # Entry point
public/                # favicon, manifest, sounds
docs/screenshots/      # Images used by README
server/                # REST API (Fastify + Drizzle + PostgreSQL)
├── src/routes/        # auth, tasks, steps, sessions, points, rewards, stats, import
├── src/domain/        # points ledger, streak, gacha, stats and recurrence rules (no HTTP)
├── src/jobs/          # overdue penalty, push reminders and the scheduler
├── src/services/      # Anthropic client (step suggestions), Web Push sender
├── src/db/            # schema, client, migrate
├── drizzle/           # generated SQL migrations
└── test/              # API tests (in-memory Postgres)
docker-compose.yml     # Postgres for development; `--profile full` adds the API and the web app
Dockerfile, nginx.conf # web image (static build behind nginx, proxies /api)
docs/API.md            # endpoint reference
```

Guidelines:

- Page-specific components stay in the page folder; shared ones go in `components/`.
- Server data goes through the hooks in `src/api/hooks.ts` (React Query); Zustand only holds UI preferences.
- Domain types are defined once in `src/types.ts`.
- Tests sit next to the code they cover (`*.test.ts(x)`); web tests fake `fetch` with `src/test/mockApi.tsx`.
- Static images go in `src/assets/`. The images there are not referenced by any page yet.
