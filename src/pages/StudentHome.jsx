import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BookMarked,
  Award,
  BookOpen,
  Calculator,
  Languages,
  LogOut,
  Shuffle,
  X,
  Check,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { api } from '../lib/api.js'
import { SUBJECTS, SUBJECT_LIST } from '../lib/subjects.js'
import Sparkline from '../components/Sparkline.jsx'
import ProgressBar from '../components/ProgressBar.jsx'

const SUBJECT_ICON = { chinese: BookOpen, math: Calculator, english: Languages }
const COUNT_PRESETS = [10, 20, 30, 50]

export default function StudentHome() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [home, setHome] = useState(null)
  const [err, setErr] = useState(null)
  const [picker, setPicker] = useState(null) // { subject } | null

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
                  onClick={() => setPicker({ subject: sid })}
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
      {picker && (
        <StartQuizModal
          subject={picker.subject}
          onClose={() => setPicker(null)}
          onStart={({ unit, grade, count, shuffle }) => {
            const qs = new URLSearchParams({
              count: String(count),
              shuffle: shuffle ? '1' : '0',
            })
            if (unit) qs.set('unit', unit)
            if (grade) qs.set('grade', String(grade))
            navigate(`/student/quiz/${picker.subject}?${qs.toString()}`)
          }}
        />
      )}
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

// Sheet-style modal shown when the student taps "開始練習" on a subject card.
// Lets them pick a specific book (unit), the number of questions, and whether
// to shuffle option positions. All choices are optional — the defaults
// ("全部題本", 10 題, 選項隨機 on) match the original one-tap flow.
function StartQuizModal({ subject, onClose, onStart }) {
  const s = SUBJECTS[subject]
  const [books, setBooks] = useState(null)
  const [loadErr, setLoadErr] = useState(null)
  const [unit, setUnit] = useState('')
  const [grade, setGrade] = useState('')
  const [count, setCount] = useState(10)
  const [shuffle, setShuffle] = useState(true)

  useEffect(() => {
    api
      .get(`/api/student/books?subject=${encodeURIComponent(subject)}`)
      .then((d) => setBooks(d.books || []))
      .catch((e) => setLoadErr(e.message))
  }, [subject])

  const total = books?.reduce((n, b) => n + b.count, 0) || 0
  const selectedCount = unit
    ? books?.find((b) => b.unit === unit && (!grade || b.grade === grade))?.count || 0
    : total
  const usableCount = Math.min(count, selectedCount || count)

  return (
    <div
      className="fixed inset-0 z-20 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-card w-full max-w-md shadow-card overflow-hidden"
        style={{
          borderRadius: '20px 20px 0 0',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--line)' }}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center justify-center"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: s.iconBg,
                color: s.color,
              }}
            >
              <BookMarked size={15} strokeWidth={2.25} />
            </span>
            <span className="font-semibold text-[16px]">{s.name} 練習設定</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-bubble p-1 hover:bg-neutral-chip"
            aria-label="關閉"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto" style={{ flex: 1 }}>
          <div className="mb-4">
            <div className="text-[13px] font-medium text-ink-sub mb-2">
              選題本 (可擇一)
            </div>
            {!books && !loadErr && (
              <div className="text-[13px] text-ink-sub">載入中…</div>
            )}
            {loadErr && (
              <div className="text-[13px]" style={{ color: '#D14343' }}>
                {loadErr}
              </div>
            )}
            {books && books.length === 0 && (
              <div className="text-[13px] text-ink-sub">
                這個科目目前沒有題目
              </div>
            )}
            {books && books.length > 0 && (
              <div className="flex flex-col gap-2">
                <BookChip
                  active={!unit}
                  onClick={() => {
                    setUnit('')
                    setGrade('')
                  }}
                  label="全部題本"
                  meta={`${total} 題`}
                  color={s.color}
                />
                {books.map((b) => (
                  <BookChip
                    key={`${b.grade}|${b.unit || ''}`}
                    active={unit === b.unit && grade === b.grade}
                    onClick={() => {
                      setUnit(b.unit || '')
                      setGrade(b.grade)
                    }}
                    label={b.unit || '未分類'}
                    meta={`${b.grade} 年級 · ${b.count} 題`}
                    color={s.color}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mb-4">
            <div className="text-[13px] font-medium text-ink-sub mb-2">題數</div>
            <div className="flex items-center gap-2 flex-wrap">
              {COUNT_PRESETS.map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className="rounded-chip font-medium font-num"
                  style={{
                    padding: '6px 14px',
                    fontSize: 14,
                    background: count === n ? s.color : '#fff',
                    color: count === n ? '#fff' : 'var(--ink)',
                    border: `1px solid ${count === n ? s.color : 'var(--line)'}`,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            {selectedCount > 0 && count > selectedCount && (
              <div className="mt-2 text-[12px] text-ink-sub">
                此題本只有 {selectedCount} 題,會全出
              </div>
            )}
          </div>

          <button
            onClick={() => setShuffle((v) => !v)}
            className="w-full flex items-center justify-between rounded-bubble"
            style={{
              padding: '10px 14px',
              background: shuffle ? 'var(--subject-english-bg)' : '#fff',
              border: `1px solid ${shuffle ? '#3B8A7C' : 'var(--line)'}`,
            }}
          >
            <div className="flex items-center gap-2">
              <Shuffle
                size={16}
                style={{ color: shuffle ? '#3B8A7C' : '#888' }}
              />
              <div className="text-left">
                <div
                  className="text-[14px] font-medium"
                  style={{ color: shuffle ? '#3B8A7C' : 'var(--ink)' }}
                >
                  選項隨機排列
                </div>
                <div className="text-[11px] text-ink-sub">
                  避免死記答案是 A / B / C / D
                </div>
              </div>
            </div>
            <span
              className="inline-flex items-center justify-center shrink-0"
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: shuffle ? '#3B8A7C' : 'transparent',
                border: `2px solid ${shuffle ? '#3B8A7C' : '#ccc'}`,
                color: '#fff',
              }}
            >
              {shuffle && <Check size={13} strokeWidth={3} />}
            </span>
          </button>
        </div>

        <div
          className="px-5 py-4"
          style={{ borderTop: '1px solid var(--line)' }}
        >
          <button
            disabled={!books || books.length === 0}
            onClick={() =>
              onStart({
                unit,
                grade: grade || null,
                count: usableCount,
                shuffle,
              })
            }
            className="w-full inline-flex items-center justify-center gap-2 rounded-btn text-white font-semibold disabled:opacity-40"
            style={{ minHeight: 52, background: s.color, fontSize: 16 }}
          >
            開始 {usableCount} 題練習
            <ArrowRight size={18} strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </div>
  )
}

function BookChip({ active, onClick, label, meta, color }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between rounded-bubble"
      style={{
        padding: '10px 14px',
        background: active ? color + '14' : '#fff',
        border: `2px solid ${active ? color : 'var(--line)'}`,
        transition: 'all 0.15s ease',
      }}
    >
      <span
        className="text-[14px] font-medium text-left truncate"
        style={{ color: 'var(--ink)' }}
      >
        {label}
      </span>
      <span
        className="text-[12px] font-num shrink-0 ml-2"
        style={{ color: active ? color : 'var(--ink-sub)' }}
      >
        {meta}
      </span>
    </button>
  )
}
