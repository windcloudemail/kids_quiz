import { SUBJECTS } from '../lib/subjects.js'
import Icon from './Icon.jsx'

export default function SubjectTag({ subject, size = 'md' }) {
  const s = SUBJECTS[subject]
  if (!s) return null
  const pad = size === 'sm' ? '2px 8px' : '4px 10px'
  const font = size === 'sm' ? 11 : 13
  const iconSize = size === 'sm' ? 12 : 14
  return (
    <span
      className="inline-flex items-center gap-1 rounded-chip font-medium"
      style={{
        background: s.soft,
        color: s.color,
        padding: pad,
        fontSize: font,
      }}
    >
      <Icon name={s.icon} size={iconSize} strokeWidth={2.25} />
      {s.name}
    </span>
  )
}
