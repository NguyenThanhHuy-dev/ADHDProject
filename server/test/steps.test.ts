import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  AiBadOutputError,
  AiRefusedError,
  createAnthropicSuggester,
  normalizeSteps,
  type StepSuggester,
} from '../src/services/ai';
import { createTestApp, registerUser, type TestApp } from './helpers';

const suggest = vi.fn<StepSuggester['suggest']>();
let app: TestApp;
let close: () => Promise<void>;
let alice: string;
let bob: string;

const call = (
  cookie: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  payload?: object,
) => app.inject({ method, url, headers: { cookie }, payload });
const newTask = async (cookie: string, title = 'Write the report') =>
  (await call(cookie, 'POST', '/api/tasks', { title, quadrant: 'q1' })).json();

beforeAll(async () => {
  ({ app, close } = await createTestApp({ suggester: { suggest } }));
  alice = (await registerUser(app, 'alice-steps@example.com')).cookie;
  bob = (await registerUser(app, 'bob-steps@example.com')).cookie;
});
afterAll(() => close());

describe('steps', () => {
  it('adds steps in order, and tasks list them with their progress', async () => {
    const task = await newTask(alice);
    const res = await call(alice, 'POST', `/api/tasks/${task.id}/steps`, {
      titles: ['Open the template', 'Write the intro', 'Add the numbers'],
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().map((s: { title: string }) => s.title)).toEqual([
      'Open the template',
      'Write the intro',
      'Add the numbers',
    ]);

    const more = await call(alice, 'POST', `/api/tasks/${task.id}/steps`, {
      titles: ['Proofread'],
    });
    expect(more.json().map((s: { position: number }) => s.position)).toEqual([0, 1, 2, 3]);

    const list = (await call(alice, 'GET', '/api/tasks')).json();
    const listed = list.find((t: { id: string }) => t.id === task.id);
    expect(listed.steps).toHaveLength(4);
    expect(listed.steps[0]).toMatchObject({ title: 'Open the template', done: false });
  });

  it('ticks a step, unticks it, renames it and deletes it', async () => {
    const task = await newTask(alice);
    const [step] = (
      await call(alice, 'POST', `/api/tasks/${task.id}/steps`, { titles: ['First'] })
    ).json();

    const done = await call(alice, 'PATCH', `/api/tasks/${task.id}/steps/${step.id}`, {
      done: true,
    });
    expect(done.json()).toMatchObject({ done: true });
    const undone = await call(alice, 'PATCH', `/api/tasks/${task.id}/steps/${step.id}`, {
      done: false,
      title: 'Renamed',
    });
    expect(undone.json()).toMatchObject({ done: false, title: 'Renamed' });
    expect(
      (await call(alice, 'PATCH', `/api/tasks/${task.id}/steps/${step.id}`, {})).statusCode,
    ).toBe(400);

    expect((await call(alice, 'DELETE', `/api/tasks/${task.id}/steps/${step.id}`)).statusCode).toBe(
      204,
    );
    expect((await call(alice, 'DELETE', `/api/tasks/${task.id}/steps/${step.id}`)).statusCode).toBe(
      404,
    );
  });

  it("never lets one user read or change another user's steps", async () => {
    const task = await newTask(alice);
    const [step] = (
      await call(alice, 'POST', `/api/tasks/${task.id}/steps`, { titles: ['Private'] })
    ).json();

    expect(
      (await call(bob, 'POST', `/api/tasks/${task.id}/steps`, { titles: ['x'] })).statusCode,
    ).toBe(404);
    expect(
      (await call(bob, 'PATCH', `/api/tasks/${task.id}/steps/${step.id}`, { done: true }))
        .statusCode,
    ).toBe(404);
    expect((await call(bob, 'DELETE', `/api/tasks/${task.id}/steps/${step.id}`)).statusCode).toBe(
      404,
    );
    const bobTasks = (await call(bob, 'GET', '/api/tasks')).json();
    expect(JSON.stringify(bobTasks)).not.toContain('Private');
  });

  it('validates titles and caps the number of steps per task', async () => {
    const task = await newTask(alice);
    expect(
      (await call(alice, 'POST', `/api/tasks/${task.id}/steps`, { titles: [] })).statusCode,
    ).toBe(400);
    expect(
      (await call(alice, 'POST', `/api/tasks/${task.id}/steps`, { titles: ['  '] })).statusCode,
    ).toBe(400);
    for (let i = 0; i < 3; i++) {
      const batch = Array.from({ length: 10 }, (_, n) => `step ${i * 10 + n}`);
      expect(
        (await call(alice, 'POST', `/api/tasks/${task.id}/steps`, { titles: batch })).statusCode,
      ).toBe(201);
    }
    const over = await call(alice, 'POST', `/api/tasks/${task.id}/steps`, {
      titles: ['one too many'],
    });
    expect(over.statusCode).toBe(400);
  });

  it('steps give no points and do not complete the task', async () => {
    const task = await newTask(alice);
    const steps = (
      await call(alice, 'POST', `/api/tasks/${task.id}/steps`, { titles: ['a', 'b'] })
    ).json();
    for (const s of steps)
      await call(alice, 'PATCH', `/api/tasks/${task.id}/steps/${s.id}`, { done: true });
    const before = (await call(alice, 'GET', '/api/points')).json().balance;
    const open = (await call(alice, 'GET', '/api/tasks?status=open')).json();
    expect(open.some((t: { id: string }) => t.id === task.id)).toBe(true);
    const after = (await call(alice, 'GET', '/api/points')).json().balance;
    expect(after).toBe(before);
  });

  it('deleting a task removes its steps', async () => {
    const task = await newTask(alice);
    await call(alice, 'POST', `/api/tasks/${task.id}/steps`, { titles: ['gone soon'] });
    await call(alice, 'DELETE', `/api/tasks/${task.id}`);
    const list = (await call(alice, 'GET', '/api/tasks')).json();
    expect(JSON.stringify(list)).not.toContain('gone soon');
  });
});

describe('AI suggestions endpoint', () => {
  it('returns suggestions for an owned task without saving them', async () => {
    suggest.mockResolvedValueOnce(['Open the template', 'Write the intro']);
    const task = await newTask(alice, 'Write the quarterly report');
    const res = await call(alice, 'POST', `/api/tasks/${task.id}/steps/suggest`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ steps: ['Open the template', 'Write the intro'] });
    expect(suggest).toHaveBeenLastCalledWith({
      title: 'Write the quarterly report',
      description: '',
    });
    const listed = (await call(alice, 'GET', '/api/tasks'))
      .json()
      .find((t: { id: string }) => t.id === task.id);
    expect(listed.steps).toEqual([]);
  });

  it("does not send another user's task to the model", async () => {
    suggest.mockClear();
    const task = await newTask(alice);
    expect((await call(bob, 'POST', `/api/tasks/${task.id}/steps/suggest`)).statusCode).toBe(404);
    expect(suggest).not.toHaveBeenCalled();
  });

  it('maps a refusal to 422 and an outage to 502 without leaking details', async () => {
    const task = await newTask(alice);
    suggest.mockRejectedValueOnce(new AiRefusedError('declined'));
    const refused = await call(alice, 'POST', `/api/tasks/${task.id}/steps/suggest`);
    expect(refused.statusCode).toBe(422);

    suggest.mockRejectedValueOnce(new Error('connect ECONNRESET api.anthropic.com sk-ant-secret'));
    const down = await call(alice, 'POST', `/api/tasks/${task.id}/steps/suggest`);
    expect(down.statusCode).toBe(502);
    expect(down.body).not.toContain('sk-ant');
  });

  it('requires a login and reports the feature flag', async () => {
    const task = await newTask(alice);
    expect(
      (await app.inject({ method: 'POST', url: `/api/tasks/${task.id}/steps/suggest` })).statusCode,
    ).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/features' })).json()).toMatchObject({
      aiSteps: true,
    });
  });
});

