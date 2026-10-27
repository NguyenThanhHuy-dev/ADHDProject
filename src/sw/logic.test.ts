import { parsePush, shouldShow } from './logic';

describe('service worker push parsing', () => {
  it('reads a well-formed message', () => {
    const message = parsePush(
      JSON.stringify({ title: 'Due soon', body: 'Report in 30 min', tag: 'task-1', url: '/tasks' }),
    );
    expect(message).toEqual({
      title: 'Due soon',
      body: 'Report in 30 min',
      tag: 'task-1',
      url: '/tasks',
      skipIfFocused: false,
    });
  });

  it('drops empty, non-JSON and incomplete messages', () => {
    expect(parsePush(undefined)).toBeNull();
    expect(parsePush('')).toBeNull();
    expect(parsePush('not json')).toBeNull();
    expect(parsePush(JSON.stringify({ title: 'only a title' }))).toBeNull();
    expect(parsePush(JSON.stringify({ title: 1, body: 2 }))).toBeNull();
  });

  it('only ever opens same-origin paths', () => {
    const open = (url: unknown) => parsePush(JSON.stringify({ title: 't', body: 'b', url }))!.url;
    expect(open('/pomodoro')).toBe('/pomodoro');
    expect(open('https://evil.example/phish')).toBe('/');
    expect(open('//evil.example')).toBe('/');
    expect(open('javascript:alert(1)')).toBe('/');
    expect(open(undefined)).toBe('/');
  });

  it('caps text length and defaults the tag', () => {
    const message = parsePush(JSON.stringify({ title: 'x'.repeat(500), body: 'y'.repeat(900) }))!;
    expect(message.title).toHaveLength(100);
    expect(message.body).toHaveLength(300);
    expect(message.tag).toBe('general');
  });
});

describe('shouldShow', () => {
  const base = { title: 't', body: 'b', tag: 'x', url: '/' };
  it('skips alerts that opted out while the app is in front, shows everything else', () => {
    expect(shouldShow({ ...base, skipIfFocused: true }, true)).toBe(false);
    expect(shouldShow({ ...base, skipIfFocused: true }, false)).toBe(true);
    expect(shouldShow({ ...base, skipIfFocused: false }, true)).toBe(true);
  });
});
