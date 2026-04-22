import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Smile,
  Meh,
  Frown,
  Star,
  Check,
  X,
  BookMarked,
  RotateCw,
  Home,
  PartyPopper,
} from 'lucide-react'
import { SUBJECTS } from '../lib/subjects.js'
import { api } from '../lib/api.js'
import SubjectTag from '../components/SubjectTag.jsx'
import Ring from '../components/Ring.jsx'
import ProgressBar from '../components/ProgressBar.jsx'

const MOOD = {
  great: { icon: Smile, color: '#3B8A7C', label: '太厲害了', text: '表現超棒！繼續保持 ✨' },
  ok: { icon: Meh, color: '#C6651E', label: '還不錯', text: '不錯喔，再接再厲！' },
  low: { icon: Frown, color: '#D14343', label: '再加油', text: '別灰心，我們再練一次！' },
}

export default function Result() {
  const navigate = useNavigate()
  const loc = useLocation()
  const st = loc.state
  const [goal, setGoal] = useState(null)

  useEffect(() => {
    if (!st) {
      navigate('/practice', { replace: true })
      return
    }
    if (st.previewMode) return // teacher preview: skip daily goal fetch
    api
      .get('/api/student/home')
      .then((d) => setGoal({ after: d.dailyDone, total: d.student.daily_goal }))
      .catch(() => {})
  }, [st, navigate])

  if (!st) return null
  const { subject, unit, correct, total, wrong, stars, time, mistakes } = st
  const s = SUBJECTS[subject]
  const pct = total > 0 ? Math.round((correct * 100) / total) : 0
  const moodKey = pct >= 80 ? 'great' : pct >= 60 ? 'ok' : 'low'
  const Mood = MOOD[moodKey]
  const MoodIcon = Mood.icon
  const goalAfter = goal?.after ?? null
  const goalTotal = goal?.total ?? null
  const goalBefore = goalAfter != null ? Math.max(0, goalAfter - total) : null
  const goalReached = goalAfter != null && goalTotal != null && goalAfter >= goalTotal

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-8">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SubjectTag subject={subject} />
          {unit && <span className="text-[13px] text-ink-sub">{unit}</span>}
        </div>
        <span className="text-[13px] text-ink-sub font-num">{time}</span>
      </div>

      <div className="bg-card rounded-card border border-line shadow-card p-6 mb-4">
        <div className="flex items-center gap-5">
          <Ring value={correct} max={total} size={132} stroke={12} color={s.color}>
            <div className="flex items-baseline">
              <span className="font-semibold font-num" style={{ color: s.color, fontSize: 38 }}>
                {correct}
              </span>
              <span className="text-[18px] text-ink-sub">/{total}</span>
            </div>
            <div
              className="text-[13px] font-semibold font-num mt-0.5"
              style={{ color: s.color }}
            >
              {pct}%
            </div>
          </Ring>
          <div className="flex-1">
            <div className="flex items-center gap-2" style={{ color: Mood.color }}>
              <MoodIcon size={22} strokeWidth={2.25} />
              <span className="text-[17px] font-semibold">{Mood.label}</span>
            </div>
            <p className="mt-1 text-[14px] text-ink-sub">{Mood.text}</p>
          </div>
        </div>
        <div
          className="mt-5 pt-4 grid grid-cols-3 gap-2"
          style={{ borderTop: '1px solid var(--line-soft)' }}
        >
          <Stat icon={Check} label="答對" value={correct} color="#3B8A7C" />
          <Stat icon={X} label="答錯" value={wrong} color="#D14343" />
          <Stat icon={Star} label="星星" value={`+${stars}`} color="#C6651E" />
        </div>
      </div>

      <div
        className="rounded-card border shadow-card p-4 mb-4"
        style={{
          background: goalReached ? 'var(--subject-english-bg)' : 'var(--card)',
          borderColor: goalReached ? '#3B8A7C' : 'var(--line)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {goalReached && <PartyPopper size={18} style={{ color: '#3B8A7C' }} />}
            <span
              className="text-[14px] font-medium"
              style={{ color: goalReached ? '#3B8A7C' : 'var(--ink)' }}
            >
              {goalReached ? '今日目標達成!' : '今日目標'}
            </span>
          </div>
          {goalAfter != null && goalTotal != null && (
            <span className="text-[13px] font-num text-ink-sub">
              {goalBefore} →{' '}
              <span className="font-semibold text-ink">{goalAfter}</span> / {goalTotal}
            </span>
          )}
        </div>
        {goalAfter != null && goalTotal != null && (
          <div className="mt-3">
            <ProgressBar
              value={goalAfter}
              max={goalTotal}
              height={10}
              color={goalReached ? '#3B8A7C' : '#1A1A1A'}
            />
          </div>
        )}
      </div>

      {mistakes?.length > 0 && (
        <div className="bg-card rounded-card border border-line shadow-card p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookMarked size={16} strokeWidth={2} />
              <span className="text-[14px] font-medium">錯題回顧</span>
              <span
                className="inline-flex rounded-chip font-medium font-num"
                style={{
                  background: '#FBEBEB',
                  color: '#D14343',
                  fontSize: 11,
                  padding: '1px 8px',
                }}
              >
                {mistakes.length}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {mistakes.slice(0, 3).map((m, i) => (
              <div
                key={i}
                className="rounded-bubble p-3"
                style={{ background: 'var(--page)' }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="text-[13px] font-semibold text-ink-sub font-num shrink-0"
                    style={{ width: 32 }}
                  >
                    Q{m.q}
                  </span>
                  <span className="flex-1 text-[14px] truncate">{m.text}</span>
                </div>
                <div className="mt-1 text-[12px] flex items-center gap-2 pl-[44px] font-num">
                  <span style={{ color: '#D14343' }}>你 {m.your}</span>
                  <span className="text-ink-sub">→</span>
                  <span style={{ color: '#3B8A7C' }}>正解 {m.correct}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <button
          onClick={() => navigate('/practice', { replace: true })}
          className="w-full inline-flex items-center justify-center gap-2 rounded-btn text-white font-semibold"
          style={{ minHeight: 56, background: s.color, fontSize: 16 }}
        >
          <RotateCw size={18} strokeWidth={2.25} />
          再練一次
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            disabled
            className="inline-flex items-center justify-center gap-2 rounded-btn bg-card border border-line text-ink-sub cursor-not-allowed"
            style={{ minHeight: 56, fontSize: 15 }}
          >
            <BookMarked size={18} strokeWidth={2} />
            練錯題
          </button>
          <button
            onClick={() => navigate('/practice')}
            className="inline-flex items-center justify-center gap-2 rounded-btn bg-card border border-line font-medium"
            style={{ minHeight: 56, fontSize: 15 }}
          >
            <Home size={18} strokeWidth={2} />
            回首頁
          </button>
        </div>
      </div>
    </main>
  )
}

function Stat({ icon: IconCmp, label, value, color }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-1" style={{ color }}>
        <IconCmp size={14} strokeWidth={2.25} />
        <span className="text-[12px] text-ink-sub">{label}</span>
      </div>
      <div className="font-semibold font-num mt-1" style={{ color, fontSize: 22 }}>
        {value}
      </div>
    </div>
  )
}
