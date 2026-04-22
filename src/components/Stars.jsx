import { Star } from 'lucide-react'

export default function Stars({ value = 0, max = 5, size = 11 }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          size={size}
          strokeWidth={2}
          fill={i < value ? '#C6651E' : 'none'}
          color={i < value ? '#C6651E' : '#E5E3DD'}
        />
      ))}
    </span>
  )
}
