import { COOKIE_NAME, parseCookie, resolveSession } from '../lib/session.js'

// Attaches `context.data.session = { type, id } | null` to every /api/* request.
// Individual handlers enforce auth; this middleware only resolves the cookie.
export async function onRequest(context) {
  const { request, env } = context
  const token = parseCookie(request.headers.get('Cookie'), COOKIE_NAME)
  const session = token ? await resolveSession(env, token) : null
  context.data.session = session
  return context.next()
}
