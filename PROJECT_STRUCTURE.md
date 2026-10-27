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
│   ├── pomodoro/      # includes Pomodoro.test.tsx
│   ├── tasks/
│   ├── rewards/
│   ├── profile/
│   └── settings/
├── api/               # fetch client, React Query hooks, mappers, legacy import
├── store/             # Zustand stores for UI-only state (theme, sound, notifications)
├── test/setup.ts      # Vitest setup (jsdom polyfills)
├── theme.ts           # MUI theme (light and dark)
├── types.ts           # Shared domain types
├── App.tsx            # Theme provider and routes (pages are lazy-loaded)
└── main.tsx           # Entry point
public/                # favicon, manifest, sounds
docs/screenshots/      # Images used by README
server/                # REST API (Fastify + Drizzle + PostgreSQL)
├── src/routes/        # auth, tasks, sessions, points, rewards
├── src/domain/        # points ledger, streak and gacha rules (no HTTP)
├── src/db/            # schema, client, migrate
├── drizzle/           # generated SQL migrations
└── test/              # API tests (in-memory Postgres)
docker-compose.yml     # Postgres for local development
```

Guidelines:

- Page-specific components stay in the page folder; shared ones go in `components/`.
- Server data goes through the hooks in `src/api/hooks.ts` (React Query); Zustand only holds UI preferences.
- Domain types are defined once in `src/types.ts`.
- Tests sit next to the code they cover (`*.test.ts(x)`); web tests fake `fetch` with `src/test/mockApi.tsx`.
- Static images go in `src/assets/`. The images there are not referenced by any page yet.
