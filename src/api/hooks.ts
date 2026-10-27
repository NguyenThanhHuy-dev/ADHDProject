import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  HeatmapData,
  HoursData,
  InventoryItem,
  OverviewData,
  WeeklyData,
  LedgerEntry,
  PomodoroSession,
  Reward,
  SessionResult,
  StreakInfo,
  Task,
  TaskInput,
  TaskStep,
  User,
} from '../types';
import { ApiError, api } from './client';
import {
  toApiTask,
  toInventoryItem,
  toUiSession,
  toUiTask,
  type ApiInventoryItem,
  type ApiSession,
  type ApiTask,
} from './mappers';

/**
 * Drops cached account data but keeps the `me` query alive: observers stay attached to the
 * query object, so clearing it would leave the app shell stuck on the old value.
 */
export const resetAccountData = (qc: QueryClient) =>
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });

export const keys = {
  me: ['me'] as const,
  tasks: ['tasks'] as const,
  points: ['points'] as const,
  sessions: ['sessions'] as const,
  streak: ['streak'] as const,
  inventory: ['inventory'] as const,
  catalog: ['catalog'] as const,
  stats: ['stats'] as const,
};

/* ---------- auth ---------- */

export const useMe = () =>
  useQuery({
    queryKey: keys.me,
    // A 401 just means "signed out"; it is not an error for the app shell.
    queryFn: async (): Promise<User | null> => {
      try {
        return await api<User>('GET', '/auth/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: Infinity,
  });

export interface Credentials {
  email: string;
  password: string;
}

export const useLogin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: Credentials) => api<User>('POST', '/auth/login', c),
    onSuccess: (user) => {
      resetAccountData(qc);
      qc.setQueryData(keys.me, user);
    },
  });
};

export const useRegister = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: Credentials & { displayName?: string }) =>
      api<User>('POST', '/auth/register', {
        ...c,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    onSuccess: (user) => {
      resetAccountData(qc);
      qc.setQueryData(keys.me, user);
    },
  });
};

export const useLogout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('POST', '/auth/logout'),
    onSuccess: () => {
      resetAccountData(qc);
      qc.setQueryData(keys.me, null);
    },
  });
};

/* ---------- tasks ---------- */

export const useTasks = () =>
  useQuery({
    queryKey: keys.tasks,
    queryFn: () => api<ApiTask[]>('GET', '/tasks'),
    select: (data): Task[] => data.map(toUiTask),
  });

const useInvalidate = (...queryKeys: (readonly string[])[]) => {
  const qc = useQueryClient();
  return () => Promise.all(queryKeys.map((queryKey) => qc.invalidateQueries({ queryKey })));
};

export const useCreateTask = () => {
  const invalidate = useInvalidate(keys.tasks);
  return useMutation({
    mutationFn: (input: TaskInput) => api<ApiTask>('POST', '/tasks', toApiTask(input)),
    onSuccess: invalidate,
  });
};

export const useUpdateTask = () => {
  const invalidate = useInvalidate(keys.tasks);
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<TaskInput> & { id: string }) =>
      api<ApiTask>('PATCH', `/tasks/${id}`, toApiTask(input)),
    onSuccess: invalidate,
  });
};

export const useDeleteTask = () => {
  const invalidate = useInvalidate(keys.tasks);
  return useMutation({
    mutationFn: (id: string) => api<void>('DELETE', `/tasks/${id}`),
    onSuccess: invalidate,
  });
};

export const useCompleteTask = () => {
  const invalidate = useInvalidate(keys.tasks, keys.points, keys.stats);
  return useMutation({
    mutationFn: (id: string) =>
      api<ApiTask & { pointsAwarded: number }>('POST', `/tasks/${id}/complete`),
    onSuccess: invalidate,
  });
};

export const useImportTasks = () => {
  const invalidate = useInvalidate(keys.tasks);
  return useMutation({
    mutationFn: (tasks: object[]) => api<{ imported: number }>('POST', '/import', { tasks }),
    onSuccess: invalidate,
  });
};

/* ---------- points, sessions, streak ---------- */

export const usePoints = () =>
  useQuery({
    queryKey: keys.points,
    queryFn: () => api<{ balance: number; history: LedgerEntry[] }>('GET', '/points'),
  });

export const useSessions = () =>
  useQuery({
    queryKey: keys.sessions,
    queryFn: () => api<ApiSession[]>('GET', '/sessions?limit=100'),
    select: (data): PomodoroSession[] => data.map(toUiSession),
  });

export const useStreak = () =>
  useQuery({
    queryKey: keys.streak,
    queryFn: () => api<StreakInfo>('GET', '/sessions/streak'),
  });

