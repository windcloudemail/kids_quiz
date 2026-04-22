import * as Lucide from 'lucide-react'

export default function Icon({ name, size = 18, strokeWidth = 2, className = '', ...rest }) {
  const Cmp = Lucide[name]
  if (!Cmp) return null
  return <Cmp size={size} strokeWidth={strokeWidth} className={className} {...rest} />
}
