export type QuadrantId = 'q1' | 'q2' | 'q3' | 'q4';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type SoundName = 'notification' | 'complete' | 'start' | 'reward';

export interface Task {
  id: number;
  title: string;
  description: string;
  quadrant: QuadrantId;
  dueDate: string | null;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
}

export type NewTask = Pick<Task, 'title' | 'description' | 'quadrant' | 'dueDate'>;

export interface PomodoroSession {
  id: number;
  taskId: number | string | null;
  startTime: string;
  endTime?: string;
  duration?: number;
  type: 'work' | 'break';
  completed: boolean;
}

export interface Reward {
  id: number;
  name: string;
  description: string;
  rarity: Rarity;
  image: string;
}

export type InventoryItem = Reward & { obtainedAt: string };

export interface PointsHistoryEntry {
  [key: string]: unknown;
}