describe('AI not configured', () => {
  it('answers 503 and hides the feature', async () => {
    const bare = await createTestApp();
    const cookie = (await registerUser(bare.app, 'noai@example.com')).cookie;
    const task = (
      await bare.app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: { cookie },
        payload: { title: 't', quadrant: 'q1' },
      })
    ).json();
    const res = await bare.app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/steps/suggest`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(503);
    expect((await bare.app.inject({ method: 'GET', url: '/api/features' })).json()).toMatchObject({
      aiSteps: false,
    });
    await bare.close();
  });
});

describe('createAnthropicSuggester', () => {
  const makeClient = (response: object) => {
    const create = vi.fn().mockResolvedValue(response);
    return { create, client: { beta: { messages: { create } } } as never };
  };
  const text = (value: string) => ({
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: value }],
  });

  it('asks for a small JSON answer with fallbacks on, and parses it', async () => {
    const { create, client } = makeClient(
      text(JSON.stringify({ steps: ['Open the file', '2. Write the intro'] })),
    );
    const result = await createAnthropicSuggester('k', 'claude-opus-5-5', client).suggest({
      title: 'Write report',
      description: 'for Friday',
    });
    expect(result).toEqual(['Open the file', 'Write the intro']);

    const request = create.mock.calls[0][0];
    expect(request).toMatchObject({
      model: 'claude-opus-5-5',
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema' } },
    });
    expect(request).not.toHaveProperty('temperature');
    expect(request.messages[0].content).toContain('Write report');
    expect(request.messages[0].content).toContain('for Friday');
  });

  it('throws a refusal error, a bad-output error for junk, and for empty step lists', async () => {
    const refusal = makeClient({ stop_reason: 'refusal', content: [] });
    await expect(
      createAnthropicSuggester('k', 'm', refusal.client).suggest({ title: 't', description: '' }),
    ).rejects.toBeInstanceOf(AiRefusedError);

    for (const body of ['not json', '{"steps": []}', '{"steps": ["   "]}', '{"nope": 1}']) {
      const { client } = makeClient(text(body));
      await expect(
        createAnthropicSuggester('k', 'm', client).suggest({ title: 't', description: '' }),
      ).rejects.toBeInstanceOf(AiBadOutputError);
    }
  });
});

describe('normalizeSteps', () => {
  it('strips numbering and bullets, removes duplicates and caps the list', () => {
    expect(normalizeSteps(['1) Open it', '- Open it', '  * Write', '', '• Send'])).toEqual([
      'Open it',
      'Write',
      'Send',
    ]);
    expect(normalizeSteps(Array.from({ length: 12 }, (_, i) => `step ${i}`))).toHaveLength(8);
    expect(normalizeSteps(['x'.repeat(300)])[0]).toHaveLength(120);
  });
});
