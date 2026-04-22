import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { GraduationCap } from 'lucide-react'

export default function Register() {
  const { teacherRegister } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      await teacherRegister(email.trim(), password, name.trim() || null)
      navigate('/teacher', { replace: true })
    } catch (e) {
      setErr(e.message || '註冊失敗')
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
            style={{ width: 40, height: 40, background: '#1A1A1A', color: '#fff' }}
          >
            <GraduationCap size={22} strokeWidth={2.25} />
          </span>
          <span className="text-[18px] font-semibold text-ink">老師註冊</span>
        </div>

        <form onSubmit={submit} className="bg-card rounded-card border border-line p-6 shadow-card">
          <label className="block text-[13px] font-medium text-ink-sub mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-btn border border-line bg-page px-3 py-2.5 text-[15px] text-ink outline-none focus:bg-card focus:border-ink"
          />

          <label className="block text-[13px] font-medium text-ink-sub mb-1 mt-4">
            顯示名稱(可空)
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例:王老師"
            className="w-full rounded-btn border border-line bg-page px-3 py-2.5 text-[15px] text-ink outline-none focus:bg-card focus:border-ink"
          />

          <label className="block text-[13px] font-medium text-ink-sub mb-1 mt-4">
            密碼(至少 4 碼)
          </label>
          <input
            type="password"
            required
            minLength={4}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-btn border border-line bg-page px-3 py-2.5 text-[15px] text-ink outline-none focus:bg-card focus:border-ink"
          />

          {err && (
            <div className="mt-3 text-[13px]" style={{ color: 'var(--subject-chinese)' }}>
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 w-full rounded-btn text-white font-semibold text-[15px] disabled:opacity-60"
            style={{ minHeight: 44, background: '#1A1A1A' }}
          >
            {busy ? '註冊中…' : '建立帳號'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/login" className="text-[13px] text-ink-sub hover:text-ink">
            已有帳號?登入
          </Link>
        </div>
      </div>
    </main>
  )
}
