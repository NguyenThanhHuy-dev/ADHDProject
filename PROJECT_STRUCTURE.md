# Project Structure

```
src/
├── assets/            # Images
├── components/layout/ # App shell (Layout.tsx)
├── pages/             # One folder per route
│   ├── dashboard/
│   ├── pomodoro/
│   ├── tasks/
│   ├── rewards/
│   ├── profile/
│   └── settings/
├── store/             # Zustand stores (+ __tests__/)
├── test/setup.ts      # Vitest setup (jsdom polyfills)
├── types.ts           # Shared domain types
├── App.tsx            # Theme + routes
└── main.tsx           # Entry point
public/sounds/         # Audio cues
```

Guidelines:

- Page-specific components stay in the page folder; shared ones go in `components/`.
- State lives in Zustand stores; persisted stores use `localStorage` (`*-storage` keys).
- Domain types are defined once in `src/types.ts`.
