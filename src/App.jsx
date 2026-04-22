import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext.jsx'
import ProtectedRoute from './auth/ProtectedRoute.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import StudentLogin from './pages/StudentLogin.jsx'
import Practice from './pages/Practice.jsx'
import Quiz from './pages/Quiz.jsx'
import Result from './pages/Result.jsx'
import TeacherDashboard from './pages/TeacherDashboard.jsx'
import TeacherQuestions from './pages/TeacherQuestions.jsx'

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-sub text-sm">
        載入中…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  // Everyone (teacher + student) lands on the practice picker. Teachers
  // have a "後台" button there to jump to management.
  return <Navigate to="/practice" replace />
}

function AnyAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-sub text-sm">
        載入中…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/student/login" element={<StudentLogin />} />

        <Route
          path="/practice"
          element={
            <AnyAuth>
              <Practice />
            </AnyAuth>
          }
        />
        <Route
          path="/quiz"
          element={
            <AnyAuth>
              <Quiz />
            </AnyAuth>
          }
        />
        <Route
          path="/result"
          element={
            <AnyAuth>
              <Result />
            </AnyAuth>
          }
        />

        {/* Legacy student routes — redirect to the unified practice flow */}
        <Route path="/student" element={<Navigate to="/practice" replace />} />
        <Route
          path="/student/quiz/:subject"
          element={<Navigate to="/practice" replace />}
        />
        <Route
          path="/student/result"
          element={<Navigate to="/practice" replace />}
        />

        <Route
          path="/teacher"
          element={
            <ProtectedRoute role="teacher">
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/questions"
          element={
            <ProtectedRoute role="teacher">
              <TeacherQuestions />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
