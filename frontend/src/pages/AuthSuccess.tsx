import React, { useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AuthSuccess() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()

  const handleSuccess = useCallback(async () => {
    const token = params.get('token')
    if (token) {
      localStorage.setItem('token', token)
      await refreshUser()
      navigate('/home', { replace: true })
    } else {
      navigate('/', { replace: true })
    }
  }, [params, navigate, refreshUser])

  useEffect(() => {
    handleSuccess()
  }, [handleSuccess])

  return (
    <div className="loading-overlay" style={{ height: '100dvh' }}>
      <div className="loading-spinner" />
      <span>Signing you in…</span>
    </div>
  )
}
