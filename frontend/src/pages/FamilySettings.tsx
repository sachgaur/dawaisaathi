import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import AppLayout from '../components/AppLayout'
import api from '../api/client'
import type { User } from '../types'
import { Users, UserPlus, Mail } from 'lucide-react'

export default function FamilySettings() {
  const { user, refreshUser, activeMemberId, setActiveMemberId } = useAuth()
  const [members, setMembers] = useState<User[]>([])
  const [inboxCount, setInboxCount] = useState(0)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [joinEmail, setJoinEmail] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'waiting' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [hasPendingRequest, setHasPendingRequest] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchFamily = useCallback(async () => {
    try {
      const res = await api.get('/family/members')
      setMembers(res.data.members || [])
    } catch {}
  }, [])

  const fetchInbox = useCallback(async () => {
    try {
      const res = await api.get('/family/inbox')
      setInboxCount(res.data.requests?.length ?? 0)
    } catch {}
  }, [])

  useEffect(() => {
    fetchFamily()
    fetchInbox()
  }, [user])

  const handleJoinFamily = async () => {
    if (!joinEmail.trim()) return
    setStatus('loading')
    setErrorMsg('')
    try {
      await api.post('/family/join-request', { email: joinEmail.trim() })
      setHasPendingRequest(true)
      setStatus('waiting')
      setShowJoinModal(false)
      showToast('Join request sent!', 'success')
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Something went wrong')
      setStatus('error')
    }
  }

  const handleCreateFamily = async () => {
    if (!familyName.trim()) return
    setStatus('loading')
    try {
      await api.post('/family/create', { name: familyName.trim() })
      await refreshUser()
      await fetchFamily()
      setShowCreateModal(false)
      showToast('Family created!', 'success')
      setStatus('idle')
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Something went wrong')
      setStatus('error')
    }
  }

  const handleSelectMember = (id: number) => {
    setActiveMemberId(id)
  }

  const inFamily = !!user?.family_id
  const myMembers = inFamily ? members : []

  return (
    <>
      <AppLayout
        familyMembers={[]}
        activeMemberId={activeMemberId}
        onSelectMember={handleSelectMember}
        inboxCount={inboxCount}
      >
        {!inFamily ? (
          /* NO FAMILY STATE */
          <div className="page-content" style={{ display: 'flex', flexDirection: 'column' }}>
            {hasPendingRequest ? (
              <div className="waiting-card">
                <div style={{ marginBottom: 16 }}>
                  <span className="pulse-dot" />
                </div>
                <h3 style={{ color: 'var(--accent-teal)', fontWeight: 700, marginBottom: 8 }}>
                  Request Sent!
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>
                  Waiting for a family member to accept your request. You'll be added automatically once someone approves.
                </p>
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Mail size={16} color="var(--text-muted)" />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    Check the inbox to see the status
                  </span>
                </div>
              </div>
            ) : (
              <div className="family-empty-state">
                <div className="family-empty-icon">
                  <Users size={32} color="var(--text-muted)" />
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                  You're not in a family yet
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: 28 }}>
                  Join an existing family or create a new one to start tracking medicines together.
                </p>

                <button
                  className="btn-primary"
                  style={{ maxWidth: 280 }}
                  onClick={() => setShowJoinModal(true)}
                  id="join-family-btn"
                  type="button"
                >
                  <UserPlus size={18} />
                  Join a Family
                </button>

                <button
                  className="btn-ghost"
                  style={{ marginTop: 8, maxWidth: 280 }}
                  onClick={() => setShowCreateModal(true)}
                  id="create-family-btn"
                  type="button"
                >
                  + Create a new family
                </button>
              </div>
            )}
          </div>
        ) : (
          /* IN FAMILY — show members */
          <div className="page-content">
            <div style={{ padding: '16px 16px 8px' }}>
              <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Family Members
              </h2>
            </div>
            {members.map((member) => (
              <div key={member.id} className="family-member-card">
                {member.avatar_url ? (
                  <img
                    src={member.avatar_url}
                    alt={member.name}
                    className="member-avatar"
                    referrerPolicy="no-referrer"
                    width={48}
                    height={48}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="member-avatar-placeholder">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div className="member-name">
                    {member.name}
                    {member.id === user?.id && (
                      <span style={{
                        marginLeft: 8, fontSize: '0.7rem', color: 'var(--accent-teal)',
                        background: 'var(--accent-teal-glow)', padding: '2px 8px', borderRadius: 100
                      }}>
                        You
                      </span>
                    )}
                  </div>
                  <div className="member-email">{member.email}</div>
                </div>
              </div>
            ))}

            <div style={{ padding: '8px 16px 24px' }}>
              <button
                className="btn-ghost"
                style={{ color: 'var(--danger-color)', fontSize: '0.8rem' }}
                onClick={async () => {
                  try {
                    await api.post('/family/leave')
                    await refreshUser()
                    setMembers([])
                  } catch {}
                }}
                id="leave-family-btn"
                type="button"
              >
                Leave Family
              </button>
            </div>
          </div>
        )}
      </AppLayout>

      {/* JOIN MODAL */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <h2 className="modal-title">Join a Family</h2>
            <p className="modal-subtitle">
              Enter the email address of any existing family member. They'll receive a request to approve you.
            </p>
            <input
              id="join-email-input"
              type="email"
              className="text-input"
              placeholder="family.member@example.com"
              value={joinEmail}
              onChange={(e) => setJoinEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinFamily()}
              autoFocus
            />
            {status === 'error' && (
              <p style={{ color: 'var(--danger-color)', fontSize: '0.8rem', marginBottom: 12, marginTop: -8 }}>
                {errorMsg}
              </p>
            )}
            <button
              className="btn-primary"
              onClick={handleJoinFamily}
              disabled={status === 'loading' || !joinEmail.trim()}
              id="send-join-request-btn"
              type="button"
            >
              {status === 'loading' ? <span className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Send Join Request'}
            </button>
            <button className="btn-ghost" onClick={() => setShowJoinModal(false)} type="button">Cancel</button>
          </div>
        </div>
      )}

      {/* CREATE FAMILY MODAL */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <h2 className="modal-title">Create a Family</h2>
            <p className="modal-subtitle">
              Give your family group a name. Others can join using your email address.
            </p>
            <input
              id="family-name-input"
              type="text"
              className="text-input"
              placeholder="e.g. The Sharma Family"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFamily()}
              autoFocus
            />
            {status === 'error' && (
              <p style={{ color: 'var(--danger-color)', fontSize: '0.8rem', marginBottom: 12, marginTop: -8 }}>
                {errorMsg}
              </p>
            )}
            <button
              className="btn-primary"
              onClick={handleCreateFamily}
              disabled={status === 'loading' || !familyName.trim()}
              id="create-family-submit-btn"
              type="button"
            >
              {status === 'loading' ? <span className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Create Family'}
            </button>
            <button className="btn-ghost" onClick={() => setShowCreateModal(false)} type="button">Cancel</button>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className={`toast ${toast.type}`}>{toast.msg}</div>
      )}
    </>
  )
}
