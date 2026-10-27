import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthPage from './AuthPage';
import { mockApi, renderWithProviders, testUser } from '../../test/mockApi';

describe('AuthPage', () => {
  it('signs in with the typed credentials', async () => {
    const api = mockApi({ 'POST /auth/login': { body: testUser } });
    renderWithProviders(<AuthPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(api.count('POST', '/auth/login')).toBe(1));
    expect(api.calls[0].body).toEqual({ email: 'ada@example.com', password: 'password123' });
  });

  it('shows the server error for wrong credentials', async () => {
    mockApi({ 'POST /auth/login': { status: 401, body: { error: 'Invalid email or password' } } });
    renderWithProviders(<AuthPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });

  it('registers with the browser time zone', async () => {
    const api = mockApi({ 'POST /auth/register': { status: 201, body: testUser } });
    renderWithProviders(<AuthPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Create account' }));
    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(api.count('POST', '/auth/register')).toBe(1));
    expect(api.calls[0].body).toMatchObject({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  });
});
