import { useState } from 'react'
import {
  Upload,
  FileText,
  X,
  Download,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react'
import { parseFile, parseAnswerFile, mergeAnswers, validateQuestions } from '../lib/fileParser.js'
import { SUBJECTS, SUBJECT_LIST } from '../lib/subjects.js'
import { api } from '../lib/api.js'

const TEMPLATE = [
  {
    subject: 'chinese',
    grade: 3,
    unit: '字詞辨識',
    difficulty: 2,
    question: '「恍然大悟」的意思最接近下列何者?',
    option_a: '忽然明白',
    option_b: '大聲唱歌',
    option_c: '想得很深',
    option_d: '完全忘記',
    answer: 'A',
    explanation: '「恍然大悟」指忽然明白、徹底了解某件事。',
  },
  {
    subject: 'math',
    grade: 3,
    unit: '分數',
    difficulty: 2,
    question: '小明把一塊蛋糕平均分成 8 份,他吃了 3 份,佔整塊蛋糕的幾分之幾?',
    option_a: '1/3',
    option_b: '3/8',
    option_c: '5/8',
    option_d: '3/5',
    answer: 'B',
    explanation: '吃掉 3 份佔 8 份中的 3 份,分數為 3/8。',
  },
]

export default function BulkUploadModal({ onClose, onSaved }) {
  const [questions, setQuestions] = useState(null) // parsed + merged array
  const [errors, setErrors] = useState([]) // validation errors
  const [questionFileName, setQuestionFileName] = useState('')
  const [answerFileName, setAnswerFileName] = useState('')
  const [answerHit, setAnswerHit] = useState(0)
  const [defaults, setDefaults] = useState({ subject: '', grade: 0 })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [result, setResult] = useState(null)
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 })

  const revalidate = (list, d = defaults) => {
    const withDefaults = list.map((q) => ({
      ...q,
      subject: q.subject || d.subject,
      grade: q.grade || d.grade,
    }))
    const v = validateQuestions(withDefaults)
    setQuestions(withDefaults)
    setErrors(v.errors)
    return v
  }

  const handleQuestionFile = async (f) => {
    setErr(null)
    setResult(null)
    setQuestionFileName(f.name)
    setAnswerFileName('')
    setAnswerHit(0)
    try {
      const { questions: raw } = await parseFile(f)
      if (!raw.length) {
        setErr('檔案中沒有辨識到任何題目')
        setQuestions(null)
        return
      }
      revalidate(raw)
    } catch (e) {
      setErr('解析失敗: ' + e.message)
      setQuestions(null)
    }
  }

  const handleAnswerFile = async (f) => {
    if (!questions) return
    setErr(null)
    setAnswerFileName(f.name)
    try {
      const map = await parseAnswerFile(f)
      const { merged, hit } = mergeAnswers(questions, map)
      setAnswerHit(hit)
      revalidate(merged)
    } catch (e) {
      setErr('答案檔解析失敗: ' + e.message)
    }
  }

  const updateDefault = (field, value) => {
    const d = { ...defaults, [field]: value }
    setDefaults(d)
    if (questions) revalidate(questions, d)
  }

  const submit = async () => {
    const v = validateQuestions(questions || [])
    if (!v.valid.length) return
    setBusy(true)
    setErr(null)
    try {
      // Step 1: upload every image_data_url to R2 and replace with image_url.
      const withImages = v.valid.filter((q) => q.image_data_url).length
      setUploadProgress({ done: 0, total: withImages })
      const prepared = []
      let done = 0
      for (const q of v.valid) {
        if (q.image_data_url) {
          const comma = q.image_data_url.indexOf(',')
          const header = q.image_data_url.slice(0, comma)
          const b64 = q.image_data_url.slice(comma + 1)
          const ct = (header.match(/data:(.*?);/) || [])[1] || 'image/jpeg'
          const ext = (ct.split('/')[1] || 'jpg').split(';')[0]
          const res = await api.post('/api/teacher/images', {
            filename: `q${q.source_number ?? done + 1}.${ext}`,
            content_type: ct,
            data: b64,
          })
          done++
          setUploadProgress({ done, total: withImages })
          prepared.push({ ...q, image_url: res.url, image_data_url: undefined })
        } else {
          prepared.push(q)
        }
      }
      // Step 2: bulk insert with image_url set.
      const res = await api.post('/api/teacher/questions/bulk', {
        questions: prepared.map(({ image_data_url, ...rest }) => rest),
      })
      setResult(res)
    } catch (e) {
      setErr('上傳失敗: ' + e.message)
    } finally {
      setBusy(false)
      setUploadProgress({ done: 0, total: 0 })
    }
  }

  const downloadTemplate = () => {
    const blob = new Blob([JSON.stringify(TEMPLATE, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'kids_quiz_template.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const validCount = questions ? questions.filter((_, i) => !errors.find(e => e.index === i)).length : 0
  const needsAnswer = questions && questions.some((q) => !q.answer)
  const needsSubject = questions && questions.some((q) => !q.subject)
  const needsGrade = questions && questions.some((q) => !q.grade)

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center p-5"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-card rounded-card p-6 w-full max-w-2xl shadow-card max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-[17px] font-semibold">批量上傳題目</div>
          <button
            onClick={onClose}
            className="rounded-bubble p-1 hover:bg-neutral-chip"
            aria-label="關閉"
          >
            <X size={18} />
          </button>
        </div>

        {!questions && !result && (
          <div
            className="rounded-card p-8 flex flex-col items-center gap-3 text-center"
            style={{ border: '2px dashed var(--line)' }}
          >
            <Upload size={32} className="text-ink-sub" />
            <div className="text-[14px] text-ink">選擇題目檔</div>
            <label
              className="inline-flex items-center gap-2 rounded-bubble px-4 py-2 cursor-pointer text-[14px] font-medium"
              style={{ background: '#1A1A1A', color: '#fff' }}
            >
              <FileText size={14} />
              選取檔案
              <input
                type="file"
                accept=".docx,.json,.pdf,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleQuestionFile(e.target.files[0])}
              />
            </label>
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1 text-[12px] text-ink-sub hover:text-ink"
            >
              <Download size={12} />
              下載 JSON 範例
            </button>
            {err && (
              <div className="mt-2 text-[13px]" style={{ color: '#D14343' }}>
                {err}
              </div>
            )}
          </div>
        )}

        {questions && !result && (
          <div className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <div className="text-[14px]">
                <span className="text-ink-sub">{questionFileName}</span> · 抓到{' '}
                <span className="font-semibold">{questions.length}</span> 題
                {validCount !== questions.length && (
                  <span className="text-ink-sub">
                    (
                    <span style={{ color: '#3B8A7C' }}>{validCount} 可用</span>
                    {' / '}
                    <span style={{ color: '#D14343' }}>
                      {questions.length - validCount} 待修
                    </span>
                    )
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setQuestions(null)
                  setQuestionFileName('')
                  setAnswerFileName('')
                  setAnswerHit(0)
                  setErrors([])
                  setErr(null)
                }}
                className="text-[12px] text-ink-sub hover:text-ink"
              >
                重選
              </button>
            </div>

            {/* Inline defaults for subject / grade when missing */}
            {(needsSubject || needsGrade) && (
              <div
                className="rounded-bubble p-3 flex items-center gap-3 flex-wrap"
                style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}
              >
                <span className="text-[13px] font-medium">補上:</span>
                {needsSubject && (
                  <label className="inline-flex items-center gap-1 text-[13px]">
                    科目
                    <select
                      value={defaults.subject}
                      onChange={(e) => updateDefault('subject', e.target.value)}
                      className="rounded-chip bg-card text-ink px-2 py-1 text-[13px] border border-line"
                    >
                      <option value="">—</option>
                      {SUBJECT_LIST.map((s) => (
                        <option key={s} value={s}>
                          {SUBJECTS[s].name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {needsGrade && (
                  <label className="inline-flex items-center gap-1 text-[13px]">
                    年級
                    <select
                      value={defaults.grade || ''}
                      onChange={(e) =>
                        updateDefault('grade', parseInt(e.target.value, 10) || 0)
                      }
                      className="rounded-chip bg-card text-ink px-2 py-1 text-[13px] border border-line"
                    >
                      <option value="">—</option>
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n} 年級
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}

            {/* Answer sheet slot — only show if any question lacks answer */}
            {needsAnswer && (
              <div
                className="rounded-bubble p-3 flex items-center gap-3 flex-wrap"
                style={{
                  background: answerHit > 0 ? 'var(--subject-english-bg)' : 'var(--subject-chinese-bg)',
                  border: `1px solid ${answerHit > 0 ? '#3B8A7C' : '#D14343'}`,
                }}
              >
                <ClipboardList size={16} style={{ color: answerHit > 0 ? '#3B8A7C' : '#D14343' }} />
                <div className="flex-1 text-[13px]">
                  {answerHit > 0 ? (
                    <span style={{ color: '#3B8A7C' }}>
                      已從「{answerFileName}」比對到 {answerHit} 題答案
                    </span>
                  ) : (
                    <span style={{ color: '#D14343' }}>
                      題目缺答案。請上傳答案檔(xlsx / json / csv,格式見下方範例)
                    </span>
                  )}
                </div>
                <label
                  className="inline-flex items-center gap-1 rounded-bubble px-3 py-1.5 cursor-pointer text-[13px] font-medium bg-card border border-line"
                >
                  <Upload size={13} />
                  {answerFileName ? '重選答案檔' : '選取答案檔'}
                  <input
                    type="file"
                    accept=".xlsx,.xls,.json,.csv,application/json,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleAnswerFile(e.target.files[0])}
                  />
                </label>
              </div>
            )}

            {/* Question preview */}
            <div
              className="rounded-bubble p-3 text-[13px] max-h-56 overflow-y-auto"
              style={{ border: '1px solid var(--line)' }}
            >
              {questions.slice(0, 15).map((q, i) => {
                const hasErr = errors.find((e) => e.index === i)
                return (
                  <div key={i} className="mb-1.5 last:mb-0 flex gap-2">
                    <span
                      className="font-mono text-[11px] shrink-0"
                      style={{ color: hasErr ? '#D14343' : '#3B8A7C', minWidth: 60 }}
                    >
                      [{q.subject || '?'}·G{q.grade || '?'}·{q.answer || '?'}]
                    </span>
                    <span className="text-ink flex-1 truncate">{q.question}</span>
                  </div>
                )
              })}
              {questions.length > 15 && (
                <div className="text-[12px] text-ink-sub mt-2">
                  …還有 {questions.length - 15} 題
                </div>
              )}
            </div>

            {errors.length > 0 && (
              <details className="text-[13px]">
                <summary
                  className="cursor-pointer font-medium"
                  style={{ color: '#D14343' }}
                >
                  {errors.length} 題需修正(展開看原因)
                </summary>
                <div
                  className="mt-2 max-h-32 overflow-y-auto rounded-bubble p-3 text-[12px]"
                  style={{ border: '1px solid var(--line)' }}
                >
                  {errors.slice(0, 30).map((e, i) => (
                    <div key={i}>
                      <span
                        className="font-semibold"
                        style={{ color: '#D14343' }}
                      >
                        第 {e.index + 1} 題
                      </span>
                      <span className="text-ink-sub">
                        : {e.reasons.join('、')}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {err && (
              <div className="text-[13px]" style={{ color: '#D14343' }}>
                {err}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-btn font-medium text-ink-sub"
                style={{ padding: '8px 14px', minHeight: 40, fontSize: 13 }}
              >
                取消
              </button>
              <button
                onClick={submit}
                disabled={busy || validCount === 0}
                className="rounded-btn font-medium disabled:opacity-60"
                style={{
                  background: '#1A1A1A',
                  color: '#fff',
                  padding: '8px 14px',
                  minHeight: 40,
                  fontSize: 13,
                }}
              >
                {busy
                  ? uploadProgress.total > 0
                    ? `上傳圖片 ${uploadProgress.done}/${uploadProgress.total}…`
                    : '寫入中…'
                  : `確認上傳 ${validCount} 題`}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div>
            <div
              className="rounded-card p-5 mb-4 flex items-start gap-3"
              style={{
                background: 'var(--subject-english-bg)',
                border: '1px solid #3B8A7C',
              }}
            >
              <CheckCircle2 size={22} style={{ color: '#3B8A7C' }} />
              <div>
                <div
                  className="text-[16px] font-semibold"
                  style={{ color: '#3B8A7C' }}
                >
                  成功建立 {result.inserted} / {result.total} 題
                </div>
                {result.errors?.length > 0 && (
                  <div
                    className="mt-1 text-[13px]"
                    style={{ color: '#D14343' }}
                  >
                    {result.errors.length} 筆寫入失敗
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end">
              <button
                onClick={onSaved}
                className="rounded-btn font-medium"
                style={{
                  background: '#1A1A1A',
                  color: '#fff',
                  padding: '8px 14px',
                  minHeight: 40,
                  fontSize: 13,
                }}
              >
                關閉並重整
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
