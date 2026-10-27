import usePomodoroStore from '../pomodoroStore';

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString();
};

const session = (offset: number, duration: number, id = Math.random()) => ({
  id,
  taskId: 1,
  startTime: day(offset),
  endTime: day(offset),
  duration,
  type: 'work' as const,
  completed: true,
});

beforeEach(() =>
  usePomodoroStore.setState({
    sessions: [],
    currentSession: null,
    currentStreak: 0,
    lastStreakDate: null,
  }),
);

describe('pomodoroStore streak', () => {
  it('starts a streak after 60 focus minutes in a day', () => {
    const result = usePomodoroStore.getState().addSession(session(0, 60));
    expect(result).toEqual({ streak: 1, streakPoints: 0 });
  });

  it('does not start a streak under 60 minutes', () => {
    const result = usePomodoroStore.getState().addSession(session(0, 25));
    expect(result.streak).toBe(0);
  });

  it('extends the streak on consecutive days and awards points from day 2', () => {
    usePomodoroStore.setState({
      currentStreak: 1,
      lastStreakDate: day(-1).split('T')[0],
    });
    const result = usePomodoroStore.getState().addSession(session(0, 60));
    expect(result).toEqual({ streak: 2, streakPoints: 20 });
  });

  it('resets the streak after a gap', () => {
    usePomodoroStore.setState({
      currentStreak: 5,
      lastStreakDate: day(-3).split('T')[0],
    });
    expect(usePomodoroStore.getState().addSession(session(0, 60)).streak).toBe(1);
  });
});

describe('pomodoroStore sessions', () => {
  it('completeSession without an active session adds nothing', () => {
    usePomodoroStore.getState().completeSession();
    expect(usePomodoroStore.getState().sessions).toHaveLength(0);
  });

  it('filters sessions by task', () => {
    usePomodoroStore.setState({
      sessions: [session(0, 25, 1), { ...session(0, 25, 2), taskId: 2 }],
    });
    expect(usePomodoroStore.getState().getSessionsByTask(2)).toHaveLength(1);
  });
});
