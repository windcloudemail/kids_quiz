import { json, error } from '../../lib/response.js'

const MASTERY_THRESHOLD = 3

// POST /api/practice/start
// body: {
//   books?: [{ subject, grade, unit }]   // empty/undefined = all
//   count: number                          // 1..100
//   exclude_mastered?: boolean             // student only
//   shuffle_options?: boolean
// }
// Response: { questions: [...], previewMode: boolean }
export async function onRequestPost({ request, env, data }) {
  const session = data.session
  if (!session) return error('需要登入', 401)

  let body
  try {
    body = await request.json()
  } catch {
    return error('無效的 JSON', 400)
  }

  const count = Math.min(
    100,
    Math.max(1, parseInt(body?.count, 10) || 10)
  )
  const books = Array.isArray(body?.books) ? body.books : []
  const excludeMastered = !!body?.exclude_mastered && session.type === 'student'
  const shuffleOptions = !!body?.shuffle_options

  let sql = `SELECT id, source_number, subject, grade, unit, difficulty, question, zhuyin, image_url,
                    option_a, option_b, option_c, option_d, answer, explanation
             FROM questions WHERE 1=1`
  const binds = []

  if (books.length > 0) {
    const conds = []
    for (const b of books) {
      if (!b || !b.subject) continue
      const grade = parseInt(b.grade, 10)
      const unit = b.unit == null ? '' : String(b.unit)
      conds.push('(subject = ? AND grade = ? AND ifnull(unit, \'\') = ?)')
      binds.push(b.subject, grade, unit)
    }
    if (!conds.length) return error('沒有有效的題本', 400)
    sql += ' AND (' + conds.join(' OR ') + ')'
  }

  if (excludeMastered) {
    sql += ` AND id NOT IN (
      SELECT question_id FROM student_attempts
      WHERE student_id = ? AND correct = 1
      GROUP BY question_id HAVING COUNT(*) >= ?
    )`
    binds.push(session.id, MASTERY_THRESHOLD)
  }

  sql += ' ORDER BY RANDOM() LIMIT ?'
  binds.push(count)

  const rows = await env.DB.prepare(sql)
    .bind(...binds)
    .all()

  const parsed = (rows.results || []).map((q) => {
    const labels = ['A', 'B', 'C', 'D']
    let options = [
      { label: 'A', text: q.option_a },
      { label: 'B', text: q.option_b },
      { label: 'C', text: q.option_c },
      { label: 'D', text: q.option_d },
    ]
    let answer = q.answer
    if (shuffleOptions) {
      // Produce a permutation, remember which position holds the correct answer.
      const entries = options.map((o, i) => ({
        originalLetter: o.label,
        text: o.text,
        correct: o.label === q.answer,
        order: Math.random(),
      }))
      entries.sort((a, b) => a.order - b.order)
      options = entries.map((e, i) => ({ label: labels[i], text: e.text }))
      const newIdx = entries.findIndex((e) => e.correct)
      answer = labels[newIdx]
    }
    return {
      id: q.id,
      source_number: q.source_number,
      subject: q.subject,
      grade: q.grade,
      unit: q.unit,
      difficulty: q.difficulty,
      question: q.question,
      zhuyin: q.zhuyin ? safeParse(q.zhuyin) : null,
      image_url: q.image_url || null,
      options,
      answer,
      explanation: q.explanation,
    }
  })

  return json({
    questions: parsed,
    previewMode: session.type !== 'student',
  })
}

function safeParse(s) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
