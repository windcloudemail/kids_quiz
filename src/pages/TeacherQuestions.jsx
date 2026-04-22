import { useEffect, useState } from 'react'
import {
  Plus,
  Upload,
  ChevronDown,
  Search,
  SearchX,
  Users,
  Target,
  Pencil,
  Trash2,
} from 'lucide-react'
import { api } from '../lib/api.js'
import { SUBJECTS, SUBJECT_LIST } from '../lib/subjects.js'
import TeacherShell from '../components/TeacherShell.jsx'
import SubjectTag from '../components/SubjectTag.jsx'
import Stars from '../components/Stars.jsx'
import BulkUploadModal from '../components/BulkUploadModal.jsx'

function accuracyColor(acc) {
  if (acc >= 75) return '#3B8A7C'
  if (acc >= 60) return '#C6651E'
  return '#D14343'
}

const EMPTY_FORM = {
  subject: 'chinese',
  grade: 1,
  unit: '',
  difficulty: 1,
  question: '',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  answer: 'A',
  explanation: '',
}

export default function TeacherQuestions() {
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [teacherId, setTeacherId] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showBulk, setShowBulk] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const r of rows) next.add(r.id)
      return next
    })
  }
  const clearSelection = () => setSelectedIds(new Set())
  const isAllVisibleSelected =
    rows.length > 0 && rows.every((r) => selectedIds.has(r.id))

  const reload = async () => {
    setBusy(true)
    try {
      const qs = new URLSearchParams()
      if (subject) qs.set('subject', subject)
      if (grade) qs.set('grade', grade)
      if (difficulty) qs.set('difficulty', difficulty)
      if (q) qs.set('q', q)
      const d = await api.get(`/api/teacher/questions?${qs.toString()}`)
      setRows(d.questions || [])
      setTeacherId(d.teacher_id)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(reload, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, grade, difficulty, q])

  const onDelete = async (row) => {
    if (!window.confirm(`確定刪除「${row.question.slice(0, 20)}…」?`)) return
    try {
      await api.del(`/api/teacher/questions/${row.id}`)
      setRows(rows.filter((r) => r.id !== row.id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(row.id)
        return next
      })
    } catch (e) {
      alert('刪除失敗:' + e.message)
    }
  }

  const onDeleteSelected = async () => {
    const ids = [...selectedIds]
    if (!ids.length) return
    if (!window.confirm(`確定刪除選中的 ${ids.length} 題?此動作無法復原。`)) return
    try {
      const res = await api.post('/api/teacher/questions/delete-bulk', { ids })
      clearSelection()
      await reload()
      if (res.skipped > 0) {
        alert(`已刪 ${res.deleted} 題,其中 ${res.skipped} 題不是你的題目,已略過`)
      }
    } catch (e) {
      alert('批量刪除失敗:' + e.message)
    }
  }

  return (
    <TeacherShell>
      <div className="mx-auto max-w-teacher px-8 py-7">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-[12px] text-ink-sub">題庫</div>
            <h1 className="font-semibold mt-1" style={{ fontSize: 26 }}>
              我的題目
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBulk(true)}
              className="inline-flex items-center gap-2 rounded-bubble font-medium bg-card border border-line"
              style={{
                fontSize: 14,
                padding: '10px 14px',
                minHeight: 40,
                color: '#1A1A1A',
              }}
            >
              <Upload size={15} strokeWidth={2} />
              批量上傳
            </button>
            <button
              onClick={() => setEditing({ mode: 'add', data: EMPTY_FORM })}
              className="inline-flex items-center gap-2 rounded-bubble font-medium"
              style={{
                background: '#1A1A1A',
                color: '#fff',
                fontSize: 14,
                padding: '10px 16px',
                minHeight: 40,
              }}
            >
              <Plus size={16} strokeWidth={2.25} />
              新增題目
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-card rounded-card border border-line shadow-card p-3 mb-5 flex items-center flex-wrap gap-2">
          <FilterSelect
            value={subject}
            onChange={setSubject}
            options={[
              { v: '', l: '全部科目' },
              ...SUBJECT_LIST.map((s) => ({ v: s, l: SUBJECTS[s].name })),
            ]}
          />
          <FilterSelect
            value={grade}
            onChange={setGrade}
            options={[
              { v: '', l: '全部年級' },
              ...[1, 2, 3, 4, 5, 6].map((n) => ({ v: String(n), l: `${n} 年級` })),
            ]}
          />
          <FilterSelect
            value={difficulty}
            onChange={setDifficulty}
            options={[
              { v: '', l: '全部難度' },
              ...[1, 2, 3, 4, 5].map((n) => ({ v: String(n), l: '★'.repeat(n) })),
            ]}
          />
          <div style={{ width: 1, height: 24, background: 'var(--line)' }} />
          <div
            className="flex-1 min-w-[200px] flex items-center gap-2 rounded-bubble px-3"
            style={{
              background: 'var(--page)',
              border: '1px solid transparent',
              minHeight: 36,
            }}
          >
            <Search size={14} className="text-ink-sub" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜尋題目…"
              className="flex-1 bg-transparent outline-none text-[13px]"
            />
          </div>
          <span className="text-[12px] text-ink-sub font-num pr-2">
            共 <span className="text-ink font-medium">{rows.length}</span> 題
          </span>
        </div>

        {rows.length > 0 && (
          <div
            className="mb-4 rounded-bubble p-3 flex items-center gap-3 flex-wrap"
            style={{
              background: selectedIds.size > 0 ? 'var(--warn-bg)' : 'var(--page)',
              border: '1px solid var(--line)',
            }}
          >
            <label className="inline-flex items-center gap-2 text-[13px] cursor-pointer">
              <input
                type="checkbox"
                checked={isAllVisibleSelected}
                onChange={(e) =>
                  e.target.checked ? selectAllVisible() : clearSelection()
                }
                style={{ width: 16, height: 16 }}
              />
              全選本頁({rows.length} 題)
            </label>
            {selectedIds.size > 0 && (
              <>
                <span className="text-[13px] text-ink-sub">
                  已選{' '}
                  <span
                    className="font-semibold font-num"
                    style={{ color: '#C6651E' }}
                  >
                    {selectedIds.size}
                  </span>{' '}
                  題
                </span>
                <button
                  onClick={clearSelection}
                  className="text-[12px] text-ink-sub hover:text-ink underline"
                >
                  取消選取
                </button>
                <div className="flex-1" />
                <button
                  onClick={onDeleteSelected}
                  className="inline-flex items-center gap-1.5 rounded-bubble font-medium"
                  style={{
                    background: '#D14343',
                    color: '#fff',
                    fontSize: 13,
                    padding: '8px 14px',
                    minHeight: 36,
                  }}
                >
                  <Trash2 size={14} />
                  刪除選中 {selectedIds.size} 題
                </button>
              </>
            )}
          </div>
        )}

        {err && (
          <div className="mb-4 text-[13px]" style={{ color: '#D14343' }}>
            {err}
          </div>
        )}

        {!rows.length && !busy ? (
          <div className="bg-card rounded-card border border-line shadow-card p-10 flex flex-col items-center gap-3 text-ink-sub">
            <SearchX size={28} />
            <div className="text-[14px]">沒有符合條件的題目</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((r) => (
              <QuestionRow
                key={r.id}
                row={r}
                canEdit={r.owner_teacher_id === teacherId}
                selected={selectedIds.has(r.id)}
                onToggleSelect={() => toggleSelect(r.id)}
                onEdit={() => setEditing({ mode: 'edit', data: r })}
                onDelete={() => onDelete(r)}
              />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <QuestionModal
          mode={editing.mode}
          initial={editing.data}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}

      {showBulk && (
        <BulkUploadModal
          onClose={() => setShowBulk(false)}
          onSaved={() => {
            setShowBulk(false)
            reload()
          }}
        />
      )}
    </TeacherShell>
  )
}

function FilterSelect({ value, onChange, options }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-chip font-medium pr-8 cursor-pointer"
        style={{
          background: 'var(--page)',
          border: '1px solid transparent',
          minHeight: 36,
          fontSize: 13,
          padding: '8px 32px 8px 12px',
          color: 'var(--ink)',
        }}
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-ink-sub"
      />
    </div>
  )
}

function QuestionRow({ row, canEdit, onEdit, onDelete, selected, onToggleSelect }) {
  return (
    <div
      className="bg-card rounded-card border border-line shadow-card p-4 flex items-start gap-4"
      style={{
        transition: 'border-color 0.15s ease',
        borderColor: selected ? '#C6651E' : undefined,
        background: selected ? 'var(--warn-bg)' : undefined,
      }}
    >
      <input
        type="checkbox"
        checked={!!selected}
        onChange={onToggleSelect}
        className="mt-1 shrink-0 cursor-pointer"
        style={{ width: 18, height: 18 }}
        aria-label="選取此題"
      />
      {row.image_url && (
        <a
          href={row.image_url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-bubble overflow-hidden"
          style={{
            width: 80,
            height: 80,
            border: '1px solid var(--line)',
            background: '#FAFAF8',
          }}
        >
          <img
            src={row.image_url}
            alt="題目預覽"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        </a>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-2 mb-2.5">
          {row.source_number ? (
            <span
              className="rounded-chip font-semibold font-num"
              style={{
                background: '#1A1A1A',
                color: '#fff',
                fontSize: 11,
                padding: '2px 8px',
              }}
            >
              第 {row.source_number} 題
            </span>
          ) : null}
          <SubjectTag subject={row.subject} size="sm" />
          <Chip>{row.grade} 年級</Chip>
          {row.unit && <Chip>{row.unit}</Chip>}
          <Stars value={row.difficulty} max={5} size={11} />
        </div>
        <div className="text-[14px]" style={{ lineHeight: 1.55 }}>
          {row.image_url ? (
            <span className="text-ink-sub text-[12px] italic">
              題幹以圖像呈現(右側縮圖,點擊看原圖)
            </span>
          ) : (
            row.question
          )}
        </div>
        <div className="mt-2.5 flex items-center gap-4 text-[13px] text-ink-sub">
          <span className="inline-flex items-center gap-1">
            <Users size={13} strokeWidth={2} />
            被使用 <span className="font-num">{row.used_count}</span> 次
          </span>
          <span className="inline-flex items-center gap-1">
            <Target size={13} strokeWidth={2} />
            正確率{' '}
            <span
              className="font-num font-medium"
              style={{ color: accuracyColor(row.accuracy || 0) }}
            >
              {row.accuracy || 0}%
            </span>
          </span>
        </div>
      </div>
      {canEdit && (
        <div className="flex items-center gap-1 shrink-0">
          <IconBtn icon={Pencil} label="編輯" onClick={onEdit} />
          <IconBtn icon={Trash2} label="刪除" onClick={onDelete} danger />
        </div>
      )}
    </div>
  )
}

function Chip({ children }) {
  return (
    <span
      className="rounded-chip font-medium"
      style={{
        background: '#F3F1EB',
        color: '#1A1A1A',
        fontSize: 11,
        padding: '2px 8px',
      }}
    >
      {children}
    </span>
  )
}

function IconBtn({ icon: IconCmp, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="inline-flex items-center justify-center rounded-chip"
      style={{
        width: 36,
        height: 36,
        color: danger ? '#D14343' : '#666',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = danger ? '#FBEBEB' : 'rgba(0,0,0,0.05)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <IconCmp size={16} strokeWidth={2} />
    </button>
  )
}

function QuestionModal({ mode, initial, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    subject: initial.subject || 'chinese',
    grade: initial.grade || 1,
    unit: initial.unit || '',
    difficulty: initial.difficulty || 1,
    question: initial.question || '',
    option_a: initial.option_a || '',
    option_b: initial.option_b || '',
    option_c: initial.option_c || '',
    option_d: initial.option_d || '',
    answer: initial.answer || 'A',
    explanation: initial.explanation || '',
  }))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const isEdit = mode === 'edit'

  const save = async (e) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      if (isEdit) {
        await api.patch(`/api/teacher/questions/${initial.id}`, form)
      } else {
        await api.post('/api/teacher/questions', form)
      }
      onSaved()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const set = (k) => (e) =>
    setForm({ ...form, [k]: e.target.type === 'number' ? +e.target.value : e.target.value })

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center p-5 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
        className="bg-card rounded-card p-6 w-full max-w-xl shadow-card my-8"
      >
        <div className="text-[17px] font-semibold mb-4">
          {isEdit ? '編輯題目' : '新增題目'}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="科目">
            <select
              value={form.subject}
              onChange={set('subject')}
              className="w-full rounded-btn border border-line bg-page px-3 py-2 text-[14px] outline-none focus:border-ink focus:bg-card"
            >
              {SUBJECT_LIST.map((s) => (
                <option key={s} value={s}>
                  {SUBJECTS[s].name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="年級">
            <select
              value={form.grade}
              onChange={set('grade')}
              className="w-full rounded-btn border border-line bg-page px-3 py-2 text-[14px] outline-none focus:border-ink focus:bg-card"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} 年級
                </option>
              ))}
            </select>
          </Field>
          <Field label="難度">
            <select
              value={form.difficulty}
              onChange={set('difficulty')}
              className="w-full rounded-btn border border-line bg-page px-3 py-2 text-[14px] outline-none focus:border-ink focus:bg-card"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {'★'.repeat(n)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="單元(可空)">
          <input
            value={form.unit}
            onChange={set('unit')}
            className="w-full rounded-btn border border-line bg-page px-3 py-2 text-[14px] outline-none focus:border-ink focus:bg-card"
            placeholder="例:字詞辨識"
          />
        </Field>

        <Field label="題目">
          <textarea
            required
            rows={2}
            value={form.question}
            onChange={set('question')}
            className="w-full rounded-btn border border-line bg-page px-3 py-2 text-[14px] outline-none focus:border-ink focus:bg-card"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          {['A', 'B', 'C', 'D'].map((L) => (
            <Field key={L} label={`選項 ${L}`}>
              <input
                required
                value={form[`option_${L.toLowerCase()}`]}
                onChange={set(`option_${L.toLowerCase()}`)}
                className="w-full rounded-btn border border-line bg-page px-3 py-2 text-[14px] outline-none focus:border-ink focus:bg-card"
              />
            </Field>
          ))}
        </div>

        <Field label="正解">
          <select
            value={form.answer}
            onChange={set('answer')}
            className="w-full rounded-btn border border-line bg-page px-3 py-2 text-[14px] outline-none focus:border-ink focus:bg-card"
          >
            {['A', 'B', 'C', 'D'].map((L) => (
              <option key={L} value={L}>
                {L}
              </option>
            ))}
          </select>
        </Field>

        <Field label="解析(可空)">
          <textarea
            rows={2}
            value={form.explanation}
            onChange={set('explanation')}
            className="w-full rounded-btn border border-line bg-page px-3 py-2 text-[14px] outline-none focus:border-ink focus:bg-card"
          />
        </Field>

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
            {busy ? '儲存中…' : '儲存'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="mt-3">
      <label className="block text-[13px] font-medium text-ink-sub mb-1">{label}</label>
      {children}
    </div>
  )
}
