/** Data written by the app before accounts existed (Zustand `persist` in localStorage). */
const LEGACY_KEYS = ['task-storage', 'pomodoro-storage', 'reward-storage'] as const;

interface LegacyTask {
  title?: unknown;
  description?: unknown;
  quadrant?: unknown;
  dueDate?: unknown;
  completed?: unknown;
  completedAt?: unknown;
  createdAt?: unknown;
}

export interface ImportableTask {
  title: string;
  description: string;
  quadrant: 'q1' | 'q2' | 'q3' | 'q4';
  dueAt: string | null;
  completedAt: string | null;
  createdAt?: string;
}

const isQuadrant = (v: unknown): v is ImportableTask['quadrant'] =>
  v === 'q1' || v === 'q2' || v === 'q3' || v === 'q4';

const toIso = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export const readLegacyTasks = (storage: Storage = localStorage): ImportableTask[] => {
  try {
    const raw = storage.getItem('task-storage');
    if (!raw) return [];
    const tasks = (JSON.parse(raw) as { state?: { tasks?: LegacyTask[] } }).state?.tasks;
    if (!Array.isArray(tasks)) return [];
    return tasks.flatMap((t): ImportableTask[] => {
      if (typeof t.title !== 'string' || !t.title.trim() || !isQuadrant(t.quadrant)) return [];
      const createdAt = toIso(t.createdAt) ?? undefined;
      return [
        {
          title: t.title.trim().slice(0, 200),
          description: typeof t.description === 'string' ? t.description.slice(0, 2000) : '',
          quadrant: t.quadrant,
          dueAt: toIso(t.dueDate),
          completedAt: t.completed
            ? (toIso(t.completedAt) ?? createdAt ?? new Date().toISOString())
            : null,
          createdAt,
        },
      ];
    });
  } catch {
    return [];
  }
};

export const clearLegacyData = (storage: Storage = localStorage) =>
  LEGACY_KEYS.forEach((key) => storage.removeItem(key));
