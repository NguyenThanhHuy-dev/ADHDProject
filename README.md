# ADHD Focus App

Task and focus tool for people with ADHD: Pomodoro timer, Eisenhower-matrix task list,
daily focus streaks and a gacha-style reward system. Data stays in the browser (`localStorage`).

**Stack:** React 18, TypeScript, Vite, MUI, Zustand, Recharts, Vitest, ESLint, Prettier.

## Screenshots

![Dashboard](docs/screenshots/dashboard.png)

| Tasks (Eisenhower matrix)            | Pomodoro timer                             |
| ------------------------------------ | ------------------------------------------ |
| ![Tasks](docs/screenshots/tasks.png) | ![Pomodoro](docs/screenshots/pomodoro.png) |

| Rewards                                  | Profile                                  |
| ---------------------------------------- | ---------------------------------------- |
| ![Rewards](docs/screenshots/rewards.png) | ![Profile](docs/screenshots/profile.png) |

| Dark mode                                         | Mobile                                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| ![Dark mode](docs/screenshots/dashboard-dark.png) | <img src="docs/screenshots/mobile.png" width="260" alt="Mobile dashboard" /> |

## Features

- Pomodoro timer with per-task sessions and configurable work/break length
- Eisenhower matrix (Q1–Q4) with points per quadrant and overdue penalties
- Dashboard charts: tasks completed and focus minutes per day, streak counter
- Rewards: spend points on a gacha with four rarities, inventory view
- Dark mode, sound cues, browser notifications

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script              | Purpose                      |
| ------------------- | ---------------------------- |
| `npm run dev`       | Dev server                   |
| `npm run build`     | Typecheck + production build |
| `npm test`          | Vitest                       |
| `npm run lint`      | ESLint                       |
| `npm run typecheck` | `tsc --noEmit`               |
| `npm run format`    | Prettier                     |

See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for the folder layout.

## Deploy

Import the repo in Vercel (framework preset: Vite). `vercel.json` rewrites all routes to `index.html` for client-side routing.

## Debug helpers (browser console)

```js
localStorage.removeItem('reward-storage'); // reset points and inventory
```

## License

MIT
