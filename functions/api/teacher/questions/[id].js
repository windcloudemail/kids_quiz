import { json, error } from '../../../lib/response.js'

const EDITABLE = [
  'source_number',
  'subject',
  'grade',
  'unit',
  'difficulty',
  'question',
  'zhuyin',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'answer',
  'explanation',
]

export async function onRequestPatch({ request, env, data, params }) {
  if (!data.session || data.session.type !== 'teacher') return error('需要老師身份', 401)
  const teacherId = data.session.id
  const id = parseInt(params.id, 10)
  if (!id) return error('bad id', 400)

  const row = await env.DB.prepare('SELECT owner_teacher_id FROM questions WHERE id = ?')
    .bind(id)
    .first()
  if (!row) return error('not found', 404)
  if (row.owner_teacher_id !== teacherId) return error('只能修改自己的題目', 403)

  let body
  try {
    body = await request.json()
  } catch {
    return error('無效的 JSON', 400)
  }

  const sets = []
  const binds = []
  for (const f of EDITABLE) {
    if (Object.prototype.hasOwnProperty.call(body, f)) {
      let v = body[f]
      if (f === 'zhuyin' && v && typeof v !== 'string') v = JSON.stringify(v)
      sets.push(`${f} = ?`)
      binds.push(v)
    }
  }
  if (!sets.length) return json({ ok: true })
  binds.push(id)
  await env.DB.prepare(`UPDATE questions SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...binds)
    .run()
  return json({ ok: true })
}

export async function onRequestDelete({ env, data, params }) {
  if (!data.session || data.session.type !== 'teacher') return error('需要老師身份', 401)
  const teacherId = data.session.id
  const id = parseInt(params.id, 10)
  if (!id) return error('bad id', 400)

  const row = await env.DB.prepare('SELECT owner_teacher_id FROM questions WHERE id = ?')
    .bind(id)
    .first()
  if (!row) return error('not found', 404)
  if (row.owner_teacher_id !== teacherId) return error('只能刪除自己的題目', 403)

  await env.DB.prepare('DELETE FROM questions WHERE id = ?').bind(id).run()
  return json({ ok: true })
}
