import { json, error } from '../../lib/response.js'
import { SUBJECT_LIST } from '../../lib/subjects.js'

// GET /api/student/books?subject=math
// Returns distinct (grade, unit) groups in the given subject, with the
// number of questions in each group. Powers the per-subject "pick a book"
// picker on the student home before starting a practice session.
export async function onRequestGet({ request, env, data }) {
  if (!data.session || data.session.type !== 'student') {
    return error('需要學生身份', 401)
  }
  const url = new URL(request.url)
  const subject = url.searchParams.get('subject')
  if (!SUBJECT_LIST.includes(subject)) return error('subject 不正確', 400)

  const rows = await env.DB.prepare(
    `SELECT grade, unit, COUNT(*) AS count
     FROM questions
     WHERE subject = ?
     GROUP BY grade, unit
     ORDER BY grade ASC, unit ASC`
  )
    .bind(subject)
    .all()

  const books = (rows.results || []).map((r) => ({
    grade: r.grade,
    unit: r.unit,
    count: r.count,
  }))
  return json({ subject, books })
}
