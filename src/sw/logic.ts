/** Pure helpers for the service worker, kept apart so they can be unit tested. */

export interface PushMessage {
  title: string;
  body: string;
  tag: string;
  url: string;
  skipIfFocused: boolean;
}

/** Parses what the server sent. Anything malformed is dropped rather than shown. */
export const parsePush = (raw: string | undefined): PushMessage | null => {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (typeof data.title !== 'string' || typeof data.body !== 'string') return null;
    const url = typeof data.url === 'string' && /^\/(?!\/)/.test(data.url) ? data.url : '/';
    return {
      title: data.title.slice(0, 100),
      body: data.body.slice(0, 300),
      tag: typeof data.tag === 'string' ? data.tag.slice(0, 100) : 'general',
      url, // only same-origin paths, so a notification can never send the user elsewhere
      skipIfFocused: data.skipIfFocused === true,
    };
  } catch {
    return null;
  }
};

/** A timer that is already ringing in the foreground window does not need a second alert. */
export const shouldShow = (message: PushMessage, hasFocusedWindow: boolean): boolean =>
  !(message.skipIfFocused && hasFocusedWindow);
