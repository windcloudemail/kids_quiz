import { json, error } from '../../lib/response.js'
import { SCHEMA_SQL, SEED_SQL, splitStatements } from '../../lib/bootstrap.js'

// Idempotent bootstrap for local pages dev: applies schema, then seed if
// teachers table is empty. Safe to call multiple times.
// Intentionally unauthenticated; does not exist in production deployments
// that have schema applied via `wrangler d1 execute --remote`.
export async function onRequestPost({ env }) {
  const schemaStmts = splitStatements(SCHEMA_SQL)
  for (const s of schemaStmts) {
    try {
      await env.DB.prepare(s).run()
    } catch (e) {
      return error(`schema failed on: ${s.slice(0, 80)} — ${e.message}`, 500)
    }
  }

  const existing = await env.DB.prepare('SELECT COUNT(*) AS n FROM teachers').first()
  if ((existing?.n || 0) > 0) {
    return json({ ok: true, schema: schemaStmts.length, seed: 'skipped' })
  }

  const seedStmts = splitStatements(SEED_SQL)
  for (const s of seedStmts) {
    try {
      await env.DB.prepare(s).run()
    } catch (e) {
      return error(`seed failed on: ${s.slice(0, 80)} — ${e.message}`, 500)
    }
  }

  return json({ ok: true, schema: schemaStmts.length, seed: seedStmts.length })
}
