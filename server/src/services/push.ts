import webpush from 'web-push';

export interface PushPayload {
  title: string;
  body: string;
  /** Replaces an earlier notification with the same tag instead of stacking. */
  tag: string;
  /** Page opened when the notification is clicked. */
  url: string;
  /** The service worker skips showing it when the app window is already in front. */
  skipIfFocused?: boolean;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** `gone` means the browser dropped the subscription: delete it, it will never work again. */
export type PushResult = 'sent' | 'gone' | 'failed';

export interface PushSender {
  publicKey: string;
  send(target: PushTarget, payload: PushPayload): Promise<PushResult>;
}

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export const createWebPushSender = ({
  publicKey,
  privateKey,
  subject,
}: VapidConfig): PushSender => ({
  publicKey,
  async send(target, payload) {
    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(payload),
        // A reminder that arrives hours late is worse than none: let the push service drop it.
        { vapidDetails: { subject, publicKey, privateKey }, TTL: 60 * 60, urgency: 'high' },
      );
      return 'sent';
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      return status === 404 || status === 410 ? 'gone' : 'failed';
    }
  },
});
