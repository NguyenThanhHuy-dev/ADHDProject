import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export interface PushSettings {
  available: boolean;
  subscriptions: number;
  dueReminders: boolean;
  timerEnd: boolean;
}

/** The VAPID public key arrives base64url encoded; the browser wants raw bytes. */
export const urlBase64ToUint8Array = (value: string): Uint8Array => {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

export const pushSupported = () =>
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  typeof window !== 'undefined' &&
  'PushManager' in window &&
  'Notification' in window;

export const usePushSettings = () =>
  useQuery({
    queryKey: ['push', 'settings'],
    queryFn: () => api<PushSettings>('GET', '/push/settings'),
  });

export const useUpdatePushSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changes: Partial<Pick<PushSettings, 'dueReminders' | 'timerEnd'>>) =>
      api<Pick<PushSettings, 'dueReminders' | 'timerEnd'>>('PATCH', '/push/settings', changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['push', 'settings'] }),
  });
};

export const useSendTestPush = () =>
  useMutation({
    mutationFn: () => api<{ sent: number; gone: number; failed: number }>('POST', '/push/test'),
  });

/** This browser's own push subscription: whether it exists, and how to create or remove it. */
export const usePushDevice = () => {
  const qc = useQueryClient();
  const supported = pushSupported();
  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : 'denied',
  );
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => !cancelled && setSubscribed(sub !== null))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['push', 'settings'] });

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        throw new Error(
          'Notifications are blocked. Allow them for this site in your browser settings.',
        );
      }
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await api<{ publicKey: string }>('GET', '/push/public-key');
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        }));
      await api('POST', '/push/subscribe', sub.toJSON());
      setSubscribed(true);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not turn on notifications');
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `refresh` only wraps the stable query client
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api('DELETE', '/push/subscribe', { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not turn off notifications');
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `refresh` only wraps the stable query client
  }, []);

  return { supported, permission, subscribed, busy, error, enable, disable };
};
