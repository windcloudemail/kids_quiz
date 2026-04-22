export default function BarMini({ data = [], width = 80, height = 28, color = '#1A1A1A' }) {
  if (!data.length) return null
  const max = Math.max(...data) || 1
  const gap = 2
  const barW = (width - gap * (data.length - 1)) / data.length
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {data.map((v, i) => {
        const h = (v / max) * height
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={height - h}
            width={barW}
            height={h}
            fill={color}
            opacity={0.85}
            rx={1}
          />
        )
      })}
    </svg>
  )
}
