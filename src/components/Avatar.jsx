const PALETTE = ['#3B6EA8', '#D14343', '#3B8A7C', '#8A6A3B', '#6A3B8A', '#C6651E']

function hashIndex(str, n) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h % n
}

export default function Avatar({ name = '', size = 34, color }) {
  const ch = name ? [...name][0] : '?'
  const bg = color || PALETTE[hashIndex(name || '?', PALETTE.length)]
  return (
    <span
      className="inline-flex items-center justify-center font-medium text-white select-none"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        fontSize: size * 0.45,
      }}
    >
      {ch}
    </span>
  )
}
