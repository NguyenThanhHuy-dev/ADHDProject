import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskList from './TaskList';
import { emptyAccount, mockApi, renderWithProviders } from '../../test/mockApi';

const task = (over: object = {}) => ({
  id: 't1',
  title: 'Write report',
  description: 'Draft',
  quadrant: 'q1',
  dueAt: null,
  completedAt: null,
  createdAt: '2030-01-01T00:00:00.000Z',
  ...over,
});

describe('TaskList', () => {
  it('lists tasks under their quadrant', async () => {
    mockApi({
      ...emptyAccount,
      'GET /tasks': { body: [task(), task({ id: 't2', title: 'Tidy desk', quadrant: 'q4' })] },
    });
    renderWithProviders(<TaskList />);
    expect(await screen.findByText('Write report')).toBeInTheDocument();
    expect(screen.getByText('Tidy desk')).toBeInTheDocument();
  });

  it('creates a task with the chosen quadrant and an absolute due time', async () => {
    const api = mockApi({ ...emptyAccount, 'POST /tasks': { status: 201, body: task() } });
    renderWithProviders(<TaskList />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /add new task/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Title'), 'Plan sprint');
    await user.click(within(dialog).getByRole('button', { name: /important/i }));
    await user.click(within(dialog).getByRole('button', { name: /^add$/i }));

    await waitFor(() => expect(api.count('POST', '/tasks')).toBe(1));
    const body = api.calls.find((c) => c.method === 'POST' && c.path === '/tasks')!.body as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({ title: 'Plan sprint', quadrant: 'q2' });
    expect(new Date(body.dueAt as string).toISOString()).toBe(body.dueAt);
  });

  it('asks the server to complete a task instead of awarding points itself', async () => {
    const api = mockApi({
      ...emptyAccount,
      'GET /tasks': { body: [task()] },
      'POST /tasks/:id/complete': {
        body: { ...task(), completedAt: '2030-01-02T00:00:00.000Z', pointsAwarded: 15 },
      },
    });
    renderWithProviders(<TaskList />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /finish/i }));
    await waitFor(() => expect(api.count('POST', '/tasks/t1/complete')).toBe(1));
  });

  it('flags an overdue task', async () => {
    mockApi({
      ...emptyAccount,
      'GET /tasks': { body: [task({ dueAt: '2020-01-01T10:00:00.000Z' })] },
    });
    renderWithProviders(<TaskList />);
    expect(await screen.findByText(/overdue:/i)).toBeInTheDocument();
  });
});
