# ADHD Focus App

[![CI](https://github.com/NguyenThanhHuy-dev/ADHDProject/actions/workflows/ci.yml/badge.svg)](https://github.com/NguyenThanhHuy-dev/ADHDProject/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A full-stack productivity app built around how ADHD brains work: short focus sessions, a priority
matrix that decides what to do first, small rewards for progress, and gentle reminders that reach you
even when the tab is closed.

Everything that earns points is verified on the server, so the motivation system cannot be gamed by
editing the browser.

![Dashboard](docs/screenshots/dashboard.png)

## Screenshots

![Insights](docs/screenshots/insights.png)

| Sign in                                | Tasks (Eisenhower matrix)            |
| -------------------------------------- | ------------------------------------ |
| ![Sign in](docs/screenshots/login.png) | ![Tasks](docs/screenshots/tasks.png) |

| Pomodoro timer                             | Rewards                                  |
| ------------------------------------------ | ---------------------------------------- |
| ![Pomodoro](docs/screenshots/pomodoro.png) | ![Rewards](docs/screenshots/rewards.png) |

| Profile                                  | Dark mode                                         |
| ---------------------------------------- | ------------------------------------------------- |
| ![Profile](docs/screenshots/profile.png) | ![Dark mode](docs/screenshots/dashboard-dark.png) |

<img src="docs/screenshots/mobile.png" width="260" alt="Mobile dashboard" />

## Features

**Focus**

- Pomodoro timer with 15 to 120 minute sessions, linked to the task you are working on
- Streaks counted per day in your own time zone: 60 focus minutes keeps it alive, with bonus points from day 2
- Notification when a session ends, even with the tab closed

**Tasks**

- Eisenhower matrix (urgent and important, in four quadrants) so the next task is obvious
- Small checklists per task, with optional AI suggestions that split a big task into 3 to 8 concrete steps
- Repeating tasks (daily or weekly) that keep their local time across daylight saving changes
- Reminder when a task is due within the hour, and a point penalty job for missed deadlines

**Motivation**

- Points for finished tasks and sessions, spent on a gacha with four rarities
- Every point movement is a row in an append-only ledger you can inspect

**Insights**

- Focus calendar (GitHub-style heatmap), best time of day, weekly trend, completion by priority

**Platform**

- Installable as an app (PWA), the shell works offline
- Light and dark theme that follow your system, and a reduce-motion setting

## Tech stack

| Layer    | Choices                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------- |
| Web      | React 18, TypeScript, Vite, MUI, TanStack Query, Zustand (UI preferences only), Recharts          |
| API      | Node 22, Fastify, Zod validation, Drizzle ORM, argon2id password hashing, JWT in httpOnly cookies |
| Database | PostgreSQL 16 (migrations with drizzle-kit)                                                       |
| Realtime | Web Push with VAPID, a service worker built with Workbox                                          |
| AI       | Anthropic API for step suggestions, optional                                                      |
| Quality  | Vitest and Testing Library, ESLint, Prettier, GitHub Actions, Docker                              |

```text
 Browser (React PWA)                      Server (one Fastify process)               PostgreSQL
┌──────────────────────┐   REST + cookie  ┌──────────────────────────────┐          ┌───────────┐
│ pages, TanStack Query│ ───────────────▶ │ routes ─▶ domain rules       │ ───────▶ │ users     │
│ service worker       │ ◀─────────────── │ (points, streaks, gacha,     │ ◀─────── │ tasks     │
└──────────┬───────────┘                  │  stats, recurrence)          │          │ sessions  │
           ▲                              │ scheduler (every minute):    │          │ ledger    │
           │ Web Push                     │  overdue penalties, reminders│          │ ...       │
           └──────────────────────────────┴──────────────────────────────┘          └───────────┘
```

## Quick start

### Everything in Docker

```bash
JWT_SECRET=$(openssl rand -hex 32) docker compose --profile full up --build
```

Open http://localhost:8080 and create an account. The API applies database migrations on start, and
PostgreSQL keeps its data in a Docker volume.

### Local development

You need Node 22 and Docker (for PostgreSQL).

```bash
npm install
cp server/.env.example server/.env   # then set JWT_SECRET to a random string of 32+ characters
npm run db:up                        # PostgreSQL 16 on port 5433
npm run db:migrate                   # create the tables
npm run dev:server                   # API on http://localhost:3001
npm run dev                          # web on http://localhost:5173, proxies /api to the API
```

Tasks saved in the browser before accounts existed show an import banner on first sign-in. Points and
rewards are not imported: they only come from activity the server has verified.

## Configuration

The API reads `server/.env` (see `server/.env.example`). With Docker, pass the same names as
environment variables.

| Variable                                                 | Default                | Purpose                                                                                                                          |
| -------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                           | (required)             | PostgreSQL connection string                                                                                                     |
| `JWT_SECRET`                                             | (required)             | Signs session tokens, at least 32 characters                                                                                     |
| `PORT`, `CORS_ORIGIN`                                    | `3001`, local web      | Where the API listens and which origin may call it                                                                               |
| `TRUST_PROXY`                                            | `false`                | Set `true` behind nginx or a load balancer                                                                                       |
| `JOBS_ENABLED`, `JOBS_INTERVAL_MINUTES`                  | `true`, `1`            | Background jobs: overdue penalties and push reminders                                                                            |
| `ANTHROPIC_API_KEY`, `AI_MODEL`                          | off, `claude-opus-5-5` | Enables "Suggest steps with AI". A smaller model such as `claude-haiku-5-5` is cheaper. Without a key the button is hidden       |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | off                    | Enables push notifications. Create keys with `npx web-push generate-vapid-keys`; the subject looks like `mailto:you@example.com` |

Push works on `localhost` and on HTTPS only, and on iPhone only for an app added to the Home Screen.

## Scripts

| Command                                    | What it does                                    |
| ------------------------------------------ | ----------------------------------------------- |
| `npm run dev` / `npm run dev:server`       | Web dev server / API in watch mode              |
| `npm run build`                            | Typecheck and build the web app                 |
| `npm test` / `npm run test:server`         | Web tests / API tests                           |
| `npm run lint`                             | ESLint for the whole repository                 |
| `npm run typecheck` / `typecheck:server`   | TypeScript checks, including the service worker |
| `npm run db:up` / `db:down` / `db:migrate` | Start or stop PostgreSQL, apply migrations      |
| `npm run format`                           | Prettier                                        |

After changing `server/src/db/schema.ts`, run `npx drizzle-kit generate` inside `server/` and commit the
new migration.

## Testing

- **API tests** run against an in-memory PostgreSQL (PGlite), so they need no Docker. They cover
  authorization between users, idempotent payouts, parallel gacha pulls, time zones and daylight saving,
  the background jobs with a controllable clock, and real Web Push delivery to a local HTTPS endpoint.
- **Web tests** render the pages with a fake `fetch`. They guard against pages crashing on mount,
  check the exact requests the UI sends, and cover the timer, steps, push settings and the sign-in flow.
- **GitHub Actions** runs lint, typechecks, both test suites, applies the migrations to a real
  PostgreSQL and builds the production and Docker images on every push.

## Design decisions

- **Points are a ledger, not a number.** The balance is the sum of append-only rows, and a task or
  session can pay out once (a unique key on user, reason and reference). Retries and double clicks
  cannot pay twice, and a user cannot edit their way to points.
- **The server checks the clock.** A Pomodoro only pays after its planned time has really passed. The
  gacha roll and its payment happen in one transaction that locks the user, so parallel requests cannot
  spend the same points twice (verified with eight simultaneous pulls on PostgreSQL).
- **Time zones are the user's.** Streak days, heatmaps, best hour and repeating deadlines are computed
  in the user's own zone, and PostgreSQL does the calendar arithmetic.
- **Background work is safe to repeat.** Jobs run under a Postgres advisory lock so only one instance
  works at a time. Reminders are marked sent before delivery (at most once), subscriptions the push
  service reports as gone are removed, and slow network calls happen after the lock is released.
- **One server, clear modules.** A single Fastify process with `routes`, `domain`, `jobs` and `services`
  folders. It is a deliberate monolith: one team, one database, nothing that needs to scale
  separately. The domain rules have no HTTP code in them, so they test without a server.
- **Optional integrations fail closed.** Without an AI key or VAPID keys the features switch themselves
  off and the UI hides them, instead of breaking.

## Project layout

```text
src/        web app (pages, API hooks, service worker, tests)
server/     API: routes, domain rules, jobs, services, migrations, tests
docs/       API reference and screenshots
```

More detail in [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md). The endpoint reference is in
[docs/API.md](docs/API.md).

## Not included yet

- A hosted demo. The repository is ready to deploy (Docker images for the API and the web app, health
  check, migrations on start) but nothing is published yet.
- Languages other than English.

## License

[MIT](LICENSE)
