import { clearLegacyData, readLegacyTasks } from './legacy';

const storageWith = (items: Record<string, string>) => {
  const store = new Map(Object.entries(items));
  return {
    getItem: (k: string) => store.get(k) ?? null,
    removeItem: (k: string) => void store.delete(k),
    has: (k: string) => store.has(k),
  } as unknown as Storage & { has: (k: string) => boolean };
};

const legacy = (tasks: object[]) => JSON.stringify({ state: { tasks }, version: 0 });

describe('legacy localStorage import', () => {
  it('converts old tasks and skips invalid ones', () => {
    const storage = storageWith({
      'task-storage': legacy([
        {
          id: 1,
          title: ' Old task ',
          description: 'd',
          quadrant: 'q2',
          dueDate: '2030-01-02T10:30',
          completed: false,
          createdAt: '2029-12-30T00:00:00.000Z',
        },
        {
          id: 2,
          title: 'Done',
          quadrant: 'q1',
          completed: true,
          completedAt: '2029-12-31T00:00:00.000Z',
        },
        { id: 3, title: '', quadrant: 'q1' },
        { id: 4, title: 'Bad quadrant', quadrant: 'q9' },
      ]),
    });
    const tasks = readLegacyTasks(storage);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({ title: 'Old task', quadrant: 'q2', completedAt: null });
    expect(tasks[0].dueAt).toBe(new Date('2030-01-02T10:30').toISOString());
    expect(tasks[1].completedAt).toBe('2029-12-31T00:00:00.000Z');
  });

  it('survives missing or corrupt data', () => {
    expect(readLegacyTasks(storageWith({}))).toEqual([]);
    expect(readLegacyTasks(storageWith({ 'task-storage': '{not json' }))).toEqual([]);
    expect(readLegacyTasks(storageWith({ 'task-storage': JSON.stringify({ state: {} }) }))).toEqual(
      [],
    );
  });

  it('clears every legacy key', () => {
    const storage = storageWith({
      'task-storage': '{}',
      'pomodoro-storage': '{}',
      'reward-storage': '{}',
    });
    clearLegacyData(storage);
    expect(['task-storage', 'pomodoro-storage', 'reward-storage'].some((k) => storage.has(k))).toBe(
      false,
    );
  });
});
