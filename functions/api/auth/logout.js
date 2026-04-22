import { json } from '../../lib/response.js'
import { COOKIE_NAME, parseCookie, deleteSession, clearCookie } from '../../lib/session.js'

export async function onRequestPost({ request, env }) {
  const token = parseCookie(request.headers.get('Cookie'), COOKIE_NAME)
  if (token) await deleteSession(env, token)
  return json({ ok: true }, { headers: { 'Set-Cookie': clearCookie(request) } })
}
