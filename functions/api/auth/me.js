import { json } from '../../lib/response.js'

export async function onRequestGet({ env, data }) {
  const session = data.session
  if (!session) return json({ user: null })

  if (session.type === 'teacher') {
    const t = await env.DB.prepare('SELECT id, email, name FROM teachers WHERE id = ?')
      .bind(session.id)
      .first()
    if (!t) return json({ user: null })
    return json({ user: { id: t.id, type: 'teacher', email: t.email, name: t.name } })
  }

  if (session.type === 'student') {
    const s = await env.DB.prepare(
      'SELECT id, username, display_name, daily_goal FROM students WHERE id = ?'
    )
      .bind(session.id)
      .first()
    if (!s) return json({ user: null })
    return json({
      user: {
        id: s.id,
        type: 'student',
        username: s.username,
        display_name: s.display_name,
        daily_goal: s.daily_goal,
      },
    })
  }

  return json({ user: null })
}
