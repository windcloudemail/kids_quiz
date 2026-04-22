// Serve images from the R2 MEDIA bucket. Catch-all so keys with slashes
// (e.g. teacher/2/abc.png) route correctly.
export async function onRequestGet({ env, params, request }) {
  const raw = params.key
  const key = Array.isArray(raw) ? raw.join('/') : raw || ''
  if (!key) return new Response('missing key', { status: 400 })

  const obj = await env.MEDIA.get(key)
  if (!obj) return new Response('not found', { status: 404 })

  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  }
  headers.set('ETag', obj.httpEtag)

  // Simple If-None-Match handling
  const inm = request.headers.get('If-None-Match')
  if (inm && inm === obj.httpEtag) {
    return new Response(null, { status: 304, headers })
  }

  return new Response(obj.body, { headers })
}
