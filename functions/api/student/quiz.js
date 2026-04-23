import { json, error } from '../../lib/response.js'
import { SUBJECT_LIST } from '../../lib/subjects.js'

export async function onRequestGet({ request, env, data }) {
  if (!data.session || data.session.type !== 'student') return error('需要學生身份', 401)
  const url = new URL(request.url)
  const subject = url.searchParams.get('subject')
  const count = Math.min(
    parseInt(url.searchParams.get('count') || '10', 10) || 10,
    50
  )
  const unit = url.searchParams.get('unit') || ''
  const gradeParam = url.searchParams.get('grade') || ''
  const shuffle = url.searchParams.get('shuffle') === '1'
  if (!SUBJECT_LIST.includes(subject)) return error('subject 不正確', 400)

  let sql = `SELECT id, subject, grade, unit, difficulty, question, zhuyin, image_url,
                    option_a, option_b, option_c, option_d, answer, explanation
             FROM questions WHERE subject = ?`
  const binds = [subject]
  if (unit) {
    sql += ' AND unit = ?'
    binds.push(unit)
  }
  if (gradeParam) {
    const g = parseInt(gradeParam, 10)
    if (g >= 1 && g <= 6) {
      sql += ' AND grade = ?'
      binds.push(g)
    }
  }
  sql += ' ORDER BY RANDOM() LIMIT ?'
  binds.push(count)

  const rows = await env.DB.prepare(sql)
    .bind(...binds)
    .all()

  const questions = (rows.results || []).map((q) => {
    const base = {
      id: q.id,
      subject: q.subject,
      grade: q.grade,
      unit: q.unit,
      difficulty: q.difficulty,
      question: q.question,
      zhuyin: q.zhuyin ? safeParse(q.zhuyin) : null,
      image_url: q.image_url || null,
      options: [
        { label: 'A', text: q.option_a },
        { label: 'B', text: q.option_b },
        { label: 'C', text: q.option_c },
        { label: 'D', text: q.option_d },
      ],
      answer: q.answer,
      explanation: q.explanation,
    }
    return shuffle ? shuffleOptions(base) : base
  })

  return json({ subject, questions })
}

// Permute options A/B/C/D so the correct-letter isn't memorisable across
// practice sessions. Re-labels `answer` to match the new position.
function shuffleOptions(q) {
  const letters = ['A', 'B', 'C', 'D']
  const perm = [...letters]
  for (let i = perm.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }
  const byLabel = Object.fromEntries(q.options.map((o) => [o.label, o.text]))
  const options = perm.map((origLetter, i) => ({
    label: letters[i],
    text: byLabel[origLetter],
  }))
  const answer = letters[perm.indexOf(q.answer)]
  return { ...q, options, answer }
}

function safeParse(s) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
