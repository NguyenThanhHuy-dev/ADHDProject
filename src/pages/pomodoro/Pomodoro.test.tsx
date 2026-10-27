import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import Pomodoro from './Pomodoro';
import usePomodoroStore from '../../store/pomodoroStore';
import useRewardStore from '../../store/rewardStore';
import useTaskStore from '../../store/taskStore';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  localStorage.clear();
  usePomodoroStore.setState({ sessions: [], currentSession: null });
  useRewardStore.setState({ points: 0 });
  useTaskStore.setState({
    tasks: [
      {
        id: 1,
        title: 'Write report',
        description: '',
        quadrant: 'q1',
        dueDate: null,
        completed: false,
        createdAt: new Date().toISOString(),
      },
    ],
  });
});

afterEach(() => vi.useRealTimers());

describe('Pomodoro timer', () => {
  it('records exactly one session and 10 points when a work session ends, even in StrictMode', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <StrictMode>
        <MemoryRouter>
          <Pomodoro />
        </MemoryRouter>
      </StrictMode>,
    );

    await user.click(screen.getAllByRole('combobox')[0]);
    await user.click(within(await screen.findByRole('listbox')).getByText(/Write report/));
    await user.click(screen.getByRole('button', { name: /start/i }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25 * 60 * 1000 + 1000);
    });

    expect(usePomodoroStore.getState().sessions).toHaveLength(1);
    expect(useRewardStore.getState().points).toBe(10);
    expect(await screen.findByText('Break Time')).toBeInTheDocument();
  });

  it('keeps Start disabled until a task is selected', () => {
    render(
      <MemoryRouter>
        <Pomodoro />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /start/i })).toBeDisabled();
    expect(screen.getByText('25:00')).toBeInTheDocument();
  });
});
