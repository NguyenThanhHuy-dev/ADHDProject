import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskSteps from './TaskSteps';
import { emptyAccount, mockApi, renderWithProviders } from '../../test/mockApi';
import type { Task } from '../../types';

const task = (steps: Task['steps'] = []): Task => ({
  id: 't1',
  title: 'Write the report',
  description: '',
  quadrant: 'q1',
  dueDate: null,
  recurrence: 'none',
  steps,
  completed: false,
  createdAt: '2030-01-01T00:00:00.000Z',
});

const steps = [
  { id: 's1', title: 'Open the template', position: 0, done: true },
  { id: 's2', title: 'Write the intro', position: 1, done: false },
];

describe('TaskSteps', () => {
  it('shows progress and lets the user tick a step', async () => {
    const api = mockApi({
      ...emptyAccount,
      'PATCH /tasks/:taskId/steps/:stepId': { body: { ...steps[1], done: true } },
    });
    renderWithProviders(<TaskSteps task={task(steps)} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /steps 1\/2/i }));
    await user.click(await screen.findByRole('checkbox', { name: 'Write the intro' }));
    await waitFor(() => expect(api.count('PATCH', '/tasks/t1/steps/s2')).toBe(1));
    expect(api.calls.find((c) => c.method === 'PATCH')!.body).toEqual({ done: true });
  });

  it('adds a typed step', async () => {
    const api = mockApi({
      ...emptyAccount,
      'POST /tasks/:taskId/steps': { status: 201, body: [] },
    });
    renderWithProviders(<TaskSteps task={task()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /add steps/i }));
    await user.type(await screen.findByRole('textbox', { name: 'New step' }), 'Open the file');
    await user.click(screen.getByRole('button', { name: /^add$/i }));
    await waitFor(() => expect(api.count('POST', '/tasks/t1/steps')).toBe(1));
    expect(api.calls.find((c) => c.method === 'POST')!.body).toEqual({ titles: ['Open the file'] });
  });

  it('hides the AI button when the server has no AI configured', async () => {
    mockApi(emptyAccount);
    renderWithProviders(<TaskSteps task={task()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /add steps/i }));
    await screen.findByRole('textbox', { name: 'New step' });
    expect(screen.queryByRole('button', { name: /suggest steps/i })).not.toBeInTheDocument();
  });

  it('shows suggestions, saves only the ones the user keeps', async () => {
    const api = mockApi({
      ...emptyAccount,
      'GET /features': { body: { aiSteps: true } },
      'POST /tasks/:taskId/steps/suggest': {
        body: { steps: ['Open the file', 'Write the intro', 'Send it'] },
      },
      'POST /tasks/:taskId/steps': { status: 201, body: [] },
    });
    renderWithProviders(<TaskSteps task={task()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /add steps/i }));
    await user.click(await screen.findByRole('button', { name: /suggest steps with ai/i }));

    const dialog = await screen.findByRole('dialog');
    expect(api.count('POST', '/tasks/t1/steps')).toBe(0); // nothing saved yet
    await user.click(within(dialog).getByRole('checkbox', { name: 'Send it' })); // untick
    await user.click(within(dialog).getByRole('button', { name: /add 2 steps/i }));

    await waitFor(() => expect(api.count('POST', '/tasks/t1/steps')).toBe(1));
    expect(api.calls.find((c) => c.path === '/tasks/t1/steps')!.body).toEqual({
      titles: ['Open the file', 'Write the intro'],
    });
  });

  it("explains when the AI can't help", async () => {
    mockApi({
      ...emptyAccount,
      'GET /features': { body: { aiSteps: true } },
      'POST /tasks/:taskId/steps/suggest': {
        status: 422,
        body: { error: 'The AI could not suggest steps for this task' },
      },
    });
    renderWithProviders(<TaskSteps task={task()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /add steps/i }));
    await user.click(await screen.findByRole('button', { name: /suggest steps with ai/i }));
    expect(
      await screen.findByText('The AI could not suggest steps for this task'),
    ).toBeInTheDocument();
  });
});

describe('TaskSteps optimistic ticking', () => {
  it('shows the tick immediately and puts it back if the server refuses', async () => {
    mockApi({
      ...emptyAccount,
      'GET /tasks': {
        body: [
          {
            id: 't1',
            title: 'Write the report',
            description: '',
            quadrant: 'q1',
            recurrence: 'none',
            dueAt: null,
            completedAt: null,
            createdAt: '2030-01-01T00:00:00.000Z',
            steps,
          },
        ],
      },
      'PATCH /tasks/:taskId/steps/:stepId': {
        status: 500,
        body: { error: 'Internal server error' },
      },
    });
    const { default: TaskList } = await import('./TaskList');
    renderWithProviders(<TaskList />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /steps 1\/2/i }));
    const box = await screen.findByRole('checkbox', { name: 'Write the intro' });
    await user.click(box);
    // Refused by the server: the box ends up unticked again.
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Write the intro' })).not.toBeChecked(),
    );
    expect(screen.getByRole('button', { name: /steps 1\/2/i })).toBeInTheDocument();
  });
});
