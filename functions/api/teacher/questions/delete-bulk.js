import { json, error } from '../../../lib/response.js'

// POST body: { ids: number[] }
// Response: { deleted: n, skipped: m }  — skipped = not-owned or not-found
export async function onRequestPost({ request, env, data }) {
  if (!data.session || data.session.type !== 'teacher') {
    return error('需要老師身份', 401)
  }
  const teacherId = data.session.id

  let body
  try {
    body = await request.json()
  } catch {
    return error('無效的 JSON', 400)
  }

  const ids = Array.isArray(body?.ids)
    ? body.ids.map((i) => parseInt(i, 10)).filter((i) => Number.isInteger(i) && i > 0)
    : []
  if (!ids.length) return error('沒有指定要刪除的題目', 400)
  if (ids.length > 500) return error('一次最多刪 500 題', 400)

  const placeholders = ids.map(() => '?').join(',')
  const ownedRows = await env.DB.prepare(
    `SELECT id, image_url FROM questions WHERE id IN (${placeholders}) AND owner_teacher_id = ?`
  )
    .bind(...ids, teacherId)
    .all()
  const owned = ownedRows.results || []
  const ownedIds = owned.map((r) => r.id)

  if (!ownedIds.length) {
    return json({ deleted: 0, skipped: ids.length })
  }

  const op = ownedIds.map(() => '?').join(',')
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM student_attempts WHERE question_id IN (${op})`).bind(...ownedIds),
    env.DB.prepare(`DELETE FROM questions WHERE id IN (${op})`).bind(...ownedIds),
  ])

  // Best-effort R2 cleanup (errors silently swallowed)
  if (env.MEDIA) {
    for (const row of owned) {
      if (row.image_url && row.image_url.startsWith('/api/media/')) {
        const key = decodeURIComponent(row.image_url.replace('/api/media/', ''))
        try {
          await env.MEDIA.delete(key)
        } catch {
          /* ignore */
        }
      }
    }
  }

  return json({
    deleted: ownedIds.length,
    skipped: ids.length - ownedIds.length,
  })
}
