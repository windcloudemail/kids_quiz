import { json, error } from '../../../lib/response.js'
import { SUBJECT_LIST } from '../../../lib/subjects.js'

const BATCH_SIZE = 50
const VALID_ANSWERS = ['A', 'B', 'C', 'D']

const INSERT_SQL = `INSERT INTO questions
  (owner_teacher_id, subject, grade, unit, difficulty, question, zhuyin,
   option_a, option_b, option_c, option_d, answer, explanation)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

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

  const list = Array.isArray(body?.questions) ? body.questions : []
  if (!list.length) return error('沒有題目資料', 400)
  if (list.length > 500) return error('一次最多上傳 500 題', 400)

  const errors = []
  const valid = []
  list.forEach((q, i) => {
    const reasons = []
    if (!q?.question) reasons.push('題目空白')
    if (!q?.option_a || !q?.option_b || !q?.option_c || !q?.option_d)
      reasons.push('選項不齊')
    if (!VALID_ANSWERS.includes(String(q?.answer || '').toUpperCase()))
      reasons.push('答案需為 A/B/C/D')
    if (!SUBJECT_LIST.includes(q?.subject)) reasons.push('subject 不正確')
    const grade = parseInt(q?.grade, 10)
    if (!(grade >= 1 && grade <= 6)) reasons.push('grade 需 1-6')
    if (reasons.length) {
      errors.push({ index: i, reason: reasons.join('、') })
    } else {
      valid.push(q)
    }
  })

  let totalInserted = 0
  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE)
    const stmts = batch.map((q) =>
      env.DB.prepare(INSERT_SQL).bind(
        teacherId,
        q.subject,
        parseInt(q.grade, 10),
        q.unit || null,
        parseInt(q.difficulty, 10) || 1,
        q.question,
        q.zhuyin
          ? typeof q.zhuyin === 'string'
            ? q.zhuyin
            : JSON.stringify(q.zhuyin)
          : null,
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
        String(q.answer).toUpperCase(),
        q.explanation || null
      )
    )
    try {
      await env.DB.batch(stmts)
      totalInserted += batch.length
    } catch (e) {
      errors.push({ batch: i / BATCH_SIZE, reason: e.message })
    }
  }

  return json({
    inserted: totalInserted,
    total: list.length,
    errors,
  })
}
