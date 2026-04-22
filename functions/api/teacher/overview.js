import { json, error } from '../../lib/response.js'

export async function onRequestGet({ env, data }) {
  if (!data.session || data.session.type !== 'teacher') return error('需要老師身份', 401)
  const teacherId = data.session.id

  const cls = await env.DB.prepare(
    'SELECT id, name, invite_code, grade FROM classes WHERE teacher_id = ? ORDER BY id LIMIT 1'
  )
    .bind(teacherId)
    .first()
  if (!cls) return json({ hasClass: false })

  const sevenAgoIso = new Date(Date.now() - 7 * 86400 * 1000).toISOString()

  const totalRow = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM class_students WHERE class_id = ?'
  )
    .bind(cls.id)
    .first()

  const activeRow = await env.DB.prepare(
    `SELECT COUNT(DISTINCT sa.student_id) AS n
     FROM student_attempts sa
     JOIN class_students cs ON cs.student_id = sa.student_id AND cs.class_id = ?
     WHERE sa.created_at >= ?`
  )
    .bind(cls.id, sevenAgoIso)
    .first()

  const weekQRow = await env.DB.prepare(
    `SELECT COUNT(*) AS n
     FROM student_attempts sa
     JOIN class_students cs ON cs.student_id = sa.student_id AND cs.class_id = ?
     WHERE sa.created_at >= ?`
  )
    .bind(cls.id, sevenAgoIso)
    .first()

  const accRow = await env.DB.prepare(
    `SELECT SUM(sa.correct) AS c, COUNT(*) AS t
     FROM student_attempts sa
     JOIN class_students cs ON cs.student_id = sa.student_id AND cs.class_id = ?
     WHERE sa.created_at >= ?`
  )
    .bind(cls.id, sevenAgoIso)
    .first()
  const avgAccuracy = accRow?.t > 0 ? Math.round((accRow.c * 100) / accRow.t) : 0

  const trendRows = await env.DB.prepare(
    `SELECT DATE(sa.created_at) AS d, COUNT(*) AS n
     FROM student_attempts sa
     JOIN class_students cs ON cs.student_id = sa.student_id AND cs.class_id = ?
     WHERE sa.created_at >= ?
     GROUP BY DATE(sa.created_at) ORDER BY d`
  )
    .bind(cls.id, sevenAgoIso)
    .all()
  const trendMap = Object.fromEntries((trendRows.results || []).map((r) => [r.d, r.n]))
  const weekTrend = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400 * 1000 + 8 * 3600 * 1000)
      .toISOString()
      .slice(0, 10)
    weekTrend.push(trendMap[d] || 0)
  }

  const studentsRows = await env.DB.prepare(
    `SELECT s.id, s.username, s.display_name,
            (SELECT MAX(sa.created_at) FROM student_attempts sa WHERE sa.student_id = s.id) AS last_active,
            (SELECT COUNT(*) FROM student_attempts sa
               WHERE sa.student_id = s.id AND sa.created_at >= ?) AS week_q,
            (SELECT CASE WHEN COUNT(*) > 0
                    THEN ROUND(SUM(sa.correct) * 100.0 / COUNT(*))
                    ELSE 0 END
             FROM student_attempts sa
             WHERE sa.student_id = s.id AND sa.created_at >= ?) AS accuracy
     FROM class_students cs
     JOIN students s ON s.id = cs.student_id
     WHERE cs.class_id = ?
     ORDER BY s.id`
  )
    .bind(sevenAgoIso, sevenAgoIso, cls.id)
    .all()

  const students = []
  for (const row of studentsRows.results || []) {
    const daily = await env.DB.prepare(
      `SELECT DATE(sa.created_at) AS d,
              CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(sa.correct) * 100.0 / COUNT(*)) ELSE 0 END AS acc
       FROM student_attempts sa
       WHERE sa.student_id = ? AND sa.created_at >= ?
       GROUP BY DATE(sa.created_at) ORDER BY d`
    )
      .bind(row.id, sevenAgoIso)
      .all()
    const byD = Object.fromEntries((daily.results || []).map((r) => [r.d, r.acc]))
    const trend = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400 * 1000 + 8 * 3600 * 1000)
        .toISOString()
        .slice(0, 10)
      trend.push(byD[d] ?? (row.accuracy || 0))
    }
    const weekQ = row.week_q || 0
    const accuracy = row.accuracy || 0
    const status = weekQ < 20 || accuracy < 55 ? 'warn' : 'active'
    students.push({
      id: row.id,
      username: row.username,
      display_name: row.display_name,
      last_active: row.last_active,
      week_q: weekQ,
      accuracy,
      trend,
      status,
    })
  }

  const needAttention = students.filter((s) => s.status === 'warn').length

  return json({
    hasClass: true,
    class: {
      id: cls.id,
      name: cls.name,
      invite_code: cls.invite_code,
      grade: cls.grade,
    },
    stats: {
      totalStudents: totalRow?.n || 0,
      activeStudents: activeRow?.n || 0,
      weekQuestions: weekQRow?.n || 0,
      avgAccuracy,
      needAttention,
    },
    weekTrend,
    students,
  })
}
