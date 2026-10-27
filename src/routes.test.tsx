import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { createQueryClient } from './api/queryClient';
import userEvent from '@testing-library/user-event';
import { emptyAccount, mockApi, testUser } from './test/mockApi';

const renderApp = (path: string) =>
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );

// Guards against a page crashing on mount (e.g. an import that resolves to a non-component).
describe('routes', () => {
  it.each([
    ['/', 'Dashboard'],
    ['/pomodoro', 'Pomodoro Timer'],
    ['/tasks', 'Task List'],
    ['/insights', 'Insights'],
    ['/rewards', 'Rewards'],
    ['/profile', 'Profile'],
    ['/settings', 'Settings'],
  ])('%s renders its page for a signed-in user', async (path, heading) => {
    mockApi(emptyAccount);
    renderApp(path);
    const headings = await screen.findAllByRole('heading', { name: heading }, { timeout: 5000 });
    expect(headings.length).toBeGreaterThan(0);
  });

  it("says the server can't be reached instead of showing the sign-in screen", async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    renderApp('/tasks');
    expect(await screen.findByText("Can't reach the server")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();

    mockApi(emptyAccount); // the connection is back
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect((await screen.findAllByRole('heading', { name: 'Task List' })).length).toBeGreaterThan(
      0,
    );
  });

  it('shows the sign-in screen when there is no session', async () => {
    mockApi({ 'GET /auth/me': { status: 401, body: { error: 'Unauthorized' } } });
    renderApp('/tasks');
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText('Task List')).not.toBeInTheDocument();
  });

  it('moves from the sign-in screen into the app after signing in, and back after signing out', async () => {
    let signedIn = false;
    mockApi({
      ...emptyAccount,
      'GET /auth/me': () =>
        signedIn ? { body: testUser } : { status: 401, body: { error: 'Unauthorized' } },
      'POST /auth/login': () => {
        signedIn = true;
        return { body: testUser };
      },
      'POST /auth/logout': () => {
        signedIn = false;
        return { status: 204 };
      },
    });
    renderApp('/');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findAllByRole('heading', { name: 'Dashboard' })).length).toBeGreaterThan(
      0,
    );

    await user.click(screen.getAllByRole('button', { name: /sign out/i })[0]);
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });
});
