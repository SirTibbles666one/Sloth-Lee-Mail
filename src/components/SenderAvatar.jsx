import { useState } from 'react'
import { getFaviconUrl } from '@/emailParser'

export function SenderAvatar({ from, variant = 'list', isSelected = false }) {
  const [imgError, setImgError] = useState(false)
  const initial = (from?.name?.[0] ?? from?.email?.[0] ?? '?').toUpperCase()
  const hue = (initial.charCodeAt(0) * 137) % 360
  const faviconUrl = getFaviconUrl(from?.domain)
  const isLarge = variant === 'view'
  const sizeClass = isLarge ? 'size-12 rounded-lg' : 'w-8 h-8 rounded-md'

  if (faviconUrl && !imgError) {
    return (
      <div className={`${sizeClass} overflow-hidden shrink-0 bg-white/5 flex items-center justify-center ${isLarge ? 'ring-1 ring-white/10' : ''}`}>
        <img
          src={faviconUrl}
          alt={initial}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    )
  }

  return (
    <div
      className={`${sizeClass} shrink-0 flex items-center justify-center select-none ${isLarge ? 'ring-1 ring-white/10 text-xl font-bold' : 'font-medium text-sm'}`}
      style={
        !isLarge && isSelected
          ? { background: 'rgba(255,255,255,0.2)', color: '#ffffff' }
          : { background: `hsl(${hue} 35% 20%)`, color: `hsl(${hue} 65% 75%)` }
      }
    >
      {initial}
    </div>
  )
}
