import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'

export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-sub text-sm">
        載入中…
      </div>
    )
  }
  if (!user) {
    const redirect = role === 'student' ? '/student/login' : '/login'
    return <Navigate to={redirect} replace state={{ from: location.pathname }} />
  }
  if (role && user.type !== role) {
    return <Navigate to={user.type === 'teacher' ? '/teacher' : '/student'} replace />
  }
  return children
}
