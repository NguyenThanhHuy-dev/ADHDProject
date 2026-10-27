import type { ReactElement } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createQueryClient } from '../api/queryClient';

type Reply = { status?: number; body?: unknown };
type Handler = Reply | ((req: { body: unknown; params: Record<string, string> }) => Reply);

export interface Call {
  method: string;
  path: string;
  body: unknown;
}

const compile = (pattern: string) => {
  const names: string[] = [];
  const source = pattern.replace(/:([a-z]+)/gi, (_, name: string) => {
    names.push(name);
    return '([^/]+)';
  });
  return { regex: new RegExp(`^${source}$`), names };
};

/**
 * Replaces `fetch` with an in-memory fake. Keys look like "POST /sessions/:id/complete" (no "/api"
 * prefix, no query string). Unknown routes answer 404 so a missing mock fails loudly.
 */
export const mockApi = (routes: Record<string, Handler>) => {
  const calls: Call[] = [];
  const table = Object.entries(routes).map(([key, handler]) => {
    const [method, pattern] = key.split(' ');
    return { method, handler, ...compile(pattern) };
  });

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const path = input.replace(/^\/api/, '').split('?')[0];
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ method, path, body });

      for (const route of table) {
        const match = route.method === method && route.regex.exec(path);
        if (!match) continue;
        const params = Object.fromEntries(route.names.map((n, i) => [n, match[i + 1]]));
        const reply =
          typeof route.handler === 'function' ? route.handler({ body, params }) : route.handler;
        const status = reply.status ?? 200;
        return {
          ok: status < 400,
          status,
          json: async () => reply.body,
        } as Response;
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: `not mocked: ${method} ${path}` }),
      } as Response;
    }),
  );

  return {
    calls,
    count: (method: string, path: string) =>
      calls.filter((c) => c.method === method && c.path === path).length,
  };
};

export const testUser = { id: 'u1', email: 'ada@example.com', displayName: 'Ada', timezone: 'UTC' };

/** Everything a signed-in user needs for pages to render with empty data. */
export const emptyAccount: Record<string, Handler> = {
  'GET /auth/me': { body: testUser },
  'GET /tasks': { body: [] },
  'GET /sessions': { body: [] },
  'GET /sessions/streak': {
    body: { currentStreak: 0, lastStreakDate: null, goalReachedToday: false, nextBonus: 0 },
  },
  'GET /points': { body: { balance: 0, history: [] } },
  'GET /rewards/inventory': { body: [] },
  'GET /rewards/catalog': { body: { cost: 30, rewards: [] } },
  'GET /stats/heatmap': {
    body: { timeZone: 'UTC', from: '2030-01-01', to: '2030-01-07', days: [] },
  },
  'GET /stats/hours': { body: { timeZone: 'UTC', hours: [], bestHour: null } },
  'GET /stats/weekly': { body: { timeZone: 'UTC', weeks: [] } },
  'GET /stats/overview': {
    body: {
      timeZone: 'UTC',
      tasks: { done: 0, open: 0, completionRate: 0, byQuadrant: [] },
      focus: {
        totalMinutes: 0,
        totalSessions: 0,
        activeDays: 0,
        avgMinutesPerActiveDay: 0,
        bestDay: null,
        longestStreakDays: 0,
      },
    },
  },
};

export const renderWithProviders = (ui: ReactElement, route = '/') =>
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
