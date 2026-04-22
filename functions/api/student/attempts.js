import { json, error } from '../../lib/response.js'

function todayTPE() {
  const tpe = new Date(Date.now() + 8 * 3600 * 1000)
  return tpe.toISOString().slice(0, 10)
}

export async function onRequestPost({ request, env, data }) {
  if (!data.session || data.session.type !== 'student') return error('需要學生身份', 401)
  const studentId = data.session.id

  let body
  try {
    body = await request.json()
  } catch {
    return error('無效的 JSON', 400)
  }
  const attempts = Array.isArray(body?.attempts) ? body.attempts : []
  const classId = body?.class_id || null
  if (!attempts.length) return error('沒有作答資料', 400)

  const stmts = []
  for (const a of attempts) {
    if (!a.question_id || !a.selected) continue
    stmts.push(
      env.DB.prepare(
        `INSERT INTO student_attempts
         (student_id, question_id, class_id, selected, correct, time_ms)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        studentId,
        a.question_id,
        classId,
        a.selected,
        a.correct ? 1 : 0,
        a.time_ms || null
      )
    )
    stmts.push(
      env.DB.prepare('UPDATE questions SET used_count = used_count + 1 WHERE id = ?').bind(
        a.question_id
      )
    )
  }

  const today = todayTPE()
  const studentRow = await env.DB.prepare('SELECT daily_goal FROM students WHERE id = ?')
    .bind(studentId)
    .first()
  const goal = studentRow?.daily_goal || 30

  stmts.push(
    env.DB.prepare(
      `INSERT INTO daily_streaks (student_id, date, questions_answered, goal_met)
       VALUES (?, ?, ?, 0)
       ON CONFLICT(student_id, date) DO UPDATE SET
         questions_answered = daily_streaks.questions_answered + excluded.questions_answered`
    ).bind(studentId, today, attempts.length)
  )

  await env.DB.batch(stmts)

  await env.DB.prepare(
    `UPDATE daily_streaks
     SET goal_met = CASE WHEN questions_answered >= ? THEN 1 ELSE 0 END
     WHERE student_id = ? AND date = ?`
  )
    .bind(goal, studentId, today)
    .run()

  const correctCount = attempts.filter((a) => a.correct).length
  return json({
    ok: true,
    correct: correctCount,
    wrong: attempts.length - correctCount,
    stars: correctCount * 10,
  })
}
