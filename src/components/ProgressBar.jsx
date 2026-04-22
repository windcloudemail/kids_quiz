export default function ProgressBar({
  value = 0,
  max = 100,
  height = 10,
  color = '#1A1A1A',
  track = '#EFEDE7',
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div
      style={{
        height,
        background: track,
        borderRadius: height / 2,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: height / 2,
          transition: 'width 0.5s ease',
        }}
      />
    </div>
  )
}
