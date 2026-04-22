import { json, error } from '../../lib/response.js'
import { hashPassword } from '../../lib/password.js'

export async function onRequestPost({ request, env, data }) {
  if (!data.session || data.session.type !== 'teacher') return error('需要老師身份', 401)
  const teacherId = data.session.id

  let body
  try {
    body = await request.json()
  } catch {
    return error('無效的 JSON', 400)
  }
  const { username, display_name, password, class_id } = body || {}
  if (!username || !display_name || !password) {
    return error('username / display_name / password 必填', 400)
  }
  if (password.length < 4) return error('密碼至少 4 碼', 400)

  const existing = await env.DB.prepare('SELECT id FROM students WHERE username = ?')
    .bind(username)
    .first()
  if (existing) return error('此 username 已被使用', 409)

  const hash = await hashPassword(password)
  const result = await env.DB.prepare(
    `INSERT INTO students (username, display_name, password_hash, created_by_teacher_id)
     VALUES (?, ?, ?, ?)`
  )
    .bind(username, display_name, hash, teacherId)
    .run()
  const studentId = result.meta.last_row_id

  if (class_id) {
    const cls = await env.DB.prepare('SELECT teacher_id FROM classes WHERE id = ?')
      .bind(class_id)
      .first()
    if (cls && cls.teacher_id === teacherId) {
      await env.DB.prepare(
        'INSERT INTO class_students (class_id, student_id) VALUES (?, ?)'
      )
        .bind(class_id, studentId)
        .run()
    }
  }

  return json({ id: studentId, username, display_name })
}
