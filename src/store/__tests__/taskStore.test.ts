import useTaskStore from '../taskStore';

const base = { title: 'Write report', description: '', quadrant: 'q1' as const, dueDate: null };

beforeEach(() => useTaskStore.setState({ tasks: [] }));

describe('taskStore', () => {
  it('adds a task as not completed', () => {
    useTaskStore.getState().addTask(base);
    const [task] = useTaskStore.getState().tasks;
    expect(task).toMatchObject({ title: 'Write report', completed: false });
    expect(task.createdAt).toBeTruthy();
  });

  it('completes a task and moves it out of its quadrant', () => {
    useTaskStore.getState().addTask(base);
    const { id } = useTaskStore.getState().tasks[0];
    useTaskStore.getState().completeTask(id);
    expect(useTaskStore.getState().getTasksByQuadrant('q1')).toHaveLength(0);
    expect(useTaskStore.getState().getCompletedTasks()[0].completedAt).toBeTruthy();
  });

  it('updates and deletes by id', () => {
    useTaskStore.getState().addTask(base);
    const { id } = useTaskStore.getState().tasks[0];
    useTaskStore.getState().updateTask(id, { quadrant: 'q4' });
    expect(useTaskStore.getState().tasks[0].quadrant).toBe('q4');
    useTaskStore.getState().deleteTask(id);
    expect(useTaskStore.getState().tasks).toHaveLength(0);
  });
});
