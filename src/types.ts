export type QuadrantId = 'q1' | 'q2' | 'q3' | 'q4';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type SoundName = 'notification' | 'complete' | 'start' | 'reward';

export interface User {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
}

/** Task as the UI uses it; `dueDate` is a local "YYYY-MM-DDTHH:mm" string. */
export interface Task {
  id: string;
  title: string;
  description: string;
  quadrant: QuadrantId;
  dueDate: string | null;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

export interface TaskInput {
  title: string;
  description: string;
  quadrant: QuadrantId;
  dueDate: string | null;
}

export interface PomodoroSession {
  id: string;
  taskId: string | null;
  startTime: string;
  endTime: string;
  duration: number;
  type: 'work';
}

export interface Reward {
  id: number;
  name: string;
  description: string;
  rarity: Rarity;
  image: string;
}

export type InventoryItem = Reward & { inventoryId: string; obtainedAt: string };

export interface LedgerEntry {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
}

export interface StreakInfo {
  currentStreak: number;
  lastStreakDate: string | null;
  goalReachedToday: boolean;
  nextBonus: number;
}

export interface SessionResult {
  alreadyCompleted: boolean;
  pointsAwarded: number;
  balance: number;
  streak: number;
}
