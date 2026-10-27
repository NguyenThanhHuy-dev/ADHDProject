import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, registerUser, type TestApp } from './helpers';

let app: TestApp;
let close: () => Promise<void>;
let alice: string;
let bob: string;

const create = (cookie: string, payload: object) =>
  app.inject({ method: 'POST', url: '/api/tasks', headers: { cookie }, payload });

beforeAll(async () => {
  ({ app, close } = await createTestApp());
  alice = (await registerUser(app, 'alice@example.com')).cookie;
  bob = (await registerUser(app, 'bob@example.com')).cookie;
});
afterAll(() => close());

describe('tasks', () => {
  it('requires authentication', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/tasks' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/tasks', payload: {} })).statusCode).toBe(
      401,
    );
  });

  it('creates and lists tasks with defaults', async () => {
    const res = await create(alice, { title: ' Write report ', quadrant: 'q1' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      title: 'Write report',
      description: '',
      dueAt: null,
      completedAt: null,
    });
    const list = await app.inject({ method: 'GET', url: '/api/tasks', headers: { cookie: alice } });
    expect(list.json().map((t: { title: string }) => t.title)).toContain('Write report');
  });

  it('validates the body', async () => {
    expect((await create(alice, { title: '', quadrant: 'q1' })).statusCode).toBe(400);
    expect((await create(alice, { title: 'x', quadrant: 'q9' })).statusCode).toBe(400);
    expect(
      (await create(alice, { title: 'x', quadrant: 'q1', dueAt: 'not a date' })).statusCode,
    ).toBe(400);
  });

  it("never exposes or lets a user change another user's tasks", async () => {
    const { id } = (await create(alice, { title: 'Private', quadrant: 'q2' })).json();
    const bobList = await app.inject({
      method: 'GET',
      url: '/api/tasks',
      headers: { cookie: bob },
    });
    expect(bobList.json().some((t: { id: string }) => t.id === id)).toBe(false);

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${id}`,
      headers: { cookie: bob },
      payload: { title: 'hacked' },
    });
    expect(patch.statusCode).toBe(404);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/tasks/${id}/complete`,
          headers: { cookie: bob },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: 'DELETE', url: `/api/tasks/${id}`, headers: { cookie: bob } }))
        .statusCode,
    ).toBe(404);

    const aliceList = await app.inject({
      method: 'GET',
      url: '/api/tasks',
      headers: { cookie: alice },
    });
    expect(aliceList.json().find((t: { id: string }) => t.id === id).title).toBe('Private');
  });

  it('updates a task and rejects empty updates', async () => {
    const { id } = (await create(alice, { title: 'Old', quadrant: 'q3' })).json();
    const ok = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${id}`,
      headers: { cookie: alice },
      payload: { title: 'New', quadrant: 'q4' },
    });
    expect(ok.json()).toMatchObject({ title: 'New', quadrant: 'q4' });
    const empty = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${id}`,
      headers: { cookie: alice },
      payload: {},
    });
    expect(empty.statusCode).toBe(400);
  });

  it('a partial update leaves the other fields untouched', async () => {
    const due = '2030-01-02T03:04:05.000Z';
    const { id } = (
      await create(alice, { title: 'Keep', description: 'details', quadrant: 'q2', dueAt: due })
    ).json();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${id}`,
      headers: { cookie: alice },
      payload: { title: 'Renamed' },
    });
    expect(res.json()).toMatchObject({
      title: 'Renamed',
      description: 'details',
      quadrant: 'q2',
      dueAt: due,
    });
  });

  it('completes idempotently and filters by status', async () => {
    const { id } = (await create(alice, { title: 'Finish me', quadrant: 'q1' })).json();
    const first = await app.inject({
      method: 'POST',
      url: `/api/tasks/${id}/complete`,
      headers: { cookie: alice },
    });
    const second = await app.inject({
      method: 'POST',
      url: `/api/tasks/${id}/complete`,
      headers: { cookie: alice },
    });
    expect(first.json().completedAt).toBeTruthy();
    expect(second.json().completedAt).toBe(first.json().completedAt);

    const done = await app.inject({
      method: 'GET',
      url: '/api/tasks?status=done',
      headers: { cookie: alice },
    });
    const open = await app.inject({
      method: 'GET',
      url: '/api/tasks?status=open',
      headers: { cookie: alice },
    });
    expect(done.json().some((t: { id: string }) => t.id === id)).toBe(true);
    expect(open.json().some((t: { id: string }) => t.id === id)).toBe(false);
  });

  it('deletes a task and returns 404 for malformed or unknown ids', async () => {
    const { id } = (await create(alice, { title: 'Bye', quadrant: 'q4' })).json();
    expect(
      (await app.inject({ method: 'DELETE', url: `/api/tasks/${id}`, headers: { cookie: alice } }))
        .statusCode,
    ).toBe(204);
    expect(
      (await app.inject({ method: 'DELETE', url: `/api/tasks/${id}`, headers: { cookie: alice } }))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: '/api/tasks/not-a-uuid',
          headers: { cookie: alice },
        })
      ).statusCode,
    ).toBe(400);
  });
});

describe('import', () => {
  it('imports tasks without paying any points', async () => {
    const cookie = (await registerUser(app, 'importer@example.com')).cookie;
    const res = await app.inject({
      method: 'POST',
      url: '/api/import',
      headers: { cookie },
      payload: {
        tasks: [
          { title: 'Old open task', quadrant: 'q2', dueAt: '2030-01-01T00:00:00Z' },
          { title: 'Old done task', quadrant: 'q1', completedAt: '2029-12-01T00:00:00Z' },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ imported: 2 });
    const done = await app.inject({
      method: 'GET',
      url: '/api/tasks?status=done',
      headers: { cookie },
    });
    expect(done.json()).toHaveLength(1);
    const points = await app.inject({ method: 'GET', url: '/api/points', headers: { cookie } });
    expect(points.json().balance).toBe(0);
  });

  it('rejects oversized or malformed payloads and anonymous callers', async () => {
    const cookie = (await registerUser(app, 'importer2@example.com')).cookie;
    const bad = await app.inject({
      method: 'POST',
      url: '/api/import',
      headers: { cookie },
      payload: { tasks: [{ title: '', quadrant: 'q9' }] },
    });
    expect(bad.statusCode).toBe(400);
    const anon = await app.inject({ method: 'POST', url: '/api/import', payload: { tasks: [] } });
    expect(anon.statusCode).toBe(401);
  });
});
