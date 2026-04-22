import { json, error } from '../../lib/response.js'
import { SUBJECT_LIST } from '../../lib/subjects.js'

function todayTPE() {
  // Asia/Taipei = UTC+8
  const tpe = new Date(Date.now() + 8 * 3600 * 1000)
  return tpe.toISOString().slice(0, 10)
}

export async function onRequestGet({ env, data }) {
  if (!data.session || data.session.type !== 'student') return error('需要學生身份', 401)
  const studentId = data.session.id

  const student = await env.DB.prepare(
    'SELECT id, display_name, daily_goal FROM students WHERE id = ?'
  )
    .bind(studentId)
    .first()
  if (!student) return error('not found', 404)

  const today = todayTPE()

  const recent = await env.DB.prepare(
    'SELECT date, goal_met FROM daily_streaks WHERE student_id = ? ORDER BY date DESC LIMIT 365'
  )
    .bind(studentId)
    .all()

  let streak = 0
  let expected = today
  for (const row of recent.results || []) {
    if (row.date !== expected) break
    if (!row.goal_met) break
    streak++
    const d = new Date(expected + 'T00:00:00+08:00')
    d.setUTCDate(d.getUTCDate() - 1)
    expected = d.toISOString().slice(0, 10)
  }

  const todayRow = await env.DB.prepare(
    'SELECT questions_answered FROM daily_streaks WHERE student_id = ? AND date = ?'
  )
    .bind(studentId, today)
    .first()
  const dailyDone = todayRow?.questions_answered || 0

  const sevenAgoIso = new Date(Date.now() - 7 * 86400 * 1000).toISOString()
  const subjectStats = {}
  for (const subject of SUBJECT_LIST) {
    const todayDoneRow = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM student_attempts sa
       JOIN questions q ON q.id = sa.question_id
       WHERE sa.student_id = ? AND q.subject = ? AND DATE(sa.created_at) = ?`
    )
      .bind(studentId, subject, today)
      .first()
    const days = await env.DB.prepare(
      `SELECT DATE(sa.created_at) AS d,
              SUM(sa.correct) AS correct,
              COUNT(*) AS total
       FROM student_attempts sa
       JOIN questions q ON q.id = sa.question_id
       WHERE sa.student_id = ? AND q.subject = ? AND sa.created_at >= ?
       GROUP BY DATE(sa.created_at)
       ORDER BY d`
    )
      .bind(studentId, subject, sevenAgoIso)
      .all()
    const byDate = Object.fromEntries(
      (days.results || []).map((r) => [
        r.d,
        r.total > 0 ? Math.round((r.correct * 100) / r.total) : 0,
      ])
    )
    const weekAccuracy = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400 * 1000 + 8 * 3600 * 1000)
        .toISOString()
        .slice(0, 10)
      weekAccuracy.push(byDate[d] || 0)
    }
    const filled = weekAccuracy.filter((v) => v > 0)
    const avg = filled.length
      ? Math.round(filled.reduce((a, b) => a + b, 0) / filled.length)
      : 0
    subjectStats[subject] = {
      todayDone: todayDoneRow?.n || 0,
      todayTotal: 10,
      weekAccuracy,
      avg,
    }
  }

  const mistakeRow = await env.DB.prepare(
    `SELECT COUNT(DISTINCT question_id) AS n
     FROM student_attempts WHERE student_id = ? AND correct = 0`
  )
    .bind(studentId)
    .first()

  return json({
    student: {
      id: student.id,
      display_name: student.display_name,
      daily_goal: student.daily_goal,
    },
    streak,
    dailyDone,
    subjectStats,
    mistakeCount: mistakeRow?.n || 0,
    badgeEarned: 0,
    badgeTotal: 20,
  })
}
