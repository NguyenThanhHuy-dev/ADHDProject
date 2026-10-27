import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import Pomodoro from './Pomodoro';
import { emptyAccount, mockApi, renderWithProviders } from '../../test/mockApi';

const task = {
  id: 't1',
  title: 'Write report',
  description: '',
  quadrant: 'q1',
  recurrence: 'none',
  steps: [],
  dueAt: null,
  completedAt: null,
  createdAt: '2030-01-01T00:00:00.000Z',
};

const routes = () => ({
  ...emptyAccount,
  'GET /tasks': { body: [task] },
  'POST /sessions/start': { status: 201, body: { id: 's1' } },
  'POST /sessions/:id/complete': {
    body: { alreadyCompleted: false, pointsAwarded: 10, balance: 10, streak: 0 },
  },
  'POST /sessions/:id/cancel': { body: { id: 's1', status: 'abandoned' } },
});

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

const pickTaskAndStart = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getAllByRole('combobox')[0]);
  await user.click(within(await screen.findByRole('listbox')).getByText(/Write report/));
  await user.click(screen.getByRole('button', { name: /start/i }));
};

describe('Pomodoro timer', () => {
  it('starts one server session, completes it exactly once and shows the payout, even in StrictMode', async () => {
    const api = mockApi(routes());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(
      <StrictMode>
        <Pomodoro />
      </StrictMode>,
    );

    await pickTaskAndStart(user);
    await waitFor(() => expect(api.count('POST', '/sessions/start')).toBe(1));
    expect(api.calls.find((c) => c.path === '/sessions/start')?.body).toEqual({
      taskId: 't1',
      plannedMinutes: 25,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25 * 60 * 1000 + 1000);
    });

    await waitFor(() => expect(api.count('POST', '/sessions/s1/complete')).toBe(1));
    expect(await screen.findByText('Session complete: +10 points')).toBeInTheDocument();
    expect(await screen.findByText('Break Time')).toBeInTheDocument();
  });

  it('cancels the server session when the timer is reset', async () => {
    const api = mockApi(routes());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<Pomodoro />);

    await pickTaskAndStart(user);
    await waitFor(() => expect(api.count('POST', '/sessions/start')).toBe(1));
    await user.click(screen.getByRole('button', { name: /reset/i }));
    await waitFor(() => expect(api.count('POST', '/sessions/s1/cancel')).toBe(1));
    expect(api.count('POST', '/sessions/s1/complete')).toBe(0);
  });

  it('keeps Start disabled until a task is selected', async () => {
    mockApi(routes());
    renderWithProviders(<Pomodoro />);
    expect(screen.getByRole('button', { name: /start/i })).toBeDisabled();
    expect(screen.getByText('25:00')).toBeInTheDocument();
  });

  it('stops the timer and explains when the server refuses to start a session', async () => {
    mockApi({
      ...routes(),
      'POST /sessions/start': { status: 404, body: { error: 'Task not found' } },
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<Pomodoro />);
    await pickTaskAndStart(user);
    expect(await screen.findByText('Task not found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
  });
});
