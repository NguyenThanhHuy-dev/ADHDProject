import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

// Guards against a page crashing on mount (e.g. an import that resolves to a non-component).
describe('routes', () => {
  it.each([
    ['/', 'Dashboard'],
    ['/pomodoro', 'Pomodoro Timer'],
    ['/tasks', 'Task List'],
    ['/rewards', 'Rewards'],
    ['/profile', 'Profile'],
    ['/settings', 'Settings'],
  ])('%s renders its page', async (path, heading) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );
    const headings = await screen.findAllByRole('heading', { name: heading }, { timeout: 5000 });
    expect(headings.length).toBeGreaterThan(0);
  });
});
