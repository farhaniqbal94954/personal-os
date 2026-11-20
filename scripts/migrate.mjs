/**
 * Runs automatically before every build (npm run build).
 * - On Vercel with the Supabase integration connected, it creates / upgrades the database tables,
 *   so the app works right after the first deploy — no SQL Editor needed.
 * - Locally (no POSTGRES_* variable) it simply skips.
 * Each migration in supabase/migrations runs once and is recorded in public._personal_os_migrations.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const env = process.env
const pick = (...names) => names.map((n) => env[n]).find((v) => v && v.trim())
// direct / session-mode connection first (needed for DDL), pooled URL as fallback
const url = pick(
  'POSTGRES_URL_NON_POOLING', 'SUPABASE_POSTGRES_URL_NON_POOLING', 'DATABASE_URL',
  'POSTGRES_URL', 'SUPABASE_POSTGRES_URL',
)
if (!url) {
  console.log('[migrate] No POSTGRES_URL found — skipping database setup (fine for local builds).')
  process.exit(0)
}

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations')
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

// Supabase needs SSL; strip sslmode from the URL so node-postgres does not insist on full certificate verification
const conn = url.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '')
const client = new pg.Client({ connectionString: conn, ssl: /localhost|127\.0\.0\.1/.test(conn) ? false : { rejectUnauthorized: false } })

try {
  await client.connect()
  await client.query(`create table if not exists public._personal_os_migrations (name text primary key, applied_at timestamptz not null default now())`)
  await client.query(`alter table public._personal_os_migrations enable row level security`) // not readable through the API
  const done = new Set((await client.query('select name from public._personal_os_migrations')).rows.map((r) => r.name))

  // database set up by hand before this script existed → 001 is already there
  if (!done.has('001_initial_schema.sql')) {
    const { rows } = await client.query(`select to_regclass('public.accounts') is not null as exists`)
    if (rows[0].exists) {
      await client.query(`insert into public._personal_os_migrations(name) values ('001_initial_schema.sql') on conflict do nothing`)
      done.add('001_initial_schema.sql')
      console.log('[migrate] 001_initial_schema.sql already present — marked as applied')
    }
  }

  for (const f of files) {
    if (done.has(f)) { console.log(`[migrate] ✓ ${f} (already applied)`); continue }
    const sql = readFileSync(join(dir, f), 'utf8')
    console.log(`[migrate] → applying ${f} …`)
    await client.query('begin')
    try {
      await client.query(sql)
      await client.query('insert into public._personal_os_migrations(name) values ($1)', [f])
      await client.query('commit')
      console.log(`[migrate] ✓ ${f} applied`)
    } catch (e) {
      await client.query('rollback')
      throw new Error(`${f}: ${e.message}`)
    }
  }
  await client.query(`notify pgrst, 'reload schema'`)
  console.log('[migrate] Database is up to date.')
} catch (e) {
  console.error('\n[migrate] ✗ Database setup failed:', e.message)
  console.error('[migrate] The deploy is stopped so you never get an app with missing tables.')
  console.error('[migrate] Check that the Supabase integration is connected to this Vercel project, then redeploy.\n')
  process.exit(1)
} finally {
  await client.end().catch(() => {})
}
