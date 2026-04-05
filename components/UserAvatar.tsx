'use client'

import { useState, useEffect } from 'react'

interface UserAvatarProps {
  user: {
    id?: string
    user_metadata?: { avatar_url?: string; full_name?: string }
    email?: string
  } | null
  size?: 'sm' | 'md' | 'lg'
}

const SIZE = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-14 h-14 text-lg',
}

export default function UserAvatar({ user, size = 'md' }: UserAvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    fetch('/api/avatar')
      .then((r) => r.json())
      .then((d) => { if (d.url) setAvatarUrl(d.url) })
      .catch(() => {})
  }, [user?.id])

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?'

  const cls = `${SIZE[size]} rounded-full flex-shrink-0 object-cover`

  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt={user?.user_metadata?.full_name ?? 'Avatar'}
        className={cls}
        onError={() => setFailed(true)}
      />
    )
  }

  // Fallback: initials or user icon
  return (
    <div className={`${SIZE[size]} rounded-full bg-[var(--primary)] flex items-center justify-center flex-shrink-0`}>
      {initials !== '?' ? (
        <span className="font-semibold text-white leading-none" style={{ fontSize: size === 'lg' ? '1.1rem' : size === 'md' ? '0.75rem' : '0.65rem' }}>
          {initials}
        </span>
      ) : (
        <svg className={size === 'lg' ? 'w-7 h-7' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4'} fill="none" stroke="white" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )}
    </div>
  )
}
