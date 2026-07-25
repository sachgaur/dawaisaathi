import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Pill, Inbox, Bell, LogOut } from 'lucide-react'

interface HeaderProps {
  inboxCount?: number
}

export default function Header({ inboxCount = 0 }: HeaderProps) {
  const navigate = useNavigate()
  const { logout } = useAuth()

  return (
    <header className="app-header" role="banner">
      {/* Brand - Clickable to navigate back to Cabinet */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        onClick={() => navigate('/cabinet')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/cabinet')}
        aria-label="DawaiSathi brand logo, click to view cabinet"
      >
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: 'linear-gradient(135deg, var(--accent-teal), #3b82f6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Pill size={16} color="white" />
        </div>
        <span className="brand-text">DawaiSathi</span>
      </div>

      {/* Actions */}
      <div className="header-actions">
        {/* Inbox */}
        <button
          className="icon-btn"
          onClick={() => navigate('/inbox')}
          aria-label={`Inbox${inboxCount > 0 ? ` (${inboxCount} pending)` : ''}`}
          id="header-inbox-btn"
          type="button"
        >
          <Inbox size={18} />
          {inboxCount > 0 && <span className="badge" />}
        </button>

        {/* Notifications */}
        <button
          className="icon-btn"
          onClick={() => navigate('/notifications')}
          aria-label="Notification settings"
          id="header-notifications-btn"
          title="Notification settings"
          type="button"
        >
          <Bell size={18} />
        </button>

        {/* Logout */}
        <button
          className="icon-btn"
          onClick={logout}
          aria-label="Logout"
          id="header-logout-btn"
          title="Logout"
          type="button"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
