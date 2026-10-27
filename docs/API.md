# API reference

Base path `/api`. JSON in, JSON out. Authentication is an httpOnly cookie (`adhd_token`, 7 days) set by
register and login; every endpoint except `health`, `auth/register` and `auth/login` needs it (401 without).
Errors look like `{ "error": "message" }`; validation errors are `400` with `{ "error": "validation_error", "issues": [...] }`.

## Auth

| Method | Path             | Body                                                     | Notes                                                    |
| ------ | ---------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| POST   | `/auth/register` | `email`, `password` (8-128), `displayName?`, `timezone?` | `201`, `409` if the email exists. Rate limited           |
| POST   | `/auth/login`    | `email`, `password`                                      | `401` for any wrong credential. Rate limited             |
| POST   | `/auth/logout`   |                                                          | `204`                                                    |
| GET    | `/auth/me`       |                                                          | Current user                                             |
| PATCH  | `/auth/me`       | `displayName?`, `timezone?`                              | `timezone` must be an IANA zone, e.g. `Asia/Ho_Chi_Minh` |

## Tasks

| Method | Path                       | Notes                                                                                                                                                       |
| ------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/tasks?status=open\|done` | Own tasks, newest first                                                                                                                                     |
| POST   | `/tasks`                   | `title`, `quadrant` (`q1`-`q4`), `description?`, `dueAt?` (ISO), `recurrence?` (`none`, `daily`, `weekly`). `400` if `dueAt` is in the past                 |
| PATCH  | `/tasks/:id`               | Any of the fields above. Only the fields sent change. A past `dueAt` is rejected only if it differs from the current one                                    |
| POST   | `/tasks/:id/complete`      | Idempotent. Pays `q1` 15, `q2` 10, `q3` 5, `q4` 1 points once. For a repeating task the response has `nextTask`, the next occurrence at the same local time |
| DELETE | `/tasks/:id`               | `204`                                                                                                                                                       |
| POST   | `/import`                  | `{ tasks: [...] }` up to 500. Creates tasks only; never points or rewards                                                                                   |

## Focus sessions

| Method | Path                     | Notes                                                                                                                                                                                                                                                      |
| ------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/sessions/start`        | `plannedMinutes` (15, 25, 45, 60, 90, 120), `taskId?`. Abandons a session that is still running                                                                                                                                                            |
| POST   | `/sessions/:id/complete` | `422` with `remainingSeconds` until the planned time has passed (5 s tolerance). Then, in one transaction, marks it done, pays 10 points, updates the streak and pays the streak bonus. Calling it again returns `alreadyCompleted: true` and pays nothing |
| POST   | `/sessions/:id/cancel`   | Abandons a running session                                                                                                                                                                                                                                 |
| GET    | `/sessions?limit=20`     | Completed sessions, newest first                                                                                                                                                                                                                           |
| GET    | `/sessions/streak`       | `currentStreak`, `goalReachedToday`, `nextBonus`                                                                                                                                                                                                           |

A streak day needs 60 focus minutes in the user's time zone. A shorter day leaves the streak alone; a missed day ends it. From day 2 the day that reaches the goal pays `streak x 10` bonus points.

## Points and rewards

| Method | Path                 | Notes                                                                                                                         |
| ------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/points`            | `balance` and the last 50 ledger entries (`task_complete`, `session_complete`, `streak_bonus`, `gacha_spend`, `task_overdue`) |
| GET    | `/rewards/catalog`   | Rewards and the pull cost                                                                                                     |
| GET    | `/rewards/inventory` | Rewards the user owns                                                                                                         |
| POST   | `/rewards/gacha`     | `402` without 30 points. The server rolls (common 60%, rare 30%, epic 8%, legendary 2%) and charges in one transaction        |

## Stats (all days and hours are in the user's time zone)

| Method | Path                      | Notes                                                                                    |
| ------ | ------------------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/stats/overview`         | Tasks done/open and by quadrant, focus totals, best day, longest streak (last 12 months) |
| GET    | `/stats/heatmap?weeks=26` | One entry per day with focus minutes and sessions, empty days included                   |
| GET    | `/stats/hours`            | Focus minutes per hour of day over 90 days, and `bestHour`                               |
| GET    | `/stats/weekly?weeks=8`   | Monday-based weeks with focus minutes, sessions and tasks completed                      |

## Background jobs

The API runs a job every `JOBS_INTERVAL_MINUTES` (default 15) while `JOBS_ENABLED=true`.

- **Overdue penalty.** An open task whose due date has passed costs its quadrant's points, once. A balance never goes below zero, and a task that could not be charged is still marked as processed so points earned later are safe. Only one API instance runs the job at a time (a Postgres advisory lock).

## Health

`GET /health` returns `{ "status": "ok", "db": "up" }`, or `503` when the database is unreachable.
