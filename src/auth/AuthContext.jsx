import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from '../lib/api.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const me = await api.get('/api/auth/me')
      setUser(me.user || null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const teacherLogin = async (email, password) => {
    const res = await api.post('/api/auth/teacher-login', { email, password })
    setUser(res.user)
    return res.user
  }
  const teacherRegister = async (email, password, name) => {
    const res = await api.post('/api/auth/teacher-register', { email, password, name })
    setUser(res.user)
    return res.user
  }
  const studentLogin = async (username, password) => {
    const res = await api.post('/api/auth/student-login', { username, password })
    setUser(res.user)
    return res.user
  }
  const logout = async () => {
    try {
      await api.post('/api/auth/logout')
    } catch {
      /* ignore */
    }
    setUser(null)
  }

  return (
    <AuthCtx.Provider
      value={{ user, loading, refresh, teacherLogin, teacherRegister, studentLogin, logout }}
    >
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
