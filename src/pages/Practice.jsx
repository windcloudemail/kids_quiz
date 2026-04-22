import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, LogOut, Settings, ShieldCheck } from 'lucide-react'
import { api } from '../lib/api.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { SUBJECTS } from '../lib/subjects.js'

const PRESETS = [10, 20, 30, 40]

export default function Practice() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [books, setBooks] = useState(null)
  const [err, setErr] = useState(null)
  const [count, setCount] = useState(20)
  const [customCount, setCustomCount] = useState('')
  const [selectedKey, setSelectedKey] = useState('__all__')
  const [excludeMastered, setExcludeMastered] = useState(false)
  const [shuffleOptions, setShuffleOptions] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .get('/api/books')
      .then((d) => setBooks(d.books || []))
      .catch((e) => setErr(e.message))
  }, [])

  const totalCount = useMemo(
    () => (books || []).reduce((s, b) => s + b.count, 0),
    [books]
  )
  const totalMastered = useMemo(
    () => (books || []).reduce((s, b) => s + (b.mastered || 0), 0),
    [books]
  )

  const start = async () => {
    const effectiveCount =
      customCount && /^\d+$/.test(customCount)
        ? parseInt(customCount, 10)
        : count
    if (!effectiveCount || effectiveCount < 1) {
      setErr('請選擇題數')
      return
    }
    setErr(null)
    setBusy(true)
    try {
      const selectedBooks =
        selectedKey === '__all__'
          ? []
          : [keyToBook(selectedKey)]
      const res = await api.post('/api/practice/start', {
        books: selectedBooks,
        count: effectiveCount,
        exclude_mastered: excludeMastered && user?.type === 'student',
        shuffle_options: shuffleOptions,
      })
      if (!res.questions?.length) {
        setErr('找不到符合條件的題目')
        return
      }
      navigate('/quiz', {
        state: {
          questions: res.questions,
          previewMode: res.previewMode,
          meta: {
            count: res.questions.length,
            subject: res.questions[0]?.subject,
          },
        },
      })
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-page">
      <header
        className="flex items-center justify-between px-5 py-4 max-w-student mx-auto"
        style={{ maxWidth: 720 }}
      >
        <div className="text-[13px] text-ink-sub">
          你好,{' '}
          <span className="font-medium text-ink">
            {user?.display_name || user?.name || user?.email || user?.username}
          </span>
          {user?.type === 'teacher' && (
            <span
              className="ml-2 rounded-chip px-2 py-0.5 text-[11px] font-medium"
              style={{ background: '#F3F1EB', color: '#1A1A1A' }}
            >
              管理員
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {user?.type === 'teacher' && (
            <button
              onClick={() => navigate('/teacher')}
              className="inline-flex items-center gap-1.5 rounded-bubble bg-card border border-line font-medium"
              style={{ padding: '6px 12px', fontSize: 13 }}
            >
              <Settings size={13} />
              後台
            </button>
          )}
          <button
            onClick={async () => {
              await logout()
              navigate(user?.type === 'teacher' ? '/login' : '/student/login', {
                replace: true,
              })
            }}
            className="inline-flex items-center gap-1.5 rounded-bubble bg-card border border-line font-medium"
            style={{ padding: '6px 12px', fontSize: 13 }}
          >
            <LogOut size={13} />
            登出
          </button>
        </div>
      </header>

      <main className="max-w-student mx-auto px-5 pt-2 pb-10" style={{ maxWidth: 720 }}>
        <div className="text-[12px] tracking-widest text-ink-sub font-medium uppercase mb-1">
          Practice
        </div>
        <h1 className="text-[28px] font-semibold mb-1">練習題庫</h1>
        <p className="text-[14px] text-ink-sub mb-6">
          選擇題本與題數,開始隨機練習。
        </p>

        {/* 題數 */}
        <section className="mb-6">
          <div className="text-[14px] font-medium mb-2">題數</div>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {PRESETS.map((n) => (
              <button
                key={n}
                onClick={() => {
                  setCount(n)
                  setCustomCount('')
                }}
                className="rounded-card text-[15px] font-medium"
                style={{
                  padding: '12px 0',
                  background: count === n && !customCount ? 'var(--subject-chinese-bg)' : 'var(--card)',
                  border: `1px solid ${count === n && !customCount ? 'var(--subject-chinese)' : 'var(--line)'}`,
                  color: count === n && !customCount ? 'var(--subject-chinese)' : 'var(--ink)',
                }}
              >
                {n} 題
              </button>
            ))}
          </div>
          <input
            value={customCount}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d]/g, '').slice(0, 3)
              setCustomCount(v)
            }}
            placeholder="自訂  任意題數"
            className="w-full rounded-card border border-line bg-card text-[14px] outline-none focus:border-ink"
            style={{ padding: '12px 14px' }}
          />
        </section>

        {/* 題本 */}
        <section className="mb-6">
          <div className="text-[14px] font-medium mb-2">題本</div>
          {!books && <div className="text-[13px] text-ink-sub">載入中…</div>}
          {books && books.length === 0 && (
            <div className="text-[13px] text-ink-sub rounded-card border border-line p-4">
              目前題庫是空的。老師可以到「後台」→「題庫」上傳題目。
            </div>
          )}
          {books && books.length > 0 && (
            <div className="flex flex-col gap-2">
              <BookCard
                label="全部分類"
                count={totalCount}
                mastered={user?.type === 'student' ? totalMastered : null}
                subject={null}
                selected={selectedKey === '__all__'}
                onClick={() => setSelectedKey('__all__')}
              />
              {books.map((b) => (
                <BookCard
                  key={bookKey(b)}
                  label={
                    (b.unit || '未分類') +
                    (b.subject ? ` · ${SUBJECTS[b.subject]?.name || b.subject}` : '') +
                    (b.grade ? ` ${b.grade} 年級` : '')
                  }
                  count={b.count}
                  mastered={user?.type === 'student' ? b.mastered : null}
                  subject={b.subject}
                  selected={selectedKey === bookKey(b)}
                  onClick={() => setSelectedKey(bookKey(b))}
                />
              ))}
            </div>
          )}
        </section>

        {/* 選項 */}
        <section className="mb-6 flex flex-col gap-2">
          {user?.type === 'student' && (
            <label
              className="flex items-center gap-3 rounded-card border border-line bg-card cursor-pointer"
              style={{ padding: '12px 14px' }}
            >
              <input
                type="checkbox"
                checked={excludeMastered}
                onChange={(e) => setExcludeMastered(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <div>
                <div className="text-[14px] font-medium">排除已精熟的題目</div>
                <div className="text-[12px] text-ink-sub">累積答對 3 次以上的題目暫時不出現</div>
              </div>
            </label>
          )}
          <label
            className="flex items-center gap-3 rounded-card border border-line bg-card cursor-pointer"
            style={{ padding: '12px 14px' }}
          >
            <input
              type="checkbox"
              checked={shuffleOptions}
              onChange={(e) => setShuffleOptions(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            <div>
              <div className="text-[14px] font-medium">選項隨機排列</div>
              <div className="text-[12px] text-ink-sub">每題 A/B/C/D 順序打散,避免死記答案位置</div>
            </div>
          </label>
        </section>

        {err && (
          <div className="mb-3 text-[13px]" style={{ color: '#D14343' }}>
            {err}
          </div>
        )}

        {user?.type === 'teacher' && (
          <div
            className="mb-3 rounded-card border px-3 py-2 flex items-center gap-2 text-[12px]"
            style={{ background: 'var(--warn-bg)', color: 'var(--warn)', borderColor: 'var(--warn)' }}
          >
            <ShieldCheck size={14} />
            老師預覽模式:作答紀錄不會寫入,可放心試做。
          </div>
        )}

        <button
          onClick={start}
          disabled={busy || !books?.length}
          className="w-full inline-flex items-center justify-center gap-2 rounded-card text-white font-semibold disabled:opacity-60"
          style={{
            background: '#C6651E',
            minHeight: 56,
            fontSize: 17,
          }}
        >
          {busy ? '抽題中…' : '開始練習'}
          <ArrowRight size={18} strokeWidth={2.25} />
        </button>
      </main>
    </div>
  )
}

function bookKey(b) {
  return `${b.subject}|${b.grade}|${b.unit || ''}`
}

function keyToBook(key) {
  const [subject, gradeStr, unit] = key.split('|')
  return { subject, grade: parseInt(gradeStr, 10), unit: unit || null }
}

function BookCard({ label, count, mastered, subject, selected, onClick }) {
  const color = subject ? SUBJECTS[subject]?.color : '#C6651E'
  const pct = mastered != null && count > 0 ? Math.round((mastered / count) * 100) : null
  return (
    <button
      onClick={onClick}
      className="rounded-card border bg-card text-left"
      style={{
        padding: '14px 16px',
        borderColor: selected ? color : 'var(--line)',
        background: selected ? color + '10' : 'var(--card)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-block rounded-full"
            style={{ width: 8, height: 8, background: color }}
          />
          <span className="text-[15px] font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-ink-sub font-num">{count} 題</span>
          {selected && <span style={{ color }}>✓</span>}
        </div>
      </div>
      {mastered != null && (
        <>
          <div
            className="rounded-full overflow-hidden mb-1"
            style={{ height: 6, background: 'var(--line-soft)' }}
          >
            <div
              style={{
                width: pct + '%',
                height: '100%',
                background: color,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[12px] text-ink-sub">
            <span>
              精熟{' '}
              <span className="font-semibold font-num" style={{ color }}>
                {mastered}
              </span>{' '}
              / {count} (剩 <span className="font-num">{count - mastered}</span>)
            </span>
            <span className="font-semibold font-num" style={{ color }}>
              {pct}%
            </span>
          </div>
        </>
      )}
    </button>
  )
}
