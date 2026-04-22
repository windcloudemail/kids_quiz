import { useState } from 'react'
import { Upload, FileText, X, Download, CheckCircle2 } from 'lucide-react'
import { parseFile, validateQuestions } from '../lib/fileParser.js'
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
  const [parsed, setParsed] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [result, setResult] = useState(null)
  const [fileName, setFileName] = useState('')

  const handleFile = async (f) => {
    setErr(null)
    setParsed(null)
    setResult(null)
    setFileName(f.name)
    try {
      const { questions } = await parseFile(f)
      if (!questions.length) {
        setErr('檔案中沒有辨識到任何題目')
        return
      }
      const v = validateQuestions(questions)
      setParsed(v)
    } catch (e) {
      setErr('解析失敗: ' + e.message)
    }
  }

  const submit = async () => {
    if (!parsed?.valid?.length) return
    setBusy(true)
    setErr(null)
    try {
      const res = await api.post('/api/teacher/questions/bulk', {
        questions: parsed.valid,
      })
      setResult(res)
    } catch (e) {
      setErr('上傳失敗: ' + e.message)
    } finally {
      setBusy(false)
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

        {!parsed && !result && (
          <>
            <div
              className="rounded-card p-8 flex flex-col items-center gap-3 text-center"
              style={{ border: '2px dashed var(--line)' }}
            >
              <Upload size={32} className="text-ink-sub" />
              <div className="text-[14px] text-ink">
                上傳 .json / .docx / .pdf / 圖片
              </div>
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
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </label>
              <button
                onClick={downloadTemplate}
                className="inline-flex items-center gap-1 text-[13px] text-ink-sub hover:text-ink"
              >
                <Download size={13} />
                下載 JSON 範例
              </button>
              <div className="mt-2 text-[12px] text-ink-sub max-w-md leading-relaxed">
                JSON 陣列最穩。docx 請用表格、pdf 走 pdfjs 抽文字、圖片走 tesseract OCR。
                純文字解析會認以「1. 」「1、」「(1)(2)(3)(4)」或「(A)(B)(C)(D)」為序的題目。
                科目 / 年級可寫在檔名(如「三年級國語.pdf」),否則從欄位或預設值抓。
              </div>
            </div>
            {err && (
              <div className="mt-3 text-[13px]" style={{ color: '#D14343' }}>
                {err}
              </div>
            )}
          </>
        )}

        {parsed && !result && (
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <div className="text-[14px]">
                <span className="text-ink-sub">{fileName}</span> · 解析出{' '}
                <span className="font-semibold">{parsed.valid.length}</span> 題可用
                {parsed.errors.length > 0 && (
                  <span className="text-ink-sub">
                    ,略過{' '}
                    <span style={{ color: '#D14343' }}>{parsed.errors.length}</span> 題
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setParsed(null)
                  setFileName('')
                  setErr(null)
                }}
                className="text-[12px] text-ink-sub hover:text-ink"
              >
                重選
              </button>
            </div>

            {parsed.valid.length > 0 && (
              <div
                className="max-h-56 overflow-y-auto rounded-bubble p-3 text-[13px]"
                style={{ border: '1px solid var(--line)' }}
              >
                {parsed.valid.slice(0, 10).map((q, i) => (
                  <div key={i} className="mb-2 last:mb-0">
                    <span
                      className="font-mono mr-2 text-[11px]"
                      style={{ color: '#666' }}
                    >
                      [{q.subject}·G{q.grade}·{q.answer}]
                    </span>
                    <span className="text-ink">{q.question}</span>
                  </div>
                ))}
                {parsed.valid.length > 10 && (
                  <div className="text-[12px] text-ink-sub mt-2">
                    …還有 {parsed.valid.length - 10} 題
                  </div>
                )}
              </div>
            )}

            {parsed.errors.length > 0 && (
              <details className="mt-3 text-[13px]">
                <summary
                  className="cursor-pointer font-medium"
                  style={{ color: '#D14343' }}
                >
                  {parsed.errors.length} 題無效(展開看原因)
                </summary>
                <div
                  className="mt-2 max-h-40 overflow-y-auto rounded-bubble p-3 text-[12px]"
                  style={{ border: '1px solid var(--line)' }}
                >
                  {parsed.errors.slice(0, 30).map((e, i) => (
                    <div key={i} className="mb-1">
                      <span className="font-semibold" style={{ color: '#D14343' }}>
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
              <div className="mt-3 text-[13px]" style={{ color: '#D14343' }}>
                {err}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-btn font-medium text-ink-sub"
                style={{ padding: '8px 14px', minHeight: 40, fontSize: 13 }}
              >
                取消
              </button>
              <button
                onClick={submit}
                disabled={busy || !parsed.valid.length}
                className="rounded-btn font-medium disabled:opacity-60"
                style={{
                  background: '#1A1A1A',
                  color: '#fff',
                  padding: '8px 14px',
                  minHeight: 40,
                  fontSize: 13,
                }}
              >
                {busy ? '上傳中…' : `確認上傳 ${parsed.valid.length} 題`}
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
                    {result.errors.length} 筆寫入失敗,見下方錯誤清單。
                  </div>
                )}
              </div>
            </div>
            {result.errors?.length > 0 && (
              <div
                className="mb-4 max-h-40 overflow-y-auto rounded-bubble p-3 text-[12px]"
                style={{ border: '1px solid var(--line)' }}
              >
                {result.errors.map((e, i) => (
                  <div key={i}>
                    {e.reason}
                    {typeof e.index === 'number' ? ` (第 ${e.index + 1} 題)` : ''}
                  </div>
                ))}
              </div>
            )}
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
