import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Header from '../components/Header'
import api from '../api/client'
import type { TimeSlot, User } from '../types'
import { Pencil, ImagePlus, Check, Trash2, Plus } from 'lucide-react'

const SCHEDULE_OPTIONS: { key: TimeSlot; label: string }[] = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
  { key: 'night', label: 'Night' },
]

interface EditableMedicine {
  id: string
  name: string
  dosage: string
  schedule: TimeSlot[]
  days: string
  instructions: string
  target_eye?: string
  bottle_cap_color?: string
  stagger_interval_minutes?: number
  sequence_order?: number
  packImage: string | null
  packFile: File | null
}

export default function ManualEntry() {
  const navigate = useNavigate()
  const { user, activeMemberId, setActiveMemberId } = useAuth()

  const [medicines, setMedicines] = useState<EditableMedicine[]>([
    {
      id: `manual-${Date.now()}`,
      name: '',
      dosage: '',
      schedule: [],
      days: '',
      instructions: '',
      target_eye: 'right_eye',
      bottle_cap_color: 'pink',
      stagger_interval_minutes: 10,
      sequence_order: 1,
      packImage: null,
      packFile: null,
    },
  ])

  const [loading, setLoading] = useState(false)
  const [currentUploadIdx, setCurrentUploadIdx] = useState<number | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [activePhotoIdx, setActivePhotoIdx] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [members, setMembers] = useState<User[]>([])
  const [targetMemberId, setTargetMemberId] = useState<number>(() => {
    return activeMemberId || user?.id || 0
  })

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await api.get('/family/members')
        setMembers(res.data.members || [])
      } catch {}
    }
    fetchMembers()
  }, [])

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const toggleScheduleForMed = (idx: number, slot: TimeSlot) => {
    setMedicines((prev) =>
      prev.map((med, i) => {
        if (i !== idx) return med
        const newSched = med.schedule.includes(slot)
          ? med.schedule.filter((s) => s !== slot)
          : [...med.schedule, slot]
        return { ...med, schedule: newSched }
      })
    )
  }

  const updateName = (idx: number, nameVal: string) => {
    setMedicines((prev) =>
      prev.map((med, i) => (i === idx ? { ...med, name: nameVal } : med))
    )
  }

  const updateDosage = (idx: number, dosageVal: string) => {
    setMedicines((prev) =>
      prev.map((med, i) => (i === idx ? { ...med, dosage: dosageVal } : med))
    )
  }

  const updateDays = (idx: number, val: string) => {
    setMedicines((prev) =>
      prev.map((med, i) => (i === idx ? { ...med, days: val } : med))
    )
  }

  const updateInstructions = (idx: number, val: string) => {
    setMedicines((prev) =>
      prev.map((med, i) => (i === idx ? { ...med, instructions: val } : med))
    )
  }

  const deleteMedicine = (idx: number) => {
    if (medicines.length === 1) {
      showToast('Must have at least one medicine', 'error')
      return
    }
    setMedicines((prev) => prev.filter((_, i) => i !== idx))
  }

  const addBlankMedicine = () => {
    setMedicines((prev) => [
      ...prev,
      {
        id: `manual-${prev.length}-${Date.now()}`,
        name: '',
        dosage: '',
        schedule: [],
        days: '',
        instructions: '',
        packImage: null,
        packFile: null,
      },
    ])
  }

  const triggerPhotoUpload = (idx: number) => {
    setActivePhotoIdx(idx)
    fileInputRef.current?.click()
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && activePhotoIdx !== null) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setMedicines((prev) =>
          prev.map((med, idx) =>
            idx === activePhotoIdx
              ? { ...med, packImage: ev.target?.result as string, packFile: file }
              : med
          )
        )
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }

  const applyCataractPreset = () => {
    setMedicines([
      {
        id: `cataract-1-${Date.now()}`,
        name: 'Moxifloxacin Eye Drops (0.5%)',
        dosage: '1 drop',
        schedule: ['morning', 'afternoon', 'evening', 'night'],
        days: '14',
        instructions: 'Antibiotic Drop - Right Eye',
        target_eye: 'right_eye',
        bottle_cap_color: 'pink',
        stagger_interval_minutes: 10,
        sequence_order: 1,
        packImage: null,
        packFile: null,
      },
      {
        id: `cataract-2-${Date.now()}`,
        name: 'Prednisolone Acetate Eye Drops (1%)',
        dosage: '1 drop',
        schedule: ['morning', 'afternoon', 'evening', 'night'],
        days: '28',
        instructions: 'Steroid Drop - Shake well. Wait 10 mins after Drop 1',
        target_eye: 'right_eye',
        bottle_cap_color: 'yellow',
        stagger_interval_minutes: 10,
        sequence_order: 2,
        packImage: null,
        packFile: null,
      },
      {
        id: `cataract-3-${Date.now()}`,
        name: 'Nepafenac Ophthalmic Suspension (0.1%)',
        dosage: '1 drop',
        schedule: ['morning', 'afternoon', 'night'],
        days: '28',
        instructions: 'NSAID Drop - Wait 10 mins after Drop 2',
        target_eye: 'right_eye',
        bottle_cap_color: 'blue',
        stagger_interval_minutes: 10,
        sequence_order: 3,
        packImage: null,
        packFile: null,
      },
    ])
    showToast('Applied Post-Cataract Surgery Protocol Preset! 👁️', 'success')
  }

  const handleConfirmAll = async () => {
    const invalid = medicines.some((med) => !med.name.trim())
    if (invalid) {
      showToast('All medicine cards must have a name', 'error')
      return
    }

    setLoading(true)
    try {
      for (let i = 0; i < medicines.length; i++) {
        const med = medicines[i]
        setCurrentUploadIdx(i)

        const formData = new FormData()
        formData.append('name', med.name.trim())
        if (med.dosage.trim()) formData.append('dosage', med.dosage.trim())
        formData.append('schedule', JSON.stringify(med.schedule))
        formData.append('target_user_id', String(targetMemberId))
        if (med.days.trim()) formData.append('days', med.days.trim())
        if (med.instructions.trim()) formData.append('instructions', med.instructions.trim())
        if (med.target_eye) formData.append('target_eye', med.target_eye)
        if (med.bottle_cap_color) formData.append('bottle_cap_color', med.bottle_cap_color)
        formData.append('stagger_interval_minutes', String(med.stagger_interval_minutes || 10))
        formData.append('sequence_order', String(med.sequence_order || i + 1))

        if (med.packFile) {
          formData.append('pack_image', med.packFile)
        }

        await api.post('/medicine/add', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }

      showToast(`Added ${medicines.length} medicines successfully!`, 'success')
      setTimeout(() => navigate('/cabinet', { replace: true }), 1200)
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save some medicines', 'error')
      setLoading(false)
      setCurrentUploadIdx(null)
    }
  }

  const handleSelectMember = (id: number) => {
    setTargetMemberId(id)
    setActiveMemberId(id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <Header />

      {/* Target Family Member Selector */}
      {members.length > 1 && (
        <div style={{ padding: '8px 16px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>
            Add these to the cabinet of:
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                className={`family-pill ${targetMemberId === member.id ? 'active' : ''}`}
                onClick={() => handleSelectMember(member.id)}
              >
                {member.avatar_url ? (
                  <img src={member.avatar_url} alt={member.name} className="pill-avatar" width={28} height={28} loading="lazy" decoding="async" />
                ) : (
                  <div className="pill-avatar-placeholder">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span>{member.id === user?.id ? 'Me' : member.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="page-content" style={{ paddingBottom: 80 }}>
        <div className="extracted-section" style={{ padding: '16px 16px 8px' }}>
          <div className="extracted-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span className="extracted-label">
              <Pencil size={12} style={{ display: 'inline', marginRight: 4 }} />
              Manual Entry
            </span>
            <button
              type="button"
              onClick={applyCataractPreset}
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
              }}
            >
              👁️ Load Post-Cataract Protocol Preset
            </button>
          </div>

          <div className="medicines-approval-list">
            {medicines.map((med, idx) => (
              <div className="med-approval-card" key={med.id}>
                <div className="med-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="med-card-index">Medicine #{idx + 1}</span>
                  </div>
                  <button
                    className="delete-card-btn"
                    onClick={() => deleteMedicine(idx)}
                    aria-label={`Delete medicine #${idx + 1}`}
                    type="button"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="med-card-body">
                  <div className="approval-fields-grid">
                    <div className="field-row" style={{ flex: 1 }}>
                      <div className="field-label">Name</div>
                      <div className="field-wrapper">
                        <input
                          className="field-input"
                          value={med.name}
                          onChange={(e) => updateName(idx, e.target.value)}
                          placeholder="Medicine name"
                          aria-label={`Medicine #${idx + 1} Name`}
                        />
                        <Pencil size={12} className="field-edit-icon" />
                      </div>
                    </div>

                    <div className="field-row" style={{ width: '100px' }}>
                      <div className="field-label">Dosage</div>
                      <div className="field-wrapper">
                        <input
                          className="field-input"
                          value={med.dosage}
                          onChange={(e) => updateDosage(idx, e.target.value)}
                          placeholder="e.g. 500mg"
                          aria-label={`Medicine #${idx + 1} Dosage`}
                        />
                        <Pencil size={12} className="field-edit-icon" />
                      </div>
                    </div>
                  </div>

                  <div className="field-row" style={{ marginTop: 8 }}>
                    <div className="field-label">Schedule</div>
                    <div className="schedule-chips">
                      {SCHEDULE_OPTIONS.map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          className={`schedule-chip ${key} ${med.schedule.includes(key) ? 'selected' : ''}`}
                          onClick={() => toggleScheduleForMed(idx, key)}
                          aria-pressed={med.schedule.includes(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="approval-fields-grid" style={{ marginTop: 8 }}>
                    <div className="field-row" style={{ width: '80px' }}>
                      <div className="field-label">Days</div>
                      <div className="field-wrapper">
                        <input
                          className="field-input"
                          type="number"
                          min="1"
                          max="365"
                          value={med.days}
                          onChange={(e) => updateDays(idx, e.target.value)}
                          placeholder="e.g. 5"
                          aria-label={`Medicine #${idx + 1} Days`}
                        />
                        <Pencil size={12} className="field-edit-icon" />
                      </div>
                    </div>

                    <div className="field-row" style={{ flex: 1 }}>
                      <div className="field-label">Instructions</div>
                      <div className="field-wrapper">
                        <input
                          className="field-input"
                          value={med.instructions}
                          onChange={(e) => updateInstructions(idx, e.target.value)}
                          placeholder="e.g. After Food"
                          aria-label={`Medicine #${idx + 1} Instructions`}
                        />
                        <Pencil size={12} className="field-edit-icon" />
                      </div>
                    </div>
                  </div>

                  <div className="med-attachment-row" style={{ marginTop: 12 }}>
                    <div className="attachment-preview-box">
                      {med.packImage ? (
                        <img src={med.packImage} alt="Pack preview" className="mini-preview-img" />
                      ) : (
                        <div className="placeholder-box">
                          <ImagePlus size={16} />
                        </div>
                      )}
                    </div>
                    <div className="attachment-details">
                      <span className="attachment-title">Individual Photo</span>
                      <span className="attachment-desc">
                        {med.packImage ? 'Custom photo attached' : 'Optional reference photo'}
                      </span>
                    </div>
                    <button
                      className="attach-photo-row-btn"
                      onClick={() => triggerPhotoUpload(idx)}
                      type="button"
                    >
                      {med.packImage ? 'Change' : 'Add Photo'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button className="add-manual-card-btn" onClick={addBlankMedicine} type="button">
            <Plus size={16} />
            Add Another Medicine
          </button>
        </div>

        <div style={{ padding: '12px 16px 8px' }}>
          <button
            className="btn-primary"
            onClick={handleConfirmAll}
            disabled={loading || medicines.length === 0}
            id="confirm-add-btn"
            type="button"
          >
            {loading ? (
              <span className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
            ) : (
              <>
                <Check size={18} />
                Save to Cabinet
              </>
            )}
          </button>
        </div>

        <div style={{ padding: '0 16px 16px' }}>
          <button
            className="btn-ghost"
            onClick={() => navigate('/cabinet', { replace: true })}
            id="cancel-btn"
            style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handlePhotoSelect}
        id="pack-image-input-hidden"
      />

      {loading && (
        <div
          className="loading-overlay"
          style={{
            position: 'fixed',
            zIndex: 300,
            background: 'rgba(15, 22, 41, 0.85)',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div className="loading-spinner" />
          <span style={{ fontWeight: 600, color: 'white', marginTop: 16 }}>
            {currentUploadIdx !== null
              ? `Saving medicine ${currentUploadIdx + 1} of ${medicines.length}…`
              : 'Saving medicines…'}
          </span>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
