export default function RubyText({ chars = [], size = 22 }) {
  return (
    <p
      style={{
        fontSize: size,
        fontWeight: 500,
        lineHeight: 2,
        margin: 0,
      }}
    >
      {chars.map((ch, i) => (
        <ruby key={i} style={{ rubyAlign: 'center' }}>
          {ch.c}
          <rt
            style={{
              fontSize: '0.55em',
              fontWeight: 400,
              color: 'var(--ink-sub)',
              letterSpacing: 0,
            }}
          >
            {ch.zy || '\u00A0'}
          </rt>
        </ruby>
      ))}
    </p>
  )
}
