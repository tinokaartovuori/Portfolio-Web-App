import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/**
 * The one small store behind the API: a SQLite file opened with Node's own
 * `node:sqlite`, the binding Nuxt Content already relies on, so there is
 * nothing to compile and nothing to run beside the app. Its path comes from
 * `runtimeConfig.dataDir` (`NUXT_DATA_DIR` in production), a directory the
 * deployment keeps between releases; backing it up is copying one file.
 *
 * Three tables, all of them counters:
 *   counters   — named totals; the only key so far is `likes`
 *   views      — page views per day and path
 *   sessions   — first views of a browser session, per day: the visitor count
 *   referrers  — sessions per day and referring host, own host excluded
 *
 * Nothing in here can identify a person: no IP, no user agent, no id is
 * written. The request-rate guard keeps its short memory in `rateLimit.ts`.
 */
let db: DatabaseSync | null = null

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS counters (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS views (
    day TEXT NOT NULL,
    path TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, path)
  );
  CREATE TABLE IF NOT EXISTS sessions (
    day TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS referrers (
    day TEXT NOT NULL,
    host TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, host)
  );
  INSERT OR IGNORE INTO counters (key, value) VALUES ('likes', 0);
`

export function useDb() {
  if (db) return db
  const file = resolve(useRuntimeConfig().dataDir, 'site.sqlite')
  mkdirSync(dirname(file), { recursive: true })
  db = new DatabaseSync(file)
  // WAL lets the stats read while a visit is being written, and a busy
  // timeout turns a rare collision into a short wait instead of an error
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA busy_timeout = 2000')
  db.exec(SCHEMA)
  return db
}

/** Today's date as `YYYY-MM-DD`, UTC, the day key every table shares. */
export function today() {
  return new Date().toISOString().slice(0, 10)
}

export function getLikes(): number {
  const row = useDb()
    .prepare('SELECT value FROM counters WHERE key = ?')
    .get('likes') as { value: number } | undefined
  return row?.value ?? 0
}

export function addLike(): number {
  useDb()
    .prepare("UPDATE counters SET value = value + 1 WHERE key = 'likes'")
    .run()
  return getLikes()
}

/** One like fewer, never below zero. */
export function removeLike(): number {
  useDb()
    .prepare(
      "UPDATE counters SET value = value - 1 WHERE key = 'likes' AND value > 0",
    )
    .run()
  return getLikes()
}

export function recordView(path: string) {
  useDb()
    .prepare(
      `INSERT INTO views (day, path, count) VALUES (?, ?, 1)
       ON CONFLICT (day, path) DO UPDATE SET count = count + 1`,
    )
    .run(today(), path)
}

export function recordSession(referrerHost: string | null) {
  const d = useDb()
  const day = today()
  d.prepare(
    `INSERT INTO sessions (day, count) VALUES (?, 1)
     ON CONFLICT (day) DO UPDATE SET count = count + 1`,
  ).run(day)
  if (referrerHost) {
    d.prepare(
      `INSERT INTO referrers (day, host, count) VALUES (?, ?, 1)
       ON CONFLICT (day, host) DO UPDATE SET count = count + 1`,
    ).run(day, referrerHost)
  }
}

/** Everything the stats endpoint shows, over the last `days` days. */
export function readStats(days: number) {
  const d = useDb()
  const since = new Date(Date.now() - (days - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10)

  const byDay = d
    .prepare(
      `SELECT v.day AS day,
              SUM(v.count) AS views,
              COALESCE(s.count, 0) AS sessions
       FROM views v LEFT JOIN sessions s ON s.day = v.day
       WHERE v.day >= ?
       GROUP BY v.day ORDER BY v.day DESC`,
    )
    .all(since) as { day: string; views: number; sessions: number }[]

  const byPath = d
    .prepare(
      `SELECT path, SUM(count) AS views FROM views
       WHERE day >= ? GROUP BY path ORDER BY views DESC LIMIT 50`,
    )
    .all(since) as { path: string; views: number }[]

  const byReferrer = d
    .prepare(
      `SELECT host, SUM(count) AS sessions FROM referrers
       WHERE day >= ? GROUP BY host ORDER BY sessions DESC LIMIT 50`,
    )
    .all(since) as { host: string; sessions: number }[]

  const totals = d
    .prepare(
      `SELECT (SELECT COALESCE(SUM(count), 0) FROM views) AS views,
              (SELECT COALESCE(SUM(count), 0) FROM sessions) AS sessions`,
    )
    .get() as { views: number; sessions: number }

  return {
    likes: getLikes(),
    since,
    totals,
    days: byDay,
    paths: byPath,
    referrers: byReferrer,
  }
}
