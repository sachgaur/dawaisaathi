import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Bell, BellOff, MessageCircle, Clock,
  Check, X, RefreshCw, Send, Unlink, Link, Loader2,
  Smartphone
} from 'lucide-react'
import api from '../api/client'
import Header from '../components/Header'

// ── Types ─────────────────────────────────────────────────────────────────────
type TimeSlotKey = 'morning' | 'afternoon' | 'evening' | 'night'

interface PushDevice {
  endpoint: string
  current_device: boolean
}

interface NotifSettings {
  telegram_linked: boolean
  push_enabled: boolean
  push_enabled_current_device: boolean
  push_device_count: number
  push_devices: PushDevice[]
  slots: TimeSlotKey[]
  times: Record<TimeSlotKey, string>
}

const ALL_SLOTS: { key: TimeSlotKey; label: string; emoji: string }[] = [
  { key: 'morning',   label: 'Morning',   emoji: '🌅' },
  { key: 'afternoon', label: 'Afternoon', emoji: '☀️' },
  { key: 'evening',   label: 'Evening',   emoji: '🌆' },
  { key: 'night',     label: 'Night',     emoji: '🌙' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
async function urlBase64ToUint8Array(base64String: string): Promise<Uint8Array> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function NotificationSettings() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<NotifSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [pushLoading, setPushLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Current device's push endpoint
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null)
  const [subReady, setSubReady] = useState(false)

  // Telegram linking state
  const [tgModal, setTgModal] = useState(false)
  const [tgCode, setTgCode] = useState('')
  const [tgBotUsername, setTgBotUsername] = useState('DawaiSathiBot')
  const [tgPolling, setTgPolling] = useState(false)
  const [tgCopied, setTgCopied] = useState(false)
  const [tgLinked, setTgLinked] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollCountRef = useRef(0)

  // Times being edited locally before save
  const [editTimes, setEditTimes] = useState<Record<TimeSlotKey, string>>({
    morning: '08:00', afternoon: '13:00', evening: '18:00', night: '22:00',
  })
  const [timeDirty, setTimeDirty] = useState(false)
  const [timeSaving, setTimeSaving] = useState(false)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Load settings ───────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true
    const initSW = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const sw = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<null>((r) => setTimeout(() => r(null), 500)),
          ])
          if (sw && active) {
            const sub = await sw.pushManager.getSubscription()
            if (active) setCurrentEndpoint(sub ? sub.endpoint : null)
          }
        } catch {}
      }
      if (active) setSubReady(true)
    }
    initSW()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!subReady) return
    const url = currentEndpoint
      ? `/notifications/settings?endpoint=${encodeURIComponent(currentEndpoint)}`
      : '/notifications/settings'
    api.get(url)
      .then((r) => {
        setSettings(r.data)
        setEditTimes({ ...{ morning: '08:00', afternoon: '13:00', evening: '18:00', night: '22:00' }, ...r.data.times })
      })
      .catch(() => showToast('Could not load notification settings', 'error'))
      .finally(() => setLoading(false))
  }, [subReady, currentEndpoint])

  // ── Toggle a slot on/off ────────────────────────────────────────────────────
  const toggleSlot = async (key: TimeSlotKey) => {
    if (!settings) return
    const current = settings.slots
    const next = current.includes(key)
      ? current.filter((s) => s !== key)
      : [...current, key]
    try {
      await api.post('/notifications/settings', { slots: next })
      setSettings({ ...settings, slots: next })
    } catch {
      showToast('Could not save slot preference', 'error')
    }
  }

  // ── Save custom times ───────────────────────────────────────────────────────
  const saveTimes = async () => {
    setTimeSaving(true)
    try {
      await api.post('/notifications/settings', { times: editTimes })
      setSettings((s) => s ? { ...s, times: editTimes } : s)
      setTimeDirty(false)
      showToast('Reminder times saved ✓')
    } catch {
      showToast('Could not save times', 'error')
    } finally {
      setTimeSaving(false)
    }
  }

  // ── Web Push ────────────────────────────────────────────────────────────────
  const enablePush = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      showToast('Push notifications are not supported in this browser', 'error')
      return
    }
    setPushLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        showToast('Permission denied — please allow notifications in browser settings', 'error')
        return
      }

      // Fetch VAPID public key
      const keyRes = await api.get('/notifications/push/vapid-key')
      if (keyRes.data.error) {
        showToast(keyRes.data.error, 'error')
        return
      }
      const vapidKey: string = keyRes.data.public_key
      if (!vapidKey) {
        showToast('Push is not configured yet (missing VAPID key)', 'error')
        return
      }

      const sw = await navigator.serviceWorker.ready
      let sub: PushSubscription
      try {
        sub = await sw.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: (await urlBase64ToUint8Array(vapidKey)) as BufferSource,
        })
      } catch {
        // Detect Brave — it blocks pushManager.subscribe() when Shields are up
        const isBrave = 'brave' in navigator && typeof (navigator as any).brave?.isBrave === 'function'
          ? await (navigator as any).brave.isBrave()
          : false
        if (isBrave) {
          showToast(
            'Brave Shields is blocking push notifications. Click the lion icon in the URL bar → set "Shields" to "Down" for this site, then try again.',
            'error',
          )
          return
        }
        showToast(
          'Your browser blocked the push subscription. Check notifications permissions in site settings.',
          'error',
        )
        return
      }

      await api.post('/notifications/push/subscribe', { subscription: sub.toJSON() })
      setCurrentEndpoint(sub.endpoint)
      const r = await api.get(`/notifications/settings?endpoint=${encodeURIComponent(sub.endpoint)}`)
      setSettings(r.data)
      showToast('Notifications enabled on this device ✓')
      registerPeriodicSync()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      showToast(msg || (err instanceof Error ? err.message : 'Failed to enable push notifications'), 'error')
    } finally {
      setPushLoading(false)
    }
  }

  const disablePush = async () => {
    setPushLoading(true)
    try {
      const sw = await navigator.serviceWorker.ready
      const sub = await sw.pushManager.getSubscription()
      if (sub) {
        await api.post('/notifications/push/unsubscribe', { endpoint: sub.endpoint })
        await sub.unsubscribe()
        setCurrentEndpoint(null)
      }
      const reg = await navigator.serviceWorker.ready
      if ('periodicSync' in reg) {
        try {
          await (reg as any).periodicSync.unregister('medicine-check')
        } catch {}
      }
      const r = await api.get('/notifications/settings')
      setSettings(r.data)
      showToast('Notifications disabled on this device')
    } catch {
      showToast('Could not disable push notifications', 'error')
    } finally {
      setPushLoading(false)
    }
  }

  const sendTestPush = async () => {
    if (!currentEndpoint) {
      showToast('Enable push on this device first before sending a test', 'error')
      return
    }
    setTestLoading(true)
    try {
      await api.post('/notifications/push/test', { endpoint: currentEndpoint })
      showToast('Test notification sent to this device 🔔')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      showToast(msg || 'Test failed', 'error')
    } finally {
      setTestLoading(false)
    }
  }

  // ── Telegram linking ────────────────────────────────────────────────────────
  const openTelegramModal = async () => {
    try {
      const res = await api.get('/notifications/telegram/code')
      setTgCode(res.data.code)
      setTgBotUsername(res.data.bot_username)
      setTgModal(true)
      startPolling()
    } catch {
      showToast('Could not generate link code', 'error')
    }
  }

  const startPolling = () => {
    setTgPolling(true)
    pollCountRef.current = 0
    if (pollRef.current) clearInterval(pollRef.current)

    pollRef.current = setInterval(async () => {
      pollCountRef.current++
      if (pollCountRef.current > 60) {   // 3-minute timeout (60 × 3s)
        stopPolling()
        return
      }
      try {
        const res = await api.get('/notifications/telegram/status')
        if (res.data.linked) {
          stopPolling()
          setTgLinked(true)
          setSettings((s) => s ? { ...s, telegram_linked: true } : s)
          setTimeout(() => {
            setTgModal(false)
            setTgLinked(false)
          }, 3000)
        }
      } catch {
        // ignore transient errors during polling
      }
    }, 3000)
  }

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setTgPolling(false)
  }

  const handleCopyCode = async () => {
    if (!tgCode) return
    try {
      await navigator.clipboard.writeText(tgCode)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = tgCode
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setTgCopied(true)
    setTimeout(() => setTgCopied(false), 2500)
  }

  const unlinkTelegram = async () => {
    try {
      await api.post('/notifications/telegram/unlink')
      setSettings((s) => s ? { ...s, telegram_linked: false } : s)
      showToast('Telegram unlinked')
    } catch {
      showToast('Could not unlink Telegram', 'error')
    }
  }

  // ── Periodic background sync (PWA) ──────────────────────────────────────────
  const registerPeriodicSync = async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      if ('periodicSync' in registration) {
        await (registration as any).periodicSync.register('medicine-check', {
          minInterval: 60 * 60 * 1000,
        })
      }
    } catch {}
  }

  // Cleanup polling on unmount
  useEffect(() => () => stopPolling(), [])

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="app-shell">
        <Header />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-teal)' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Header />

      {/* Toast */}
      {toast && (
        <div className={`notif-toast ${toast.type}`} role="alert">
          {toast.type === 'success' ? <Check size={14} /> : <X size={14} />}
          {toast.msg}
        </div>
      )}

      <div className="page-scroll" style={{ padding: '16px 16px 40px' }}>

        {/* Page title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <button
            className="icon-btn"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            type="button"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>
              Notifications
            </h1>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Medicine reminders for you
            </p>
          </div>
        </div>

        {/* ── Section 1: Phone Notifications (per-device) ──────────────── */}
        <div className="notif-card">
          <div className="notif-card-header">
            <div className="notif-card-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <Bell size={18} color="white" />
            </div>
            <div>
              <div className="notif-card-title">Phone Notifications</div>
              <div className="notif-card-sub">
                {currentEndpoint
                  ? '✅ Enabled on this device'
                  : 'Not enabled on this device'}
                {(settings?.push_device_count ?? 0) > 1 && (
                  <span> · {settings!.push_device_count - 1} other device{(settings!.push_device_count - 1) !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
            <div className="notif-status-pill" data-enabled={!!currentEndpoint}>
              {currentEndpoint ? 'On' : 'Off'}
            </div>
          </div>

          {/* Device list */}
          {(settings?.push_devices?.length ?? 0) > 0 && (
            <div className="notif-device-list">
              {settings!.push_devices.map((d, i) => (
                <div key={i} className={`notif-device-row ${d.current_device ? 'current' : ''}`}>
                  <Smartphone size={13} />
                  <span className="notif-device-label">
                    {d.current_device ? 'This device' : `Device ${i + 1}`}
                  </span>
                  {d.current_device && <span className="notif-device-badge">current</span>}
                </div>
              ))}
            </div>
          )}

          <div className="notif-card-actions">
            {currentEndpoint ? (
              <>
                <button
                  className="notif-btn notif-btn-ghost"
                  onClick={sendTestPush}
                  disabled={testLoading}
                  type="button"
                  id="notif-test-push-btn"
                >
                  {testLoading
                    ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Send size={14} />}
                  Send Test
                </button>
                <button
                  className="notif-btn notif-btn-danger"
                  onClick={disablePush}
                  disabled={pushLoading}
                  type="button"
                  id="notif-disable-push-btn"
                >
                  <BellOff size={14} />
                  Disable on this device
                </button>
              </>
            ) : (
              <button
                className="notif-btn notif-btn-primary"
                onClick={enablePush}
                disabled={pushLoading}
                type="button"
                id="notif-enable-push-btn"
                style={{ width: '100%' }}
              >
                {pushLoading
                  ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Bell size={14} />}
                {pushLoading ? 'Requesting permission…' : 'Enable on this device'}
              </button>
            )}
          </div>
        </div>

        {/* ── Section 2: Telegram ─────────────────────────────────────────── */}
        <div className="notif-card">
          <div className="notif-card-header">
            <div className="notif-card-icon" style={{ background: 'linear-gradient(135deg, #0088cc, #00a9e0)' }}>
              <MessageCircle size={18} color="white" />
            </div>
            <div>
              <div className="notif-card-title">Telegram</div>
              <div className="notif-card-sub">
                {settings?.telegram_linked
                  ? '✅ Bot linked — DMs on reminder time'
                  : 'Receive DMs from @' + tgBotUsername}
              </div>
            </div>
            <div className="notif-status-pill" data-enabled={settings?.telegram_linked}>
              {settings?.telegram_linked ? 'On' : 'Off'}
            </div>
          </div>

          <div className="notif-card-actions">
            {settings?.telegram_linked ? (
              <button
                className="notif-btn notif-btn-danger"
                onClick={unlinkTelegram}
                type="button"
                id="notif-unlink-telegram-btn"
              >
                <Unlink size={14} />
                Unlink Telegram
              </button>
            ) : (
              <button
                className="notif-btn notif-btn-telegram"
                onClick={openTelegramModal}
                type="button"
                id="notif-link-telegram-btn"
                style={{ width: '100%' }}
              >
                <Link size={14} />
                Link Telegram
              </button>
            )}
          </div>
        </div>

        {/* ── Section 3: Reminder Schedule ───────────────────────────────── */}
        <div className="notif-card" style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 16 }}>
            <div className="notif-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={15} style={{ color: 'var(--accent-teal)' }} />
              Reminder Times
            </div>
            <div className="notif-card-sub" style={{ marginTop: 2 }}>
              Set when each dose reminder fires. Toggle to enable/disable.
            </div>
          </div>

          {ALL_SLOTS.map(({ key, label, emoji }) => {
            const active = settings?.slots.includes(key) ?? true
            return (
              <div key={key} className={`notif-slot-row ${active ? 'active' : 'inactive'}`}>
                <button
                  className={`slot-toggle ${active ? 'on' : 'off'}`}
                  onClick={() => toggleSlot(key)}
                  type="button"
                  aria-label={`Toggle ${label} reminder`}
                  aria-pressed={active}
                  id={`notif-slot-${key}`}
                >
                  <span className="slot-toggle-thumb" />
                </button>
                <span className="slot-emoji">{emoji}</span>
                <span className="slot-label">{label}</span>
                <input
                  type="time"
                  className="slot-time-input"
                  value={editTimes[key] ?? '08:00'}
                  disabled={!active}
                  onChange={(e) => {
                    setEditTimes((prev) => ({ ...prev, [key]: e.target.value }))
                    setTimeDirty(true)
                  }}
                  aria-label={`${label} reminder time`}
                  id={`notif-time-${key}`}
                />
              </div>
            )
          })}

          {timeDirty && (
            <button
              className="notif-btn notif-btn-primary"
              onClick={saveTimes}
              disabled={timeSaving}
              type="button"
              id="notif-save-times-btn"
              style={{ width: '100%', marginTop: 14 }}
            >
              {timeSaving
                ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : <Check size={14} />}
              {timeSaving ? 'Saving…' : 'Save Reminder Times'}
            </button>
          )}
        </div>

        {/* ── Explainer ──────────────────────────────────────────────────── */}
        <div className="notif-explainer">
          <strong>How it works:</strong> At each reminder time, DawaiSathi checks your active medicines.
          If any are due (and still within their prescribed days), you get a notification —
          even if your phone is locked. The <em>days</em> field from your prescriptions is used
          to automatically stop reminders when a course ends.
        </div>
        <div className="notif-explainer" style={{ marginTop: 6 }}>
          <strong>Per-device:</strong> Enable notifications separately on each device.
          "Send Test" targets only this device. The PWA also periodically syncs
          in the background so medicine time changes reach you.
        </div>
      </div>

      {/* ── Telegram Linking Modal ──────────────────────────────────────────── */}
      {tgModal && (
        <div className="modal-overlay modal-overlay-center" onClick={() => { stopPolling(); setTgModal(false); setTgLinked(false) }}>
          <div className="tg-dialog" onClick={(e) => e.stopPropagation()}>

            {/* Telegram Icon (Real SVG) */}
            <div className="tg-logo-circle">
              <svg viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.26-1.911.177-.183 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
            </div>

            <h2 className="tg-title">Link Telegram</h2>
            <p className="tg-subtitle">
              Send this code to{' '}
              <a
                href={`https://t.me/${tgBotUsername}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                @{tgBotUsername}
              </a>
            </p>

            {/* Code digits */}
            <div className="tg-code-box">
              {tgCode.split('').map((digit, i) => (
                <span key={i} className={`tg-code-digit ${tgCopied || tgLinked ? 'filled' : ''}`} style={{ transitionDelay: `${i * 60}ms` }}>{digit}</span>
              ))}
            </div>

            {/* Action buttons */}
            <div className="tg-action-row">
              <button
                className={`tg-btn tg-btn-copy ${tgCopied ? 'copied' : ''}`}
                onClick={handleCopyCode}
                type="button"
                id="tg-copy-code-btn"
                aria-label="Copy Telegram code"
              >
                {tgCopied ? '✓' : '📋'}
                {tgCopied ? 'Copied!' : 'Copy Code'}
              </button>
              <a
                className="tg-btn tg-btn-telegram"
                href={`https://t.me/${tgBotUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                id="tg-open-btn"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white" style={{ flexShrink: 0 }}>
                  <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.26-1.911.177-.183 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                Open Telegram
              </a>
            </div>

            {/* Waiting + countdown */}
            {tgPolling && !tgLinked && (
              <div className="tg-waiting">
                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Waiting for you to send the code…
              </div>
            )}
            {!tgLinked && (
              <div className="tg-countdown">Code expires in 10 minutes</div>
            )}

            {/* Success state (in-card) */}
            {tgLinked && (
              <div className="tg-success-overlay">
                <div className="tg-success-check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div className="tg-success-text">Telegram Linked! 🎉</div>
                <div className="tg-success-sub">You'll now get reminders on Telegram</div>
              </div>
            )}

            {/* Cancel */}
            {!tgLinked && (
              <button
                className="tg-cancel-btn"
                onClick={() => { stopPolling(); setTgModal(false); setTgLinked(false) }}
                type="button"
                id="tg-cancel-btn"
              >
                ✕ Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
