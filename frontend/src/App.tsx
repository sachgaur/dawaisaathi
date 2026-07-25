import React, { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import api from './api/client'

// Lazy-loaded pages — each page becomes its own JS chunk.
// This means the browser only downloads what the user actually navigates to,
// dramatically reducing initial bundle size (TBT) and speeding up first paint (FCP).
const AuthGate      = lazy(() => import('./pages/AuthGate'))
const AuthSuccess   = lazy(() => import('./pages/AuthSuccess'))
const FamilySettings = lazy(() => import('./pages/FamilySettings'))
const Cabinet       = lazy(() => import('./pages/Cabinet'))
const Scanner       = lazy(() => import('./pages/Scanner'))
const ScanApproval  = lazy(() => import('./pages/ScanApproval'))
const ManualEntry   = lazy(() => import('./pages/ManualEntry'))
const FamilyInbox   = lazy(() => import('./pages/FamilyInbox'))
const NotificationSettings = lazy(() => import('./pages/NotificationSettings'))

// Minimal full-screen spinner shown while a lazy chunk is being downloaded.
// Matches the dark background so there's no flash of white (prevents CLS).
function PageSuspense() {
  return (
    <div
      style={{
        height: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
      }}
      aria-label="Loading page"
    >
      <div className="loading-spinner" />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <PageSuspense />
  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!user) return

    const runSync = async () => {
      try {
        // 1. Open local database and fetch local logs
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const req = indexedDB.open('dawaisathi-offline', 1)
          req.onupgradeneeded = (e: any) => {
            const dbObj = e.target.result
            if (!dbObj.objectStoreNames.contains('logs')) {
              dbObj.createObjectStore('logs', { keyPath: 'id' })
            }
            if (!dbObj.objectStoreNames.contains('schedules')) {
              dbObj.createObjectStore('schedules')
            }
          }
          req.onsuccess = (e: any) => resolve(e.target.result)
          req.onerror = (e: any) => reject(e.target.error)
        })

        const logsList = await new Promise<any[]>((resolve, reject) => {
          const tx = db.transaction('logs', 'readonly')
          const store = tx.objectStore('logs')
          const req = store.getAll()
          req.onsuccess = () => resolve(req.result || [])
          req.onerror = () => reject(req.error)
        })

        // 2. Push any offline-triggered notification logs to the server
        if (logsList.length > 0) {
          const syncResp = await api.post('/notifications/sync', { logs: logsList })
          if (syncResp.data.ok) {
            const idsToClear = logsList.map(l => l.id)
            await new Promise<void>((resolve, reject) => {
              const tx = db.transaction('logs', 'readwrite')
              const store = tx.objectStore('logs')
              idsToClear.forEach(id => store.delete(id))
              tx.oncomplete = () => resolve()
              tx.onerror = (e: any) => reject(e.target.error)
            })
          }
        }

        // 3. Fetch latest active medicines and configurations
        const [settingsRes, medicineRes] = await Promise.all([
          api.get('/notifications/settings'),
          api.get('/medicine/cabinet')
        ])

        const slots = settingsRes.data.slots || []
        const times = settingsRes.data.times || {}
        const medicines = medicineRes.data.medicines || []

        // 4. Send the data to the Service Worker
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SYNC_SCHEDULES',
            payload: { slots, times, medicines }
          })
        }
      } catch (err) {
        console.error('[App] Notification sync failed:', err)
      }
    }

    runSync()
  }, [user])

  if (loading) return <PageSuspense />

  return (
    <div className="app-shell">
      <Suspense fallback={<PageSuspense />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={user ? <Navigate to="/home" replace /> : <AuthGate />} />
          <Route path="/auth/success" element={<AuthSuccess />} />

          {/* Protected */}
          <Route path="/home"        element={<ProtectedRoute><FamilySettings /></ProtectedRoute>} />
          <Route path="/cabinet"     element={<ProtectedRoute><Cabinet /></ProtectedRoute>} />
          <Route path="/scan"        element={<ProtectedRoute><Scanner /></ProtectedRoute>} />
          <Route path="/scan/approve" element={<ProtectedRoute><ScanApproval /></ProtectedRoute>} />
          <Route path="/manual-entry" element={<ProtectedRoute><ManualEntry /></ProtectedRoute>} />
          <Route path="/inbox"       element={<ProtectedRoute><FamilyInbox /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
