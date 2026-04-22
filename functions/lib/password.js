const SALT = 'kids-dev'

function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(plaintext) {
  const data = new TextEncoder().encode(`${SALT}:${plaintext}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return hex(buf)
}

export async function verifyPassword(plaintext, hash) {
  const computed = await hashPassword(plaintext)
  return computed === hash
}
