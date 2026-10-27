import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const quadrantEnum = pgEnum('quadrant', ['q1', 'q2', 'q3', 'q4']);
export const sessionStatusEnum = pgEnum('session_status', ['active', 'completed', 'abandoned']);
export const rarityEnum = pgEnum('rarity', ['common', 'rare', 'epic', 'legendary']);
export const ledgerReasonEnum = pgEnum('ledger_reason', [
  'task_complete',
  'session_complete',
  'streak_bonus',
  'gacha_spend',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  timezone: text('timezone').notNull().default('UTC'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    quadrant: quadrantEnum('quadrant').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('tasks_user_completed_idx').on(t.userId, t.completedAt)],
);

export const pomodoroSessions = pgTable(
  'pomodoro_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    plannedMinutes: integer('planned_minutes').notNull(),
    status: sessionStatusEnum('status').notNull().default('active'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    index('sessions_user_status_idx').on(t.userId, t.status, t.completedAt),
    // Backstop for concurrent starts: at most one running session per user.
    uniqueIndex('one_active_session_per_user')
      .on(t.userId)
      .where(sql`${t.status} = 'active'`),
  ],
);

// Append-only: a user's balance is the sum of their rows, so points cannot be edited in place.
export const pointLedger = pgTable(
  'point_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    reason: ledgerReasonEnum('reason').notNull(),
    refId: uuid('ref_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The same task or session can only be paid out once, which makes retries safe.
    unique('ledger_once_per_ref').on(t.userId, t.reason, t.refId),
    index('ledger_user_created_idx').on(t.userId, t.createdAt),
  ],
);

export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rewardId: integer('reward_id').notNull(),
    rarity: rarityEnum('rarity').notNull(),
    obtainedAt: timestamp('obtained_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('inventory_user_idx').on(t.userId)],
);

export const userStreaks = pgTable('user_streaks', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  currentStreak: integer('current_streak').notNull().default(0),
  lastStreakDate: date('last_streak_date', { mode: 'string' }),
});

export type User = typeof users.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type PomodoroSession = typeof pomodoroSessions.$inferSelect;
