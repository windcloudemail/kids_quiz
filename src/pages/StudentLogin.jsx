import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { BookOpen } from 'lucide-react'

export default function StudentLogin() {
  const { studentLogin } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      await studentLogin(username.trim(), password)
      navigate('/student', { replace: true })
    } catch (e) {
      setErr(e.message || '登入失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10 bg-page">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <span
            className="inline-flex items-center justify-center rounded-md"
            style={{ width: 40, height: 40, background: '#3B8A7C', color: '#fff' }}
          >
            <BookOpen size={22} strokeWidth={2.25} />
          </span>
          <span className="text-[18px] font-semibold text-ink">學生登入</span>
        </div>

        <form onSubmit={submit} className="bg-card rounded-card border border-line p-6 shadow-card">
          <label className="block text-[14px] font-medium text-ink-sub mb-1">帳號</label>
          <input
            type="text"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-btn border border-line bg-page px-3 text-[17px] text-ink outline-none focus:bg-card focus:border-ink"
            style={{ minHeight: 48 }}
          />

          <label className="block text-[14px] font-medium text-ink-sub mb-1 mt-4">密碼</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-btn border border-line bg-page px-3 text-[17px] text-ink outline-none focus:bg-card focus:border-ink"
            style={{ minHeight: 48 }}
          />

          {err && (
            <div className="mt-3 text-[14px]" style={{ color: 'var(--subject-chinese)' }}>
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 w-full rounded-btn text-white font-semibold text-[17px] disabled:opacity-60"
            style={{ minHeight: 56, background: '#3B8A7C' }}
          >
            {busy ? '登入中…' : '登入'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/login" className="text-[14px] text-ink-sub hover:text-ink">
            我是老師 →
          </Link>
        </div>
      </div>
    </main>
  )
}
