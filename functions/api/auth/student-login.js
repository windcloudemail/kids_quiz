import { json, error } from '../../lib/response.js'
import { verifyPassword } from '../../lib/password.js'
import { createSession, sessionCookie } from '../../lib/session.js'

export async function onRequestPost({ request, env }) {
  let body
  try {
    body = await request.json()
  } catch {
    return error('無效的 JSON', 400)
  }
  const { username, password } = body || {}
  if (!username || !password) return error('帳號密碼必填', 400)

  const student = await env.DB.prepare(
    'SELECT id, username, display_name, password_hash, daily_goal FROM students WHERE username = ?'
  )
    .bind(username)
    .first()
  if (!student) return error('帳號或密碼錯誤', 401)

  const ok = await verifyPassword(password, student.password_hash)
  if (!ok) return error('帳號或密碼錯誤', 401)

  const { token } = await createSession(env, 'student', student.id)
  return json(
    {
      user: {
        id: student.id,
        type: 'student',
        username: student.username,
        display_name: student.display_name,
        daily_goal: student.daily_goal,
      },
    },
    { headers: { 'Set-Cookie': sessionCookie(token, request) } }
  )
}
