import type { InventoryItem, PomodoroSession, Reward, Task, TaskInput } from '../types';

export interface ApiTask {
  id: string;
  title: string;
  description: string;
  quadrant: Task['quadrant'];
  recurrence: Task['recurrence'];
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ApiSession {
  id: string;
  taskId: string | null;
  plannedMinutes: number;
  startedAt: string;
  completedAt: string | null;
}

export interface ApiInventoryItem extends Omit<Reward, 'id'> {
  id: string;
  rewardId: number;
  obtainedAt: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO instant to the local "YYYY-MM-DDTHH:mm" string the form and date helpers expect. */
export const isoToLocal = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const toUiTask = (t: ApiTask): Task => ({
  id: t.id,
  title: t.title,
  description: t.description,
  quadrant: t.quadrant,
  recurrence: t.recurrence,
  dueDate: t.dueAt ? isoToLocal(t.dueAt) : null,
  completed: t.completedAt !== null,
  completedAt: t.completedAt ?? undefined,
  createdAt: t.createdAt,
});

/** A local "YYYY-MM-DDTHH:mm" due date becomes an absolute instant, so the server never guesses the zone. */
export const toApiTask = (t: Partial<TaskInput>) => ({
  ...t,
  ...(t.dueDate !== undefined && {
    dueAt: t.dueDate ? new Date(t.dueDate).toISOString() : null,
  }),
  dueDate: undefined,
});

export const toUiSession = (s: ApiSession): PomodoroSession => ({
  id: s.id,
  taskId: s.taskId,
  startTime: s.startedAt,
  endTime: s.completedAt ?? s.startedAt,
  duration: s.plannedMinutes,
  type: 'work',
});

export const toInventoryItem = (i: ApiInventoryItem): InventoryItem => ({
  id: i.rewardId,
  name: i.name,
  description: i.description,
  rarity: i.rarity,
  image: i.image,
  inventoryId: i.id,
  obtainedAt: i.obtainedAt,
});
