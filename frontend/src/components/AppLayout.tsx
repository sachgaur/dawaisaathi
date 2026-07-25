import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Users, ScanLine, Archive, Plus, Pencil } from 'lucide-react'
import Header from './Header'
import FamilyPills from './FamilyPills'
import type { User } from '../types'

interface LayoutProps {
  children: React.ReactNode
  familyMembers: User[]
  activeMemberId: number
  onSelectMember: (id: number) => void
  inboxCount?: number
}

type NavTab = 'family' | 'cabinet' | 'scan'

export default function AppLayout({
  children,
  familyMembers,
  activeMemberId,
  onSelectMember,
  inboxCount = 0,
}: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [showAddMenu, setShowAddMenu] = useState(false)

  const currentTab: NavTab =
    location.pathname.startsWith('/cabinet') ? 'cabinet'
    : location.pathname.startsWith('/scan') ? 'scan'
    : 'family'

  return (
    <>
      <Header inboxCount={inboxCount} />
      <FamilyPills
        members={familyMembers}
        activeMemberId={activeMemberId}
        onSelect={onSelectMember}
        currentUserId={user?.id ?? 0}
      />

      {/* Page content */}
      <div className="page-content">
        {children}
      </div>

      {/* Bottom Navigation */}
      <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
        {/* Family Tab */}
        <button
          id="nav-family"
          className={`nav-item ${currentTab === 'family' ? 'active' : ''}`}
          onClick={() => navigate('/home')}
          aria-label="Family Settings"
        >
          <Users size={20} />
          <span>Family</span>
        </button>

        {/* Center Add Button */}
        <button
          id="nav-scan"
          className="scan-nav-btn"
          onClick={() => setShowAddMenu(true)}
          aria-label="Add medicine options"
          type="button"
        >
          <Plus size={28} color="white" strokeWidth={2.5} />
        </button>

        {/* Cabinet Tab */}
        <button
          id="nav-cabinet"
          className={`nav-item ${currentTab === 'cabinet' ? 'active' : ''}`}
          onClick={() => navigate('/cabinet')}
          aria-label="Cabinet"
        >
          <Archive size={20} />
          <span>Cabinet</span>
        </button>
      </nav>

      {/* Bottom Action Drawer Sheet */}
      {showAddMenu && (
        <div className="bottom-sheet-overlay" onClick={() => setShowAddMenu(false)}>
          <div className="bottom-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-drag-handle" />
            <h3 className="bottom-sheet-title">Add Medicine</h3>
            <div className="bottom-sheet-options">
              <button
                className="bottom-sheet-option"
                onClick={() => {
                  setShowAddMenu(false)
                  navigate('/scan')
                }}
                type="button"
              >
                <div className="option-icon scan">
                  <ScanLine size={22} color="var(--accent-teal)" />
                </div>
                <div className="option-text">
                  <span className="option-title">Scan Prescription</span>
                  <span className="option-desc">Extract medicine details automatically with Gemini AI</span>
                </div>
              </button>

              <button
                className="bottom-sheet-option"
                onClick={() => {
                  setShowAddMenu(false)
                  navigate('/manual-entry')
                }}
                type="button"
              >
                <div className="option-icon manual">
                  <Pencil size={22} color="var(--accent-cyan)" />
                </div>
                <div className="option-text">
                  <span className="option-title">Type Manually</span>
                  <span className="option-desc">Manually enter names, schedules, and dosages</span>
                </div>
              </button>
            </div>
            
            <button className="bottom-sheet-cancel" onClick={() => setShowAddMenu(false)} type="button">
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}
