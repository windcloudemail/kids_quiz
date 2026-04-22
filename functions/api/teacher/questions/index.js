import { json, error } from '../../../lib/response.js'
import { SUBJECT_LIST } from '../../../lib/subjects.js'

export async function onRequestGet({ request, env, data }) {
  if (!data.session || data.session.type !== 'teacher') return error('需要老師身份', 401)
  const url = new URL(request.url)
  const subject = url.searchParams.get('subject')
  const grade = url.searchParams.get('grade')
  const difficulty = url.searchParams.get('difficulty')
  const q = url.searchParams.get('q')

  let sql = `SELECT id, owner_teacher_id, source_number, subject, grade, unit, difficulty, question, used_count,
                    (SELECT CASE WHEN COUNT(*) > 0
                            THEN ROUND(SUM(sa.correct) * 100.0 / COUNT(*))
                            ELSE 0 END
                     FROM student_attempts sa WHERE sa.question_id = questions.id) AS accuracy
             FROM questions WHERE 1=1`
  const binds = []
  if (subject && SUBJECT_LIST.includes(subject)) {
    sql += ' AND subject = ?'
    binds.push(subject)
  }
  if (grade) {
    sql += ' AND grade = ?'
    binds.push(parseInt(grade, 10))
  }
  if (difficulty) {
    sql += ' AND difficulty = ?'
    binds.push(parseInt(difficulty, 10))
  }
  if (q) {
    sql += ' AND question LIKE ?'
    binds.push(`%${q}%`)
  }
  // Teacher view: follow the original booklet numbering first, then fall
  // back to insertion order. Manually added questions (no source_number)
  // sort to the end by insertion time.
  sql += ' ORDER BY COALESCE(source_number, 9999999) ASC, id ASC LIMIT 200'

  const rows = await env.DB.prepare(sql)
    .bind(...binds)
    .all()
  return json({ questions: rows.results || [], teacher_id: data.session.id })
}

export async function onRequestPost({ request, env, data }) {
  if (!data.session || data.session.type !== 'teacher') return error('需要老師身份', 401)
  const teacherId = data.session.id
  let body
  try {
    body = await request.json()
  } catch {
    return error('無效的 JSON', 400)
  }
  const required = [
    'subject',
    'grade',
    'question',
    'option_a',
    'option_b',
    'option_c',
    'option_d',
    'answer',
  ]
  for (const f of required) {
    if (body[f] === undefined || body[f] === null || body[f] === '') {
      return error(`${f} 必填`, 400)
    }
  }
  if (!SUBJECT_LIST.includes(body.subject)) return error('subject 不正確', 400)
  if (!['A', 'B', 'C', 'D'].includes(body.answer)) return error('answer 需為 A/B/C/D', 400)

  const result = await env.DB.prepare(
    `INSERT INTO questions
     (owner_teacher_id, source_number, subject, grade, unit, difficulty, question, zhuyin,
      option_a, option_b, option_c, option_d, answer, explanation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      teacherId,
      body.source_number == null || body.source_number === ''
        ? null
        : parseInt(body.source_number, 10),
      body.subject,
      body.grade,
      body.unit || null,
      body.difficulty || 1,
      body.question,
      body.zhuyin
        ? typeof body.zhuyin === 'string'
          ? body.zhuyin
          : JSON.stringify(body.zhuyin)
        : null,
      body.option_a,
      body.option_b,
      body.option_c,
      body.option_d,
      body.answer,
      body.explanation || null
    )
    .run()
  return json({ id: result.meta.last_row_id })
}