export const useStartSession = () =>
  useMutation({
    mutationFn: (input: { taskId: string | null; plannedMinutes: number }) =>
      api<{ id: string }>('POST', '/sessions/start', input),
  });

export const useCancelSession = () =>
  useMutation({
    mutationFn: (id: string) => api<unknown>('POST', `/sessions/${id}/cancel`),
  });

export const useCompleteSession = () => {
  const invalidate = useInvalidate(keys.sessions, keys.points, keys.streak, keys.stats);
  return useMutation({
    mutationFn: (id: string) => api<SessionResult>('POST', `/sessions/${id}/complete`),
    onSuccess: invalidate,
  });
};

/* ---------- rewards ---------- */

export const useCatalog = () =>
  useQuery({
    queryKey: keys.catalog,
    queryFn: () => api<{ cost: number; rewards: Reward[] }>('GET', '/rewards/catalog'),
    staleTime: Infinity,
  });

export const useInventory = () =>
  useQuery({
    queryKey: keys.inventory,
    queryFn: () => api<ApiInventoryItem[]>('GET', '/rewards/inventory'),
    select: (data): InventoryItem[] => data.map(toInventoryItem),
  });

export const useGacha = () => {
  const invalidate = useInvalidate(keys.points, keys.inventory);
  return useMutation({
    mutationFn: () =>
      api<{ reward: Reward; inventoryId: string; balance: number }>('POST', '/rewards/gacha'),
    onSuccess: invalidate,
  });
};

/* ---------- stats ---------- */

export const useHeatmap = (weeks = 26) =>
  useQuery({
    queryKey: [...keys.stats, 'heatmap', weeks],
    queryFn: () => api<HeatmapData>('GET', `/stats/heatmap?weeks=${weeks}`),
  });

export const useHours = () =>
  useQuery({
    queryKey: [...keys.stats, 'hours'],
    queryFn: () => api<HoursData>('GET', '/stats/hours'),
  });

export const useWeekly = (weeks = 8) =>
  useQuery({
    queryKey: [...keys.stats, 'weekly', weeks],
    queryFn: () => api<WeeklyData>('GET', `/stats/weekly?weeks=${weeks}`),
  });

export const useOverview = () =>
  useQuery({
    queryKey: [...keys.stats, 'overview'],
    queryFn: () => api<OverviewData>('GET', '/stats/overview'),
  });

/* ---------- task steps and server features ---------- */

export const useFeatures = () =>
  useQuery({
    queryKey: ['features'],
    queryFn: () => api<{ aiSteps: boolean; push: boolean }>('GET', '/features'),
    staleTime: Infinity,
  });

export const useAddSteps = () => {
  const invalidate = useInvalidate(keys.tasks);
  return useMutation({
    mutationFn: ({ taskId, titles }: { taskId: string; titles: string[] }) =>
      api<TaskStep[]>('POST', `/tasks/${taskId}/steps`, { titles }),
    onSuccess: invalidate,
  });
};

export const useUpdateStep = () => {
  const qc = useQueryClient();
  const invalidate = useInvalidate(keys.tasks);
  return useMutation({
    mutationFn: ({
      taskId,
      stepId,
      ...changes
    }: { taskId: string; stepId: string } & Partial<Pick<TaskStep, 'title' | 'done'>>) =>
      api<TaskStep>('PATCH', `/tasks/${taskId}/steps/${stepId}`, changes),
    // Ticking a box should feel instant: show the change now, roll back if the server refuses it.
    onMutate: async ({ taskId, stepId, ...changes }) => {
      await qc.cancelQueries({ queryKey: keys.tasks });
      const previous = qc.getQueryData<ApiTask[]>(keys.tasks);
      qc.setQueryData<ApiTask[]>(keys.tasks, (tasks) =>
        tasks?.map((t) =>
          t.id === taskId
            ? { ...t, steps: t.steps?.map((s) => (s.id === stepId ? { ...s, ...changes } : s)) }
            : t,
        ),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) qc.setQueryData(keys.tasks, context.previous);
    },
    onSettled: invalidate,
  });
};

export const useDeleteStep = () => {
  const invalidate = useInvalidate(keys.tasks);
  return useMutation({
    mutationFn: ({ taskId, stepId }: { taskId: string; stepId: string }) =>
      api<void>('DELETE', `/tasks/${taskId}/steps/${stepId}`),
    onSuccess: invalidate,
  });
};

export const useSuggestSteps = () =>
  useMutation({
    mutationFn: (taskId: string) =>
      api<{ steps: string[] }>('POST', `/tasks/${taskId}/steps/suggest`),
  });
