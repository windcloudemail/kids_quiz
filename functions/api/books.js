import { json, error } from '../lib/response.js'

// GET /api/books
// Returns every (subject, grade, unit) group as a "book" with:
//   - count: total questions in the book
//   - mastered (student only): questions this student has answered
//     correctly at least MASTERY_THRESHOLD times
// Teachers get count only; students get mastery too.
const MASTERY_THRESHOLD = 3

export async function onRequestGet({ env, data }) {
  const session = data.session
  if (!session) return error('需要登入', 401)

  const rows = await env.DB.prepare(
    `SELECT subject, grade, unit, COUNT(*) AS count
     FROM questions
     GROUP BY subject, grade, unit
     ORDER BY subject, grade, unit`
  ).all()
  const books = rows.results || []

  if (session.type !== 'student') {
    return json({ books: books.map((b) => ({ ...b, mastered: 0 })) })
  }

  // student: for each book compute mastered count
  const studentId = session.id
  const masteredRows = await env.DB.prepare(
    `SELECT q.subject, q.grade, q.unit, COUNT(DISTINCT q.id) AS mastered
     FROM questions q
     JOIN (
       SELECT question_id
       FROM student_attempts
       WHERE student_id = ? AND correct = 1
       GROUP BY question_id
       HAVING COUNT(*) >= ?
     ) m ON m.question_id = q.id
     GROUP BY q.subject, q.grade, q.unit`
  )
    .bind(studentId, MASTERY_THRESHOLD)
    .all()
  const masteryMap = new Map()
  for (const r of masteredRows.results || []) {
    masteryMap.set(keyOf(r), r.mastered)
  }
  return json({
    books: books.map((b) => ({
      ...b,
      mastered: masteryMap.get(keyOf(b)) || 0,
    })),
  })
}

function keyOf(r) {
  return `${r.subject}|${r.grade}|${r.unit || ''}`
}
