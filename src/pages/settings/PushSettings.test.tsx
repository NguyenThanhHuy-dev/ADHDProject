import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PushSettings from './PushSettings';
import { urlBase64ToUint8Array } from '../../api/push';
import { emptyAccount, mockApi, renderWithProviders } from '../../test/mockApi';

const subscription = {
  endpoint: 'https://push.example.test/abc',
  unsubscribe: vi.fn().mockResolvedValue(true),
  toJSON: () => ({ endpoint: 'https://push.example.test/abc', keys: { p256dh: 'pk', auth: 'ak' } }),
};

const installBrowserPush = (
  permission: NotificationPermission,
  existing: typeof subscription | null = null,
) => {
  const getSubscription = vi.fn().mockResolvedValue(existing);
  const subscribe = vi.fn().mockResolvedValue(subscription);
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: { getSubscription, subscribe } }) },
  });
  vi.stubGlobal('PushManager', class {});
  const requestPermission = vi
    .fn()
    .mockResolvedValue(permission === 'denied' ? 'denied' : 'granted');
  vi.stubGlobal('Notification', { permission, requestPermission });
  return { getSubscription, subscribe, requestPermission };
};

const serverWithPush = (subscriptions = 0) => ({
  ...emptyAccount,
  'GET /push/settings': {
    body: { available: true, subscriptions, dueReminders: true, timerEnd: true },
  },
  'GET /push/public-key': {
    body: {
      publicKey:
        'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
    },
  },
  'POST /push/subscribe': { status: 204 },
  'DELETE /push/subscribe': { status: 204 },
  'PATCH /push/settings': { body: { dueReminders: false, timerEnd: true } },
  'POST /push/test': { body: { sent: 1, gone: 0, failed: 0 } },
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker');
  vi.unstubAllGlobals();
});

describe('urlBase64ToUint8Array', () => {
  it('decodes the URL-safe base64 form of a VAPID key', () => {
    expect([...urlBase64ToUint8Array('AQID')]).toEqual([1, 2, 3]);
    expect([...urlBase64ToUint8Array('-_8')]).toEqual([251, 255]); // "-" and "_" map to "+" and "/"
  });
});

describe('PushSettings', () => {
  it('explains when the browser cannot do push', async () => {
    mockApi(serverWithPush());
    renderWithProviders(<PushSettings />);
    expect(await screen.findByText(/cannot receive push notifications/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Push notifications' })).toBeDisabled();
  });

  it('says so when the server has no push keys', async () => {
    installBrowserPush('default');
    mockApi({
      ...serverWithPush(),
      'GET /push/settings': {
        body: { available: false, subscriptions: 0, dueReminders: true, timerEnd: true },
      },
    });
    renderWithProviders(<PushSettings />);
    expect(await screen.findByText(/not set up on this server/i)).toBeInTheDocument();
  });

  it('asks permission, subscribes this browser and registers it on the server', async () => {
    const browser = installBrowserPush('default');
    const api = mockApi(serverWithPush());
    renderWithProviders(<PushSettings />);
    const user = userEvent.setup();
    const toggle = await screen.findByRole('checkbox', { name: 'Push notifications' });
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);

    await waitFor(() => expect(api.count('POST', '/push/subscribe')).toBe(1));
    expect(browser.requestPermission).toHaveBeenCalledTimes(1);
    expect(browser.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        userVisibleOnly: true,
        applicationServerKey: expect.any(Uint8Array),
      }),
    );
    expect(api.calls.find((c) => c.path === '/push/subscribe')!.body).toEqual(
      subscription.toJSON(),
    );
    expect(
      await screen.findByRole('checkbox', { name: 'Tell me when a focus session ends' }),
    ).toBeInTheDocument();
  });

  it('does not subscribe when permission is refused', async () => {
    const browser = installBrowserPush('default');
    browser.requestPermission.mockResolvedValue('denied');
    const api = mockApi(serverWithPush());
    renderWithProviders(<PushSettings />);
    const user = userEvent.setup();
    const toggle = await screen.findByRole('checkbox', { name: 'Push notifications' });
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);
    expect(await screen.findByText(/notifications are blocked/i)).toBeInTheDocument();
    expect(browser.subscribe).not.toHaveBeenCalled();
    expect(api.count('POST', '/push/subscribe')).toBe(0);
  });

  it('shows the reminder options for a subscribed browser, saves changes and can send a test', async () => {
    installBrowserPush('granted', subscription);
    const api = mockApi(serverWithPush(1));
    renderWithProviders(<PushSettings />);
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole('checkbox', { name: 'Remind me when a task is due soon' }),
    );
    await waitFor(() => expect(api.count('PATCH', '/push/settings')).toBe(1));
    expect(api.calls.find((c) => c.method === 'PATCH')!.body).toEqual({ dueReminders: false });

    await user.click(screen.getByRole('button', { name: /send a test notification/i }));
    expect(await screen.findByText(/it should appear/i)).toBeInTheDocument();
  });

  it('removes the subscription from the server and the browser when turned off', async () => {
    installBrowserPush('granted', subscription);
    const api = mockApi(serverWithPush(1));
    renderWithProviders(<PushSettings />);
    const user = userEvent.setup();
    const toggle = await screen.findByRole('checkbox', { name: 'Push notifications' });
    await waitFor(() => expect(toggle).toBeChecked());
    await user.click(toggle);
    await waitFor(() => expect(api.count('DELETE', '/push/subscribe')).toBe(1));
    expect(api.calls.find((c) => c.method === 'DELETE')!.body).toEqual({
      endpoint: subscription.endpoint,
    });
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });
});
