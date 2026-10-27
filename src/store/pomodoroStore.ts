import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PomodoroSession } from '../types';

export interface PomodoroSettings {
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsUntilLongBreak: number;
}

interface PomodoroState {
  sessions: PomodoroSession[];
  currentSession: PomodoroSession | null;
  settings: PomodoroSettings;
  currentStreak: number;
  lastStreakDate: string | null;
  startSession: (taskId: PomodoroSession['taskId']) => void;
  completeSession: () => void;
  updateSettings: (newSettings: Partial<PomodoroSettings>) => void;
  getSessionHistory: () => PomodoroSession[];
  getSessionsByTask: (taskId: PomodoroSession['taskId']) => PomodoroSession[];
  addSession: (session: PomodoroSession) => { streak: number; streakPoints: number };
  getStreakInfo: () => {
    currentStreak: number;
    lastStreakDate: string | null;
    streakPoints: number;
  };
}

const usePomodoroStore = create<PomodoroState>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSession: null,
      settings: {
        workDuration: 25 * 60, // 25 minutes in seconds
        shortBreakDuration: 5 * 60, // 5 minutes in seconds
        longBreakDuration: 15 * 60, // 15 minutes in seconds
        sessionsUntilLongBreak: 4,
      },
      currentStreak: 0,
      lastStreakDate: null,
      startSession: (taskId) =>
        set({
          currentSession: {
            id: Date.now(),
            taskId,
            startTime: new Date().toISOString(),
            type: 'work',
            completed: false,
          },
        }),
      completeSession: () =>
        set((state) => ({
          sessions: state.currentSession
            ? [
                ...state.sessions,
                { ...state.currentSession, endTime: new Date().toISOString(), completed: true },
              ]
            : state.sessions,
          currentSession: null,
        })),
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      getSessionHistory: () => get().sessions,
      getSessionsByTask: (taskId) => get().sessions.filter((session) => session.taskId === taskId),
      addSession: (session) => {
        const today = new Date().toISOString().split('T')[0];
        const { sessions, currentStreak, lastStreakDate } = get();

        // Calculate total concentration time for today
        const todaySessions = sessions.filter(
          (s) => new Date(s.startTime).toISOString().split('T')[0] === today,
        );
        const todayTotalMinutes =
          todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0) + (session.duration || 0);

        // Update streak
        let newStreak = currentStreak;
        let newLastStreakDate = lastStreakDate;

        if (todayTotalMinutes >= 60) {
          if (!lastStreakDate) {
            // First day of streak
            newStreak = 1;
            newLastStreakDate = today;
          } else {
            const lastDate = new Date(lastStreakDate);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            if (lastDate.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]) {
              // Consecutive day
              newStreak = currentStreak + 1;
              newLastStreakDate = today;
            } else if (lastDate.toISOString().split('T')[0] !== today) {
              // Streak broken
              newStreak = 1;
              newLastStreakDate = today;
            }
          }
        } else {
          // Not enough minutes today, streak broken
          newStreak = 0;
          newLastStreakDate = null;
        }

        set({
          sessions: [...sessions, session],
          currentStreak: newStreak,
          lastStreakDate: newLastStreakDate,
        });

        return {
          streak: newStreak,
          streakPoints: newStreak >= 2 ? newStreak * 10 : 0,
        };
      },
      getStreakInfo: () => {
        const { currentStreak, lastStreakDate } = get();
        return {
          currentStreak,
          lastStreakDate,
          streakPoints: currentStreak >= 2 ? currentStreak * 10 : 0,
        };
      },
    }),
    {
      name: 'pomodoro-storage',
    },
  ),
);

export default usePomodoroStore;
