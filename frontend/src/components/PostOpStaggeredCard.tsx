import React from 'react'
import type { MedicineEntry, TimeSlot } from '../types'

interface Props {
  medicines: MedicineEntry[]
  selectedSlot: TimeSlot
  onLogDose: (entry_id: number, slot: TimeSlot) => void
  onEdit?: (med: MedicineEntry) => void
  loggingId?: number | null
  customTimes?: Record<string, string>
}

const CAP_COLORS: Record<string, { label: string; bg: string; text: string; border: string; icon: string }> = {
  pink: { label: 'Pink Cap Bottle', bg: '#fce7f3', text: '#9d174d', border: '#f472b6', icon: '💗' },
  yellow: { label: 'Yellow Cap Bottle', bg: '#fef9c3', text: '#854d0e', border: '#facc15', icon: '💛' },
  blue: { label: 'Blue Cap Bottle', bg: '#dbeafe', text: '#1e40af', border: '#60a5fa', icon: '💙' },
  green: { label: 'Green Cap Bottle', bg: '#dcfce7', text: '#166534', border: '#4ade80', icon: '💚' },
  white: { label: 'White Cap Bottle', bg: '#f3f4f6', text: '#1f2937', border: '#d1d5db', icon: '🤍' },
  orange: { label: 'Orange Cap Bottle', bg: '#ffedd5', text: '#9a3412', border: '#fb923c', icon: '🧡' },
  violet: { label: 'Violet Cap Bottle', bg: '#f3e8ff', text: '#6b21a8', border: '#c084fc', icon: '💜' },
}

