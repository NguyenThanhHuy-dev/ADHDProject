# Project Structure

```
src/
├── components/        # Shared UI
│   ├── layout/        # App shell (Layout.tsx)
│   ├── StatCard.tsx   # KPI card used by Dashboard and Profile
│   └── DonutCard.tsx  # Donut chart card used by Profile
├── pages/             # One folder per route
│   ├── dashboard/
│   ├── pomodoro/      # includes Pomodoro.test.tsx
│   ├── tasks/
│   ├── rewards/
│   ├── profile/
│   └── settings/
├── store/             # Zustand stores (+ __tests__/)
├── test/setup.ts      # Vitest setup (jsdom polyfills)
├── theme.ts           # MUI theme (light and dark)
├── types.ts           # Shared domain types
├── App.tsx            # Theme provider and routes (pages are lazy-loaded)
└── main.tsx           # Entry point
public/                # favicon, manifest, sounds
docs/screenshots/      # Images used by README
```

Guidelines:

- Page-specific components stay in the page folder; shared ones go in `components/`.
- State lives in Zustand stores; persisted stores use `localStorage` (`*-storage` keys).
- Domain types are defined once in `src/types.ts`.
- Tests sit next to the code they cover (`*.test.ts(x)`), or in `__tests__/` for stores.
- Static images go in `src/assets/`. The images there are not referenced by any page yet.
