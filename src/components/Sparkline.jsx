export default function Sparkline({
  data = [],
  width = 120,
  height = 40,
  color = '#1A1A1A',
  fill = true,
  dot = true,
}) {
  if (!data.length) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = data.length > 1 ? width / (data.length - 1) : 0
  const pts = data.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * (height - 4) - 2
    return [x, y]
  })
  const path = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ')
  const area = `${path} L${pts[pts.length - 1][0]},${height} L0,${height} Z`
  const last = pts[pts.length - 1]
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {fill && <path d={area} fill={color} opacity={0.12} />}
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {dot && <circle cx={last[0]} cy={last[1]} r={3} fill={color} />}
    </svg>
  )
}
