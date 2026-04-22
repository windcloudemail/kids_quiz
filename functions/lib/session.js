export const COOKIE_NAME = 'kq_session'
const TTL_DAYS = 14

function randomToken() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function createSession(env, userType, userId) {
  const token = randomToken()
  const expires = new Date(Date.now() + TTL_DAYS * 86400 * 1000)
  await env.DB.prepare(
    'INSERT INTO sessions (token, user_type, user_id, expires_at) VALUES (?, ?, ?, ?)'
  )
    .bind(token, userType, userId, expires.toISOString())
    .run()
  return { token, expires }
}

export async function resolveSession(env, token) {
  if (!token) return null
  const row = await env.DB.prepare(
    'SELECT user_type, user_id, expires_at FROM sessions WHERE token = ?'
  )
    .bind(token)
    .first()
  if (!row) return null
  if (new Date(row.expires_at) < new Date()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run()
    return null
  }
  return { type: row.user_type, id: row.user_id }
}

export async function deleteSession(env, token) {
  if (!token) return
  await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run()
}

export function parseCookie(header, name) {
  if (!header) return null
  const parts = header.split(';').map((s) => s.trim())
  const match = parts.find((s) => s.startsWith(`${name}=`))
  if (!match) return null
  return match.substring(name.length + 1)
}

export function cookieHeader(name, value, opts = {}) {
  const parts = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`)
  if (opts.secure) parts.push('Secure')
  return parts.join('; ')
}

export function sessionCookie(token, request) {
  return cookieHeader(COOKIE_NAME, token, {
    maxAge: TTL_DAYS * 86400,
    secure: request.url.startsWith('https:'),
  })
}

export function clearCookie(request) {
  return cookieHeader(COOKIE_NAME, '', {
    maxAge: 0,
    secure: request.url.startsWith('https:'),
  })
}
