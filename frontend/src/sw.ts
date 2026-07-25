/// <reference lib="WebWorker" />
/// <reference types="vite-plugin-pwa/client" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare const self: ServiceWorkerGlobalScope

// ── Precache all Vite-built assets ────────────────────────────────────────────
// self.__WB_MANIFEST is injected by vite-plugin-pwa at build time
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// ── Runtime caching: API calls (NetworkFirst, 24h) ────────────────────────────
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 8,
    plugins: [
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 86400 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

// ── Runtime caching: Medicine/prescription images (CacheFirst, 30 days) ───────
registerRoute(
  ({ url }) => url.pathname.startsWith('/uploads/'),
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 2592000 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

// ── Runtime caching: Google Fonts ────────────────────────────────────────────
registerRoute(
  ({ url }) => url.hostname === 'fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts-stylesheets' })
)
registerRoute(
  ({ url }) => url.hostname === 'fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 31536000 }),
    ],
  })
)

// ── Periodic background sync for medicine reminders ───────────────────────────
// Fired by the browser periodically (interval set during page registration).
// Tries to fetch fresh cabinet data. If the app is open, the NetworkFirst
// strategy will serve the latest. If offline/unauth'd, it's a silent no-op.
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'medicine-check') {
    event.waitUntil(
      fetch(new Request('/api/notifications/settings', { mode: 'same-origin' }))
        .catch(() => {})
    )
  }
})

// ── IndexedDB Storage Helpers ────────────────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('dawaisathi-offline', 1)
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('schedules')) {
        db.createObjectStore('schedules')
      }
      if (!db.objectStoreNames.contains('logs')) {
        db.createObjectStore('logs', { keyPath: 'id' })
      }
    }
    request.onsuccess = (e: any) => resolve(e.target.result)
    request.onerror = (e: any) => reject(e.target.error)
  })
}

function setVal(storeName: string, key: string, val: any): Promise<void> {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const req = store.put(val, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  })
}

function setLog(val: any): Promise<void> {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('logs', 'readwrite')
      const store = tx.objectStore('logs')
      const req = store.put(val)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  })
}

const DEFAULT_SLOT_TIMES: Record<string, string> = {
  morning: '08:00',
  afternoon: '13:00',
  evening: '18:00',
  night: '21:00',
}

function getDueMedicinesForSlot(medicines: any[], slot: string, dayOffset: number): any[] {
  return medicines.filter(med => {
    const sched = med.schedule || []
    if (!sched.includes(slot)) return false

    if (med.days !== null && med.days !== undefined) {
      const createdDate = new Date(med.created_at)
      const todayDate = new Date()
      todayDate.setDate(todayDate.getDate() + dayOffset)

      const diffTime = todayDate.getTime() - createdDate.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      if (diffDays >= med.days) return false
    }
    return true
  })
}

function scheduleTriggerNotification(title: string, options: { body: string, tag: string, timestamp: number, data: any }) {
  const isTriggerSupported = 'showTrigger' in (self as any).Notification.prototype || 'showTrigger' in (self as any).registration
  if (isTriggerSupported && (self as any).TimestampTrigger) {
    try {
      const trigger = new (self as any).TimestampTrigger(options.timestamp)
      self.registration.showNotification(title, {
        body: options.body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: options.tag,
        showTrigger: trigger,
        data: options.data,
      })
      console.log(`[SW] Scheduled offline notification: ${options.tag} at ${new Date(options.timestamp).toLocaleString()}`)
    } catch (err) {
      console.error('[SW] Failed to schedule trigger notification:', err)
    }
  } else {
    console.log('[SW] Notification triggers not supported/active on this device.')
  }
}

