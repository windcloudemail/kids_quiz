import { json, error } from '../../lib/response.js'
import { hashPassword } from '../../lib/password.js'
import { createSession, sessionCookie } from '../../lib/session.js'

export async function onRequestPost({ request, env }) {
  let body
  try {
    body = await request.json()
  } catch {
    return error('無效的 JSON', 400)
  }
  const { email, password, name } = body || {}
  if (!email || !password) return error('email 與 password 必填', 400)
  if (password.length < 4) return error('密碼至少 4 碼', 400)

  const allowlist = (env.ALLOWED_TEACHER_EMAILS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (allowlist.length && !allowlist.includes(email)) {
    return error('此 email 未授權註冊', 403)
  }

  const existing = await env.DB.prepare('SELECT id FROM teachers WHERE email = ?')
    .bind(email)
    .first()
  if (existing) return error('此 email 已被註冊', 409)

  const hash = await hashPassword(password)
  const result = await env.DB.prepare(
    'INSERT INTO teachers (email, password_hash, name) VALUES (?, ?, ?)'
  )
    .bind(email, hash, name || null)
    .run()
  const teacherId = result.meta.last_row_id

  const { token } = await createSession(env, 'teacher', teacherId)
  return json(
    {
      user: { id: teacherId, type: 'teacher', email, name: name || null },
    },
    { headers: { 'Set-Cookie': sessionCookie(token, request) } }
  )
}
