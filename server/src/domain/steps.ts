import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/types';
import { taskSteps, type TaskStep } from '../db/schema';
import type { Tx } from './points';

export const MAX_STEPS_PER_TASK = 30;

export interface StepView {
  id: string;
  title: string;
  position: number;
  done: boolean;
}

export const toStepView = (s: TaskStep): StepView => ({
  id: s.id,
  title: s.title,
  position: s.position,
  done: s.doneAt !== null,
});

/** Steps for several tasks in one query, keyed by task id. */
export const stepsByTask = async (
  executor: Db | Tx,
  userId: string,
  taskIds: string[],
): Promise<Map<string, StepView[]>> => {
  const grouped = new Map<string, StepView[]>();
  if (taskIds.length === 0) return grouped;
  const rows = await executor
    .select()
    .from(taskSteps)
    .where(and(eq(taskSteps.userId, userId), inArray(taskSteps.taskId, taskIds)))
    .orderBy(asc(taskSteps.position), asc(taskSteps.createdAt));
  for (const row of rows) {
    const list = grouped.get(row.taskId) ?? [];
    list.push(toStepView(row));
    grouped.set(row.taskId, list);
  }
  return grouped;
};
