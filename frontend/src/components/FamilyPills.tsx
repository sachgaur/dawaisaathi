import React from 'react'
import type { User } from '../types'

interface FamilyPillsProps {
  members: User[]
  activeMemberId: number
  onSelect: (id: number) => void
  currentUserId: number
}

export default function FamilyPills({ members, activeMemberId, onSelect, currentUserId }: FamilyPillsProps) {
  if (members.length === 0) return null

  return (
    <div className="family-pills-bar" role="tablist" aria-label="Family members">
      {members.map((m) => (
        <button
          key={m.id}
          role="tab"
          type="button"
          aria-selected={m.id === activeMemberId}
          className={`family-pill ${m.id === activeMemberId ? 'active' : ''}`}
          onClick={() => onSelect(m.id)}
          id={`pill-${m.id}`}
        >
          {m.avatar_url ? (
            <img src={m.avatar_url} alt={m.name} className="pill-avatar" referrerPolicy="no-referrer" />
          ) : (
            <div className="pill-avatar-placeholder">
              {m.name.charAt(0).toUpperCase()}
            </div>
          )}
          {m.id === currentUserId ? 'You' : m.name.split(' ')[0]}
        </button>
      ))}
    </div>
  )
}
