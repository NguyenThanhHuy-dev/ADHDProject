import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NewTask, QuadrantId, Task } from '../types';

interface TaskState {
  tasks: Task[];
  addTask: (task: NewTask) => void;
  updateTask: (id: number, updates: Partial<Task>) => void;
  deleteTask: (id: number) => void;
  completeTask: (id: number) => void;
  getTasksByQuadrant: (quadrant: QuadrantId) => Task[];
  getCompletedTasks: () => Task[];
}

const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      addTask: (task) =>
        set((state) => ({
          tasks: [
            ...state.tasks,
            {
              id: Date.now(),
              ...task,
              completed: false,
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((task) => (task.id === id ? { ...task, ...updates } : task)),
        })),
      deleteTask: (id) => set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) })),
      completeTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? { ...task, completed: true, completedAt: new Date().toISOString() }
              : task,
          ),
        })),
      getTasksByQuadrant: (quadrant) =>
        get().tasks.filter((task) => task.quadrant === quadrant && !task.completed),
      getCompletedTasks: () => get().tasks.filter((task) => task.completed),
    }),
    { name: 'task-storage' },
  ),
);

export default useTaskStore;
