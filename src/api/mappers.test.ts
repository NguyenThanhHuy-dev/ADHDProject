import { isoToLocal, toApiTask, toUiSession, toUiTask, type ApiTask } from './mappers';

const apiTask: ApiTask = {
  id: 't1',
  title: 'Write report',
  description: '',
  quadrant: 'q1',
  dueAt: '2030-01-02T10:30:00.000Z',
  completedAt: null,
  createdAt: '2030-01-01T00:00:00.000Z',
};

describe('task mapping', () => {
  it('turns the server shape into the UI shape', () => {
    const task = toUiTask(apiTask);
    expect(task.completed).toBe(false);
    expect(task.completedAt).toBeUndefined();
    expect(task.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(toUiTask({ ...apiTask, completedAt: '2030-01-03T00:00:00.000Z' }).completed).toBe(true);
  });

  it('keeps the due date stable when it goes to the server and back, in any time zone', () => {
    const local = isoToLocal(apiTask.dueAt!);
    const sent = toApiTask({ dueDate: local });
    expect(sent.dueAt).toBe(apiTask.dueAt);
    expect(isoToLocal(sent.dueAt!)).toBe(local);
  });

  it('sends null to clear a due date and leaves it out of partial updates', () => {
    expect(toApiTask({ dueDate: null }).dueAt).toBeNull();
    expect('dueAt' in toApiTask({ title: 'x' })).toBe(false);
  });
});

describe('session mapping', () => {
  it('uses the planned minutes as the focus time', () => {
    const s = toUiSession({
      id: 's1',
      taskId: null,
      plannedMinutes: 45,
      startedAt: '2030-01-01T09:00:00.000Z',
      completedAt: '2030-01-01T10:10:00.000Z',
    });
    expect(s).toMatchObject({ duration: 45, endTime: '2030-01-01T10:10:00.000Z' });
  });
});
