import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BookMarked, Award, BookOpen, Calculator, Languages, LogOut } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { api } from '../lib/api.js'
import { SUBJECTS, SUBJECT_LIST } from '../lib/subjects.js'
import Sparkline from '../components/Sparkline.jsx'
import ProgressBar from '../components/ProgressBar.jsx'

const SUBJECT_ICON = { chinese: BookOpen, math: Calculator, english: Languages }

export default function StudentHome() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [home, setHome] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    api
      .get('/api/student/home')
      .then(setHome)
      .catch((e) => setErr(e.message))
  }, [])

  if (err)
    return (
      <main className="p-5 text-sm" style={{ color: 'var(--subject-chinese)' }}>
        載入失敗:{err}
      </main>
    )
  if (!home) return <main className="p-5 text-sm text-ink-sub">載入中…</main>

  const { student, streak, dailyDone, subjectStats, mistakeCount, badgeEarned, badgeTotal } = home
  const dailyGoal = student.daily_goal
  const remain = Math.max(0, dailyGoal - dailyDone)

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-24">
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="font-semibold leading-tight" style={{ fontSize: 22 }}>
            嗨 {student.display_name} 👋
          </div>
          <div className="mt-1 text-[13px] text-ink-sub">來完成今天的練習吧</div>
        </div>
        <span
          className="inline-flex items-center gap-1 font-medium font-num"
          style={{
            background: '#FFF3E8',
            color: '#C6651E',
            borderRadius: 10,
            padding: '6px 10px',
            fontSize: 13,
          }}
        >
          <span>🔥</span>
          <span>{streak} 天</span>
        </span>
      </div>

      <div className="bg-card rounded-card border border-line shadow-card p-5 mb-5">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-medium text-ink-sub">今日進度</span>
          <span className="text-[13px] text-ink-sub">還差 {remain} 題</span>
        </div>
        <div className="mt-2 flex items-baseline">
          <span className="font-semibold font-num" style={{ fontSize: 36 }}>
            {dailyDone}
          </span>
          <span className="text-[18px] text-ink-sub ml-1">/ {dailyGoal} 題</span>
        </div>
        <div className="mt-3">
          <ProgressBar value={dailyDone} max={dailyGoal} height={14} color="#1A1A1A" />
        </div>
      </div>

      <div className="flex flex-col gap-4 mb-5">
        {SUBJECT_LIST.map((sid) => {
          const s = SUBJECTS[sid]
          const st = subjectStats[sid]
          const IconCmp = SUBJECT_ICON[sid]
          return (
            <div
              key={sid}
              className="relative bg-card rounded-card border border-line shadow-card overflow-hidden"
              style={{ paddingLeft: 4 }}
            >
              <div
                className="absolute top-0 left-0 bottom-0"
                style={{ width: 4, background: s.color }}
              />
              <div className="pt-4 pb-4 pl-5 pr-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex items-center justify-center"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: s.iconBg,
                        color: s.color,
                      }}
                    >
                      <IconCmp size={18} strokeWidth={2.25} />
                    </span>
                    <span className="font-semibold" style={{ fontSize: 18 }}>
                      {s.name}
                    </span>
                  </div>
                  <span
                    className="rounded-chip font-medium font-num"
                    style={{
                      background: s.soft,
                      color: s.color,
                      fontSize: 12,
                      padding: '2px 8px',
                    }}
                  >
                    今日 {st.todayDone}/{st.todayTotal}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <div className="text-[12px] text-ink-sub">近 7 日正確率</div>
                    <div className="flex items-baseline mt-1">
                      <span
                        className="font-semibold font-num"
                        style={{ color: s.color, fontSize: 32 }}
                      >
                        {st.avg}
                      </span>
                      <span className="text-[14px] text-ink-sub ml-0.5">%</span>
                    </div>
                  </div>
                  <Sparkline data={st.weekAccuracy} color={s.color} width={120} height={40} />
                </div>

                <button
                  onClick={() => navigate(`/student/quiz/${sid}`)}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-btn text-white font-semibold"
                  style={{ minHeight: 56, background: s.color, fontSize: 16 }}
                >
                  <span>開始練習</span>
                  <ArrowRight size={18} strokeWidth={2.25} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-8">
        <EntryCard icon={BookMarked} title="錯題本" meta={`${mistakeCount} 題待複習`} />
        <EntryCard icon={Award} title="徽章" meta={`${badgeEarned} / ${badgeTotal}`} />
      </div>

      <div className="text-center">
        <button
          onClick={async () => {
            await logout()
            navigate('/student/login', { replace: true })
          }}
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-sub hover:text-ink"
        >
          <LogOut size={14} />
          登出
        </button>
      </div>
    </main>
  )
}

function EntryCard({ icon: IconCmp, title, meta }) {
  return (
    <button
      disabled
      className="bg-card rounded-card border border-line shadow-card p-4 flex items-center gap-3 text-left cursor-not-allowed"
      style={{ minHeight: 56 }}
    >
      <span
        className="inline-flex items-center justify-center shrink-0"
        style={{ width: 36, height: 36, borderRadius: 10, background: '#F3F1EB', color: '#666' }}
      >
        <IconCmp size={18} strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-medium text-ink">{title}</div>
        <div className="text-[12px] text-ink-sub truncate">{meta}</div>
      </div>
    </button>
  )
}