function scheduleFutureLocalNotifications(slots: string[], times: Record<string, string>, medicines: any[]) {
  // Clear any existing fallback notifications first
  self.registration.getNotifications({ includeTriggered: true })
    .then((notifications) => {
      for (const notif of notifications) {
        if (notif.tag && notif.tag.startsWith('fallback-')) {
          notif.close()
        }
      }
    })
    .catch((err) => console.error('[SW] Error clearing existing triggers:', err))

  const now = new Date()
  // Loop for the next 3 days
  for (let i = 0; i < 3; i++) {
    const targetDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000)
    const y = targetDate.getFullYear()
    const m = targetDate.getMonth()
    const d = targetDate.getDate()

    for (const slot of slots) {
      const timeStr = times[slot] || DEFAULT_SLOT_TIMES[slot]
      if (!timeStr) continue
      const [h, min] = timeStr.split(':').map(Number)

      const reminderDate = new Date(y, m, d, h, min, 0, 0)
      // Set trigger time to 2 minutes after the scheduled slot time
      const triggerTime = reminderDate.getTime() + 2 * 60 * 1000

      if (triggerTime <= Date.now()) continue

      const dateString = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const tag = `fallback-${dateString}-${slot}`

      const dueMedicines = getDueMedicinesForSlot(medicines, slot, i)
      if (dueMedicines.length === 0) continue

      const medListStr = dueMedicines.map(m => m.name).join(', ')

      scheduleTriggerNotification(
        `💊 DawaiSathi Offline Reminder`,
        {
          body: `Time for your ${slot.toUpperCase()} medicines: ${medListStr}`,
          tag: tag,
          timestamp: triggerTime,
          data: { url: `/cabinet?date=${dateString}&slot=${slot}`, date: dateString, slot: slot, type: 'local' }
        }
      )
    }
  }
}

// ── Message handler for receiving active schedule ────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SYNC_SCHEDULES') {
    const { slots, times, medicines } = event.data.payload
    event.waitUntil(
      setVal('schedules', 'data', { slots, times, medicines })
        .then(() => {
          scheduleFutureLocalNotifications(slots, times, medicines)
        })
    )
  }
})

// ── Push notification handler ─────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload: {
    title?: string
    body?: string
    icon?: string
    badge?: string
    data?: { url?: string }
  } = {}

  try {
    payload = event.data.json()
  } catch {
    payload = { title: '💊 DawaiSathi', body: event.data.text() }
  }

  // Intercept online push and cancel corresponding offline local trigger if it exists
  const targetUrl = payload.data?.url || ''
  if (targetUrl) {
    try {
      const urlObj = new URL(targetUrl, self.location.origin)
      const dateStr = urlObj.searchParams.get('date')
      const slot = urlObj.searchParams.get('slot')
      if (dateStr && slot) {
        const fallbackTag = `fallback-${dateStr}-${slot}`
        event.waitUntil(
          self.registration.getNotifications({ includeTriggered: true })
            .then((notifications) => {
              for (const notif of notifications) {
                if (notif.tag === fallbackTag) {
                  notif.close()
                  console.log(`[SW] Cancelled offline trigger: ${fallbackTag} because online push arrived.`)
                }
              }
            })
            .catch((err) => console.error('[SW] Error cancelling trigger:', err))
        )
      }
    } catch {}
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? '💊 DawaiSathi', {
      body: payload.body ?? '',
      icon: payload.icon ?? '/pwa-192x192.png',
      badge: payload.badge ?? '/pwa-192x192.png',
      data: payload.data ?? {},
      tag: 'medicine-reminder',
      renotify: true,
    })
  )
})

// ── Notification click handler ────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl: string = (event.notification.data as { url?: string })?.url ?? '/'

  // If this was a local fallback notification, log it as an offline trigger
  const notifData = event.notification.data as any
  if (notifData && notifData.type === 'local') {
    const logItem = {
      id: `${notifData.date}_${notifData.slot}`,
      date: notifData.date,
      slot: notifData.slot,
      channel: 'local',
      synced: false
    }
    event.waitUntil(
      setLog(logItem)
        .then(() => console.log('[SW] Logged offline trigger click:', logItem))
        .catch(err => console.error('[SW] Error logging offline trigger:', err))
    )
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            client.focus()
            ;(client as WindowClient).navigate(targetUrl)
            return
          }
        }
        return self.clients.openWindow(targetUrl)
      })
  )
})
