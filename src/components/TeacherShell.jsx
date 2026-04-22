import { NavLink, useNavigate } from 'react-router-dom'
import { GraduationCap, LayoutDashboard, FileText, Users, Globe, Settings, LogOut, PlayCircle } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import Avatar from './Avatar.jsx'

const NAV = [
  { to: '/practice', icon: PlayCircle, label: '練習', end: true },
  { to: '/teacher', icon: LayoutDashboard, label: '班級', end: true },
  { to: '/teacher/questions', icon: FileText, label: '題庫' },
  { to: '/teacher/students', icon: Users, label: '學生', disabled: true },
  { to: '/teacher/public', icon: Globe, label: '公共題池', disabled: true },
  { to: '/teacher/settings', icon: Settings, label: '設定', disabled: true },
]

export default function TeacherShell({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="teacher-root min-h-screen bg-page flex">
      <aside
        className="w-[220px] shrink-0 bg-card flex flex-col"
        style={{ borderRight: '1px solid var(--line)' }}
      >
        <div
          className="flex items-center gap-2 px-4 py-4"
          style={{ borderBottom: '1px solid var(--line)' }}
        >
          <span
            className="inline-flex items-center justify-center rounded-md"
            style={{ width: 32, height: 32, background: '#1A1A1A', color: '#fff' }}
          >
            <GraduationCap size={18} strokeWidth={2.25} />
          </span>
          <span className="font-semibold text-[15px] text-ink">練習題庫</span>
        </div>
        <nav className="px-3 py-4 flex flex-col gap-1 flex-1">
          {NAV.map((item) => {
            const IconCmp = item.icon
            if (item.disabled) {
              return (
                <span
                  key={item.to}
                  className="flex items-center gap-3 px-3 py-[9px] rounded-bubble text-[14px] font-medium"
                  style={{ color: '#bbb', minHeight: 40, cursor: 'not-allowed' }}
                >
                  <IconCmp size={17} strokeWidth={2} />
                  {item.label}
                </span>
              )
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-[9px] rounded-bubble text-[14px] ${
                    isActive
                      ? 'bg-neutral-chip text-ink font-semibold'
                      : 'text-[#444] font-medium hover:bg-[#FAFAF8]'
                  }`
                }
                style={{ minHeight: 40 }}
              >
                <IconCmp size={17} strokeWidth={2} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderTop: '1px solid var(--line)' }}
        >
          <Avatar name={user?.name || '師'} size={32} color="#1A1A1A" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-ink truncate">{user?.name || '老師'}</div>
            <div className="text-[11px] text-ink-sub truncate">{user?.email}</div>
          </div>
          <button
            onClick={async () => {
              await logout()
              navigate('/login', { replace: true })
            }}
            aria-label="登出"
            className="inline-flex items-center justify-center rounded-bubble hover:bg-neutral-chip"
            style={{ width: 32, height: 32, color: '#666' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
