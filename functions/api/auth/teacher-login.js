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
  const { email, password } = body || {}
  if (!email || !password) return error('帳號密碼必填', 400)

  const teacher = await env.DB.prepare(
    'SELECT id, email, password_hash, name FROM teachers WHERE email = ?'
  )
    .bind(email)
    .first()
  if (!teacher) return error('帳號或密碼錯誤', 401)

  const ok = await verifyPassword(password, teacher.password_hash)
  if (!ok) return error('帳號或密碼錯誤', 401)

  const { token } = await createSession(env, 'teacher', teacher.id)
  return json(
    {
      user: {
        id: teacher.id,
        type: 'teacher',
        email: teacher.email,
        name: teacher.name,
      },
    },
    { headers: { 'Set-Cookie': sessionCookie(token, request) } }
  )
}
