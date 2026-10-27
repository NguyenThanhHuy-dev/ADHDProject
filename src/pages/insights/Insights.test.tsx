import { screen } from '@testing-library/react';
import Insights from './Insights';
import { emptyAccount, mockApi, renderWithProviders } from '../../test/mockApi';

describe('Insights', () => {
  it('shows the numbers, the golden hour and one calendar cell per day', async () => {
    mockApi({
      ...emptyAccount,
      'GET /stats/heatmap': {
        body: {
          timeZone: 'UTC',
          from: '2030-06-10',
          to: '2030-06-16',
          days: [
            { date: '2030-06-10', minutes: 0, sessions: 0 },
            { date: '2030-06-11', minutes: 25, sessions: 1 },
            { date: '2030-06-12', minutes: 70, sessions: 2 },
            { date: '2030-06-13', minutes: 130, sessions: 4 },
            { date: '2030-06-14', minutes: 0, sessions: 0 },
            { date: '2030-06-15', minutes: 0, sessions: 0 },
            { date: '2030-06-16', minutes: 0, sessions: 0 },
          ],
        },
      },
      'GET /stats/hours': {
        body: { timeZone: 'UTC', hours: [{ hour: 9, minutes: 90 }], bestHour: 9 },
      },
      'GET /stats/overview': {
        body: {
          timeZone: 'UTC',
          tasks: {
            done: 3,
            open: 1,
            completionRate: 75,
            byQuadrant: [{ quadrant: 'q1', done: 3, open: 1 }],
          },
          focus: {
            totalMinutes: 225,
            totalSessions: 7,
            activeDays: 3,
            avgMinutesPerActiveDay: 75,
            bestDay: { day: '2030-06-13', minutes: 130 },
            longestStreakDays: 2,
          },
        },
      },
    });
    const { container } = renderWithProviders(<Insights />);

    expect(await screen.findByText('3.8h')).toBeInTheDocument(); // 225 minutes
    expect(screen.getByText('2 days')).toBeInTheDocument();
    expect(await screen.findByText(/around 09:00/)).toBeInTheDocument();
    expect(screen.getByText('Urgent & Important')).toBeInTheDocument();
    expect(screen.getByText('3/4')).toBeInTheDocument();

    const levels = [...container.querySelectorAll('[data-level]')].map((el) =>
      el.getAttribute('data-level'),
    );
    expect(levels).toEqual(['0', '1', '3', '4', '0', '0', '0']);
  });

  it('explains what to do when there is no data yet', async () => {
    mockApi(emptyAccount);
    renderWithProviders(<Insights />);
    expect(await screen.findByText(/complete a few sessions/i)).toBeInTheDocument();
    expect(screen.getByText(/add tasks to see/i)).toBeInTheDocument();
  });
});
