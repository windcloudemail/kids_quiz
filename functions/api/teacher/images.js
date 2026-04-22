import { json, error } from '../../lib/response.js'

// POST body: { filename?: string, content_type?: string, data: base64 }
// Response: { key, url } — url is the public-ish media proxy path; store in
// questions.image_url.
export async function onRequestPost({ request, env, data }) {
  if (!data.session || data.session.type !== 'teacher') {
    return error('需要老師身份', 401)
  }
  const teacherId = data.session.id

  let body
  try {
    body = await request.json()
  } catch {
    return error('無效的 JSON', 400)
  }
  const { filename, content_type, data: b64 } = body || {}
  if (!b64 || typeof b64 !== 'string') return error('缺 data (base64)', 400)

  let bytes
  try {
    const bin = atob(b64)
    bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  } catch (e) {
    return error('base64 decode 失敗: ' + e.message, 400)
  }

  // Basic size guard: 2MB per image is plenty for a cropped PDF question.
  if (bytes.byteLength > 2 * 1024 * 1024) {
    return error('單張圖不得大於 2MB', 413)
  }

  const extGuess = (filename?.split('.').pop() || 'png').toLowerCase()
  const ext = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extGuess)
    ? extGuess
    : 'png'
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const key = `teacher/${teacherId}/${Date.now()}-${rand}.${ext}`

  await env.MEDIA.put(key, bytes, {
    httpMetadata: {
      contentType: content_type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      cacheControl: 'public, max-age=31536000, immutable',
    },
  })

  return json({ key, url: '/api/media/' + key })
}