export const PostOpStaggeredCard: React.FC<Props> = ({
  medicines,
  selectedSlot,
  onLogDose,
  onEdit,
  loggingId,
  customTimes,
}) => {
  // Filter medicines scheduled for this slot
  const slotMeds = medicines
    .filter((m) => m.schedule?.includes(selectedSlot))
    .sort((a, b) => (a.sequence_order || 1) - (b.sequence_order || 1))

  if (slotMeds.length === 0) return null

  // Check if all are eye drops or post-op protocol
  const isEyeDropRegimen = slotMeds.some(
    (m) => m.target_eye || m.bottle_cap_color || m.name.toLowerCase().includes('drop')
  )

  if (!isEyeDropRegimen) return null

  // Check lock window (doses open 30 mins before scheduled time)
  const customTime = customTimes?.[selectedSlot]
  let hour = 8
  let minute = 0
  if (customTime) {
    try {
      const [hStr, mStr] = customTime.split(':')
      hour = parseInt(hStr, 10)
      minute = parseInt(mStr, 10)
    } catch {}
  } else {
    const defaults: Record<TimeSlot, number> = { morning: 8, afternoon: 13, evening: 18, night: 22 }
    hour = defaults[selectedSlot] || 8
  }
  const now = new Date()
  const scheduled = new Date()
  scheduled.setHours(hour, minute, 0, 0)
  const allowedStart = new Date(scheduled.getTime() - 30 * 60 * 1000)
  const isLocked = now < allowedStart

  const h = allowedStart.getHours()
  const m = allowedStart.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayHour = h % 12 || 12
  const displayMin = m < 10 ? `0${m}` : m
  const opensAt = `${displayHour}:${displayMin} ${ampm}`

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e1e38 0%, #0f172a 100%)',
      borderRadius: '24px',
      padding: '24px',
      marginBottom: '28px',
      boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5)',
      border: '2px solid rgba(99, 102, 241, 0.4)',
      color: '#ffffff',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            fontSize: '28px',
            background: 'rgba(99, 102, 241, 0.2)',
            padding: '10px 14px',
            borderRadius: '16px',
            border: '1px solid rgba(99, 102, 241, 0.4)',
          }}>
            👁️
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.3px', color: '#f8fafc' }}>
              Staggered Eye Drop Protocol
            </h3>
            <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>
              Wait {slotMeds[0]?.stagger_interval_minutes || 10} minutes between each eye drop
            </span>
          </div>
        </div>
        <span style={{
          background: 'rgba(16, 185, 129, 0.2)',
          color: '#34d399',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          padding: '6px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <span>●</span> Remote Caregiver Sync Active
        </span>
      </div>

      {/* Staggered Steps Sequence */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {slotMeds.map((med, idx) => {
          const isTaken = med.today_logs?.includes(selectedSlot)
          const capInfo = med.bottle_cap_color ? CAP_COLORS[med.bottle_cap_color.toLowerCase()] : null
          const imgUrl = med.pack_image_url || med.scan_image_url

          let eyeLabel = 'General Eye Drop'
          if (med.target_eye === 'right_eye') eyeLabel = '👁️ RIGHT EYE (OD)'
          else if (med.target_eye === 'left_eye') eyeLabel = '👁️ LEFT EYE (OS)'
          else if (med.target_eye === 'both_eyes') eyeLabel = '👁️ BOTH EYES (OU)'

          return (
            <div
              key={med.id}
              style={{
                background: isTaken ? 'rgba(30, 41, 59, 0.6)' : 'rgba(30, 41, 59, 0.9)',
                borderRadius: '18px',
                padding: '20px',
                border: isTaken
                  ? '1px solid rgba(52, 211, 153, 0.3)'
                  : '2px solid rgba(99, 102, 241, 0.5)',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                opacity: isTaken ? 0.75 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              {/* Left Side: Photo + Details */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                {/* Step badge */}
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: isTaken ? '#10b981' : '#6366f1',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '16px',
                  flexShrink: 0,
                  boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                }}>
                  {isTaken ? '✓' : idx + 1}
                </div>

                {/* Medicine Photo if available */}
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt={med.name}
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '14px',
                      objectFit: 'cover',
                      border: '2px solid #475569',
                      flexShrink: 0,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    }}
                  />
                ) : (
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '14px',
                    background: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    flexShrink: 0,
                  }}>
                    💧
                  </div>
                )}

                {/* Med Details */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{
                      background: 'rgba(99, 102, 241, 0.25)',
                      color: '#a5b4fc',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}>
                      {eyeLabel}
                    </span>
                    {capInfo && (
                      <span style={{
                        background: capInfo.bg,
                        color: capInfo.text,
                        border: `1px solid ${capInfo.border}`,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                      }}>
                        {capInfo.icon} {capInfo.label}
                      </span>
                    )}
                  </div>

                  <h4 style={{ margin: '0 0 2px 0', fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                    {med.name}
                  </h4>

                  <div style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 500 }}>
                    {med.dosage ? `Dose: ${med.dosage}` : '1 drop'} {med.instructions ? `• ${med.instructions}` : ''}
                  </div>

                  {!isTaken && idx < slotMeds.length - 1 && (
                    <div style={{ fontSize: '12px', color: '#fbbf24', marginTop: '4px', fontWeight: 600 }}>
                      ⏱️ Wait {med.stagger_interval_minutes || 10} mins after this before Step {idx + 2}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side: Log Action Button + Edit Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {onEdit && (
                  <button
                    onClick={() => onEdit(med)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '14px',
                      padding: '12px 14px',
                      color: '#cbd5e1',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title="Edit eye drop protocol details"
                    type="button"
                  >
                    ✏️ Edit
                  </button>
                )}

                <button
                  onClick={() => onLogDose(med.id, selectedSlot)}
                  disabled={isTaken || isLocked || loggingId === med.id}
                  style={{
                    background: isTaken
                      ? 'rgba(16, 185, 129, 0.2)'
                      : isLocked
                      ? 'rgba(100, 116, 139, 0.4)'
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: isTaken ? '#34d399' : isLocked ? '#94a3b8' : '#ffffff',
                    border: isTaken ? '1px solid rgba(16, 185, 129, 0.4)' : isLocked ? '1px solid rgba(148, 163, 184, 0.3)' : 'none',
                    padding: '14px 22px',
                    borderRadius: '16px',
                    fontSize: '15px',
                    fontWeight: 800,
                    cursor: isTaken || isLocked ? 'default' : 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: isTaken || isLocked ? 'none' : '0 8px 20px -6px rgba(16, 185, 129, 0.6)',
                    transition: 'transform 0.15s ease, background 0.2s ease',
                  }}
                >
                  {isTaken
                    ? '✓ Taken'
                    : isLocked
                    ? `Opens ${opensAt}`
                    : loggingId === med.id
                    ? 'Logging...'
                    : 'Mark Taken'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
