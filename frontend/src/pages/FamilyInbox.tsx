import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AppLayout from '../components/AppLayout'
import api from '../api/client'
import type { User, JoinRequest } from '../types'
import { Inbox, UserCheck, X, Check } from 'lucide-react'

export default function FamilyInbox() {
  const { user, activeMemberId, setActiveMemberId } = useAuth()
  const [members, setMembers] = useState<User[]>([])
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchData = useCallback(async () => {
    try {
      const [membersRes, inboxRes] = await Promise.all([
        api.get('/family/members'),
        api.get('/family/inbox'),
      ])
      setMembers(membersRes.data.members || [])
      setRequests(inboxRes.data.requests || [])
    } catch {} finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [user, fetchData])

  const handleRespond = async (requestId: number, action: 'accept' | 'reject') => {
    try {
      await api.post('/family/respond', { request_id: requestId, action })
      showToast(action === 'accept' ? '✓ Member added to family!' : 'Request rejected', action === 'accept' ? 'success' : 'error')
      setRequests((prev) => prev.filter((r) => r.id !== requestId))
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed', 'error')
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length

  return (
    <>
      <AppLayout
        familyMembers={members}
        activeMemberId={activeMemberId}
        onSelectMember={setActiveMemberId}
        inboxCount={pendingCount}
      >
        {loading ? (
          <div className="loading-overlay">
            <div className="loading-spinner" />
          </div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <Inbox size={48} color="var(--text-muted)" />
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, margin: 0 }}>
              Inbox is clear
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
              No pending join requests
            </p>
          </div>
        ) : (
          <div style={{ paddingBottom: 16 }}>
            {pendingCount > 0 && (
              <div className="inbox-banner">
                {pendingCount} Pending Approval{pendingCount > 1 ? 's' : ''}
              </div>
            )}

            {requests.map((req) => (
              <div key={req.id} className="inbox-card">
                <div className="inbox-card-header">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <UserCheck size={13} color="var(--accent-teal)" />
                    <strong style={{ color: 'var(--text-primary)' }}>{req.requester.name}</strong>
                    {' '}wants to join the family
                  </span>
                </div>

                {/* Requester info */}
                <div className="inbox-card-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                    {req.requester.avatar_url ? (
                      <img
                        src={req.requester.avatar_url}
                        alt={req.requester.name}
                        style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-teal), #3b82f6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.2rem', fontWeight: 700, color: 'white'
                      }}>
                        {req.requester.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="inbox-med-name">{req.requester.name}</div>
                      <div className="inbox-med-detail">{req.requester.email}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        {new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="inbox-card-actions">
                  <button
                    className="action-reject"
                    onClick={() => handleRespond(req.id, 'reject')}
                    id={`reject-req-${req.id}`}
                    aria-label={`Reject ${req.requester.name}'s request`}
                  >
                    <X size={14} style={{ display: 'inline', marginRight: 4 }} />
                    reject
                  </button>
                  <button
                    className="action-accept"
                    onClick={() => handleRespond(req.id, 'accept')}
                    id={`accept-req-${req.id}`}
                    aria-label={`Accept ${req.requester.name}'s request`}
                  >
                    <Check size={14} style={{ display: 'inline', marginRight: 4 }} />
                    accept
                  </button>
                </div>
              </div>
            ))}

            {/* Remote Caregiver Activity & Adherence Feed */}
            <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📡</span> Remote Caregiver Activity Stream
                </h4>
                <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700 }}>LIVE SYNC</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', borderLeft: '4px solid #10b981', fontSize: '0.82rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>✓ Mom took Moxifloxacin Eye Drop (Right Eye 👁️)</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>Morning Slot • Confirmed at 8:05 AM</div>
                </div>
                <div style={{ padding: '10px 14px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', borderLeft: '4px solid #3b82f6', fontSize: '0.82rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>⏱️ Staggered Buffer: Prednisolone Drop due in 10 mins</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>Automatic inter-drop timer active</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </AppLayout>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
