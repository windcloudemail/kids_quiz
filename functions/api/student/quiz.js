import { json, error } from '../../lib/response.js'
import { SUBJECT_LIST } from '../../lib/subjects.js'

export async function onRequestGet({ request, env, data }) {
  if (!data.session || data.session.type !== 'student') return error('需要學生身份', 401)
  const url = new URL(request.url)
  const subject = url.searchParams.get('subject')
  const count = Math.min(parseInt(url.searchParams.get('count') || '10', 10) || 10, 20)
  if (!SUBJECT_LIST.includes(subject)) return error('subject 不正確', 400)

  const rows = await env.DB.prepare(
    `SELECT id, subject, grade, unit, difficulty, question, zhuyin,
            option_a, option_b, option_c, option_d, answer, explanation
     FROM questions WHERE subject = ? ORDER BY RANDOM() LIMIT ?`
  )
    .bind(subject, count)
    .all()

  const questions = (rows.results || []).map((q) => ({
    id: q.id,
    subject: q.subject,
    grade: q.grade,
    unit: q.unit,
    difficulty: q.difficulty,
    question: q.question,
    zhuyin: q.zhuyin ? safeParse(q.zhuyin) : null,
    options: [
      { label: 'A', text: q.option_a },
      { label: 'B', text: q.option_b },
      { label: 'C', text: q.option_c },
      { label: 'D', text: q.option_d },
    ],
    answer: q.answer,
    explanation: q.explanation,
  }))

  return json({ subject, questions })
}

function safeParse(s) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
