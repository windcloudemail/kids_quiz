import { useEffect, useState } from 'react'
import {
  Users,
  Activity,
  FileCheck2,
  Target,
  AlertCircle,
  Copy,
  Check,
  Filter,
  Download,
  ChevronRight,
  UserPlus,
} from 'lucide-react'
import { api } from '../lib/api.js'
import TeacherShell from '../components/TeacherShell.jsx'
import Avatar from '../components/Avatar.jsx'
import BarMini from '../components/BarMini.jsx'
import Sparkline from '../components/Sparkline.jsx'

function formatLast(iso) {
  if (!iso) return '—'
  const now = new Date()
  const dt = new Date(iso)
  const diff = (now - dt) / 1000
  if (diff < 60) return '剛剛'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`
  const sameDay = now.toDateString() === dt.toDateString()
  if (sameDay)
    return `今天 ${String(dt.getHours()).padStart(2, '0')}:${String(
      dt.getMinutes()
    ).padStart(2, '0')}`
  const yest = new Date(now.getTime() - 86400000).toDateString() === dt.toDateString()
  if (yest)
    return `昨天 ${String(dt.getHours()).padStart(2, '0')}:${String(
      dt.getMinutes()
    ).padStart(2, '0')}`
  const days = Math.floor(diff / 86400)
  return `${days} 天前`
}

function accuracyColor(acc) {
  if (acc >= 75) return '#3B8A7C'
  if (acc >= 60) return '#C6651E'
  return '#D14343'
}

export default function TeacherDashboard() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [copied, setCopied] = useState(false)
  const [showAddStudent, setShowAddStudent] = useState(false)

  const reload = () =>
    api
      .get('/api/teacher/overview')
      .then(setData)
      .catch((e) => setErr(e.message))

  useEffect(() => {
    reload()
  }, [])

  const onCopy = async () => {
    if (!data?.class?.invite_code) return
    try {
      await navigator.clipboard.writeText(data.class.invite_code)
    } catch {
      /* ignore */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (err)
    return (
      <TeacherShell>
        <div className="p-8 text-[14px]" style={{ color: 'var(--subject-chinese)' }}>
          載入失敗:{err}
        </div>
      </TeacherShell>
    )
  if (!data)
    return (
      <TeacherShell>
        <div className="p-8 text-[14px] text-ink-sub">載入中…</div>
      </TeacherShell>
    )

  if (!data.hasClass) {
    return (
      <TeacherShell>
        <div className="mx-auto max-w-teacher px-8 py-7">
          <h1 className="text-[20px] font-semibold">尚未建立班級</h1>
          <p className="mt-2 text-[14px] text-ink-sub">
            請先在設定頁建立一個班級(此功能尚未實作)。
          </p>
        </div>
      </TeacherShell>
    )
  }

  const { class: cls, stats, weekTrend, students } = data

  return (
    <TeacherShell>
      <div className="mx-auto max-w-teacher px-8 py-7">
        {/* Title row */}
        <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-[12px] text-ink-sub">班級</div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="font-semibold" style={{ fontSize: 26, lineHeight: 1.2 }}>
                {cls.name}
              </h1>
              <span
                className="inline-flex items-center gap-1 rounded-chip font-medium font-num"
                style={{
                  background: '#F3F1EB',
                  color: '#1A1A1A',
                  fontSize: 12,
                  padding: '3px 8px',
                }}
              >
                <Users size={12} strokeWidth={2.25} />
                {stats.totalStudents} 學生
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddStudent(true)}
              className="inline-flex items-center gap-2 rounded-btn font-medium"
              style={{
                background: '#1A1A1A',
                color: '#fff',
                fontSize: 13,
                padding: '8px 14px',
                minHeight: 40,
              }}
            >
              <UserPlus size={14} strokeWidth={2.25} />
              新增學生
            </button>
            <div
              className="bg-card border border-line flex items-center gap-3"
              style={{ borderRadius: 12, padding: '10px 14px' }}
            >
              <div>
                <div className="text-[11px] text-ink-sub leading-none">班級邀請碼</div>
                <div
                  className="font-semibold font-num mt-0.5"
                  style={{ fontSize: 17, letterSpacing: '0.02em' }}
                >
                  {cls.invite_code}
                </div>
              </div>
              <button
                onClick={onCopy}
                className="inline-flex items-center gap-1.5 rounded-bubble font-medium"
                style={{
                  background: copied ? 'var(--subject-english-bg)' : '#F3F1EB',
                  color: copied ? '#3B8A7C' : '#1A1A1A',
                  fontSize: 13,
                  padding: '8px 12px',
                  minHeight: 36,
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? '已複製' : '複製'}
              </button>
            </div>
          </div>
        </div>

        {/* Stat grid */}
        <div
          className="grid gap-4 mb-6"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
        >
          <StatCard
            icon={Activity}
            label="本週活躍學生"
            value={stats.activeStudents}
            unit={`/ ${stats.totalStudents}`}
            accent="#3B6EA8"
          />
          <StatCard
            icon={FileCheck2}
            label="本週總做題數"
            value={stats.weekQuestions.toLocaleString()}
            unit="題"
            accent="#1A1A1A"
            right={<BarMini data={weekTrend} width={80} height={28} color="#1A1A1A" />}
          />
          <StatCard
            icon={Target}
            label="平均正確率"
            value={stats.avgAccuracy}
            unit="%"
            accent={accuracyColor(stats.avgAccuracy)}
          />
          <StatCard
            icon={AlertCircle}
            label="需關注學生"
            value={stats.needAttention}
            unit="位"
            accent="#D14343"
          />
        </div>

        {/* Student list */}
        <div className="bg-card rounded-card border border-line shadow-card overflow-hidden">
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--line)' }}
          >
            <div>
              <div className="text-[15px] font-semibold">學生列表</div>
              <div className="text-[12px] text-ink-sub mt-0.5">
                共 {students.length} 位
              </div>
            </div>
            <div className="flex items-center gap-2">
              <IconBtn icon={Filter} label="篩選" />
              <IconBtn icon={Download} label="匯出" />
            </div>
          </div>

          <div>
            <div
              className="grid px-5 py-2.5 text-[12px] font-medium text-ink-sub"
              style={{
                gridTemplateColumns: '2fr 1.3fr 1fr 1fr 1.3fr 0.5fr',
                background: '#FCFBF7',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div>學生</div>
              <div>最近活動</div>
              <div style={{ textAlign: 'right' }}>本週題數</div>
              <div>正確率</div>
              <div>趨勢</div>
              <div></div>
            </div>
            {students.map((s, i) => (
              <div
                key={s.id}
                className="grid px-5 py-3 text-[14px] hover:bg-[rgba(0,0,0,0.02)]"
                style={{
                  gridTemplateColumns: '2fr 1.3fr 1fr 1fr 1.3fr 0.5fr',
                  borderTop: i === 0 ? 'none' : '1px solid var(--line-soft)',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={s.display_name} size={34} />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.display_name}</div>
                    {s.status === 'warn' && (
                      <div
                        className="mt-0.5 inline-flex items-center gap-1 text-[11px]"
                        style={{ color: '#D14343' }}
                      >
                        <AlertCircle size={11} />
                        需關注
                      </div>
                    )}
                  </div>
                </div>
                <div
                  className="text-[13px]"
                  style={{ color: s.status === 'warn' ? '#D14343' : '#666' }}
                >
                  {formatLast(s.last_active)}
                </div>
                <div className="font-num" style={{ textAlign: 'right' }}>
                  {s.week_q}
                </div>
                <div className="font-num font-medium" style={{ color: accuracyColor(s.accuracy) }}>
                  {s.accuracy}%
                </div>
                <div>
                  <Sparkline
                    data={s.trend.length ? s.trend : [0, 0, 0, 0, 0, 0, 0]}
                    width={100}
                    height={28}
                    color={accuracyColor(s.accuracy)}
                    fill={false}
                    dot={false}
                  />
                </div>
                <button
                  disabled
                  aria-label="查看詳細"
                  className="inline-flex items-center justify-center rounded-bubble text-ink-sub cursor-not-allowed"
                  style={{ width: 32, height: 32 }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            ))}
            {!students.length && (
              <div className="px-5 py-8 text-[13px] text-ink-sub text-center">
                還沒有學生。用上方「新增學生」按鈕建立帳號。
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddStudent && (
        <AddStudentModal
          classId={cls.id}
          onClose={() => setShowAddStudent(false)}
          onSaved={() => {
            setShowAddStudent(false)
            reload()
          }}
        />
      )}
    </TeacherShell>
  )
}

function StatCard({ icon: IconCmp, label, value, unit, accent, right }) {
  return (
    <div className="bg-card rounded-card border border-line shadow-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-flex items-center justify-center"
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: accent + '1a',
            color: accent,
          }}
        >
          <IconCmp size={14} strokeWidth={2.25} />
        </span>
        <span className="text-[12px] text-ink-sub">{label}</span>
      </div>
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1">
          <span className="font-semibold font-num" style={{ fontSize: 30 }}>
            {value}
          </span>
          {unit && <span className="text-[13px] text-ink-sub">{unit}</span>}
        </div>
        {right}
      </div>
    </div>
  )
}

function IconBtn({ icon: IconCmp, label }) {
  return (
    <button
      disabled
      className="inline-flex items-center gap-1.5 bg-card border border-line rounded-bubble font-medium text-ink-sub cursor-not-allowed"
      style={{ fontSize: 13, padding: '8px 12px', minHeight: 40 }}
    >
      <IconCmp size={14} />
      {label}
    </button>
  )
}

function AddStudentModal({ classId, onClose, onSaved }) {
  const [form, setForm] = useState({
    username: '',
    display_name: '',
    password: '1234',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const save = async (e) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      await api.post('/api/teacher/students', {
        ...form,
        class_id: classId,
      })
      onSaved()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center p-5"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
        className="bg-card rounded-card p-6 w-full max-w-sm shadow-card"
      >
        <div className="text-[17px] font-semibold mb-4">新增學生</div>

        <label className="block text-[13px] font-medium text-ink-sub mb-1">帳號 username</label>
        <input
          required
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          className="w-full rounded-btn border border-line bg-page px-3 py-2 text-[14px] outline-none focus:border-ink focus:bg-card"
          placeholder="例:wang01"
        />

        <label className="block text-[13px] font-medium text-ink-sub mb-1 mt-3">
          顯示名稱
        </label>
        <input
          required
          value={form.display_name}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          className="w-full rounded-btn border border-line bg-page px-3 py-2 text-[14px] outline-none focus:border-ink focus:bg-card"
          placeholder="例:王小明"
        />

        <label className="block text-[13px] font-medium text-ink-sub mb-1 mt-3">
          初始密碼(至少 4 碼)
        </label>
        <input
          required
          minLength={4}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="w-full rounded-btn border border-line bg-page px-3 py-2 text-[14px] outline-none focus:border-ink focus:bg-card"
        />

        {err && (
          <div className="mt-3 text-[13px]" style={{ color: '#D14343' }}>
            {err}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-btn font-medium text-ink-sub"
            style={{ padding: '8px 14px', minHeight: 40, fontSize: 13 }}
          >
            取消
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-btn font-medium disabled:opacity-60"
            style={{
              background: '#1A1A1A',
              color: '#fff',
              padding: '8px 14px',
              minHeight: 40,
              fontSize: 13,
            }}
          >
            {busy ? '建立中…' : '建立帳號'}
          </button>
        </div>
      </form>
    </div>
  )
}
