import { useEffect, useRef, useState } from 'react'
import {
  useParams,
  useNavigate,
  useSearchParams,
  useLocation,
} from 'react-router-dom'
import { X, Check, CheckCircle2, XCircle, ArrowRight } from 'lucide-react'
import { api } from '../lib/api.js'
import { SUBJECTS } from '../lib/subjects.js'
import SubjectTag from '../components/SubjectTag.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import RubyText from '../components/RubyText.jsx'

// Client-side option shuffle used when the Quiz is driven by pre-loaded
// questions from navigation state (e.g. "練錯題" after Result). The server
// already shuffles for the normal fetch path; this keeps state-driven runs
// consistent without a round-trip.
function shuffleOptionsClient(q) {
  const letters = ['A', 'B', 'C', 'D']
  const perm = [...letters]
  for (let i = perm.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }
  const byLabel = Object.fromEntries((q.options || []).map((o) => [o.label, o.text]))
  const options = perm.map((origLetter, i) => ({
    label: letters[i],
    text: byLabel[origLetter],
  }))
  const answer = letters[perm.indexOf(q.answer)]
  return { ...q, options, answer }
}

export default function Quiz() {
  const { subject } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const stateQuestions = location.state?.questions
  const stateShuffle = location.state?.shuffle
  const [data, setData] = useState(() => {
    if (!stateQuestions?.length) return null
    const qs = stateShuffle
      ? stateQuestions.map(shuffleOptionsClient)
      : stateQuestions
    return { questions: qs }
  })
  const [err, setErr] = useState(null)
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [attempts, setAttempts] = useState([])
  const [zoomedImg, setZoomedImg] = useState(null)
  const startTimeRef = useRef(Date.now())
  const questionStartRef = useRef(Date.now())
  const submittingRef = useRef(false)

  useEffect(() => {
    if (stateQuestions?.length) return // already loaded from navigation state
    const qs = new URLSearchParams()
    qs.set('subject', subject)
    qs.set('count', searchParams.get('count') || '10')
    qs.set('shuffle', searchParams.get('shuffle') === '0' ? '0' : '1')
    const unit = searchParams.get('unit')
    if (unit) qs.set('unit', unit)
    const grade = searchParams.get('grade')
    if (grade) qs.set('grade', grade)
    api
      .get(`/api/student/quiz?${qs.toString()}`)
      .then((d) => {
        if (!d.questions?.length) {
          setErr('這個科目目前沒有題目')
          return
        }
        setData(d)
        startTimeRef.current = Date.now()
        questionStartRef.current = Date.now()
      })
      .catch((e) => setErr(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject])

  if (err)
    return (
      <main className="p-5 text-sm" style={{ color: 'var(--subject-chinese)' }}>
        {err}
      </main>
    )
  if (!data) return <main className="p-5 text-sm text-ink-sub">載入中…</main>

  const q = data.questions[idx]
  const s = SUBJECTS[subject]
  const total = data.questions.length
  const isLast = idx === total - 1

  const onConfirm = () => {
    if (!selected || revealed) return
    const correct = selected === q.answer
    const time_ms = Date.now() - questionStartRef.current
    setAttempts((prev) => [...prev, { question_id: q.id, selected, correct, time_ms }])
    setRevealed(true)
  }

  const onNext = async () => {
    if (!isLast) {
      setIdx(idx + 1)
      setSelected(null)
      setRevealed(false)
      questionStartRef.current = Date.now()
      return
    }
    if (submittingRef.current) return
    submittingRef.current = true
    try {
      // Practice with pre-loaded questions (e.g. 練錯題 re-run) must not
      // double-count as a fresh attempt. The wrong questions will be shown
      // on Result anyway; we just skip the server write.
      let res = {
        correct: attempts.filter((a) => a.correct).length,
        wrong: attempts.filter((a) => !a.correct).length,
        stars: attempts.filter((a) => a.correct).length * 10,
      }
      if (!stateQuestions?.length) {
        res = await api.post('/api/student/attempts', { attempts })
      }
      const elapsedSec = Math.round((Date.now() - startTimeRef.current) / 1000)
      const mins = Math.floor(elapsedSec / 60)
      const secs = elapsedSec % 60
      const wrongQuestions = []
      const mistakes = attempts
        .map((a, i) => {
          if (a.correct) return null
          const item = data.questions[i]
          wrongQuestions.push(item)
          return { q: i + 1, text: item.question, your: a.selected, correct: item.answer }
        })
        .filter(Boolean)
      navigate('/student/result', {
        replace: true,
        state: {
          subject,
          unit: q.unit,
          correct: res.correct,
          total,
          wrong: res.wrong,
          stars: res.stars,
          time: `${mins} 分 ${String(secs).padStart(2, '0')} 秒`,
          mistakes,
          wrongQuestions,
        },
      })
    } catch (e) {
      alert('提交失敗:' + e.message)
      submittingRef.current = false
    }
  }

  const onClose = () => {
    if (attempts.length && !window.confirm('離開會放棄進度,確定嗎?')) return
    navigate('/student')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--page)' }}>
      <div className="sticky top-0 z-10" style={{ background: 'var(--page)' }}>
        <div className="mx-auto max-w-md px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              aria-label="關閉"
              className="inline-flex items-center justify-center rounded-bubble hover:bg-neutral-chip"
              style={{ width: 40, height: 40, marginLeft: -8 }}
            >
              <X size={20} />
            </button>
            <div className="flex-1 flex items-center justify-between">
              <SubjectTag subject={subject} />
              <span className="text-[13px] text-ink-sub font-num">
                {idx + 1} / {total}
              </span>
            </div>
          </div>
          <div className="mt-3">
            <ProgressBar
              value={idx + (revealed ? 1 : 0)}
              max={total}
              height={8}
              color={s.color}
            />
          </div>
        </div>
      </div>

      <div className="flex-1">
        <div className="mx-auto max-w-md px-5 pb-44">
          <div className="bg-card rounded-card border border-line shadow-card p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[14px] font-semibold font-num" style={{ color: s.color }}>
                Q{idx + 1}
              </span>
              <span className="text-[12px] text-ink-sub">
                {q.grade} 年級 · {q.unit || '練習'}
              </span>
            </div>
            {q.image_url ? (
              <img
                src={q.image_url}
                alt={`第 ${idx + 1} 題`}
                onClick={() => setZoomedImg(q.image_url)}
                style={{
                  width: '100%',
                  height: 'auto',
                  borderRadius: 8,
                  border: '1px solid var(--line-soft)',
                  cursor: 'zoom-in',
                }}
              />
            ) : q.zhuyin?.length ? (
              <RubyText chars={q.zhuyin} />
            ) : (
              <p style={{ fontSize: 18, lineHeight: 1.6, margin: 0 }}>{q.question}</p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {q.options.map((opt) => {
              const letter = opt.label
              let state = 'default'
              if (revealed) {
                if (letter === q.answer) state = 'correct'
                else if (letter === selected) state = 'wrong'
                else state = 'default'
              } else if (selected === letter) {
                state = 'selected'
              }
              return (
                <OptionButton
                  key={letter}
                  letter={letter}
                  text={opt.text}
                  state={state}
                  color={s.color}
                  onClick={() => !revealed && setSelected(letter)}
                />
              )
            })}
          </div>

          {revealed && (
            <div
              className="mt-5 p-4"
              style={{
                borderRadius: 14,
                background:
                  selected === q.answer
                    ? 'var(--subject-english-bg)'
                    : 'var(--subject-chinese-bg)',
                border: `1px solid ${selected === q.answer ? '#3B8A7C' : '#D14343'}`,
              }}
            >
              <div
                className="flex items-center gap-2 text-[15px] font-semibold"
                style={{ color: selected === q.answer ? '#3B8A7C' : '#D14343' }}
              >
                {selected === q.answer ? (
                  <>
                    <CheckCircle2 size={18} />
                    答對了!
                  </>
                ) : (
                  <>
                    <XCircle size={18} />
                    正確答案:{q.answer}
                  </>
                )}
              </div>
              {q.explanation && (
                <div
                  className="mt-2 text-[14px]"
                  style={{ color: '#2a2a2a', lineHeight: 1.7 }}
                >
                  <span className="text-ink-sub font-medium">解析 · </span>
                  {q.explanation}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        className="sticky bottom-0"
        style={{
          background:
            'linear-gradient(to top, var(--page) 55%, rgba(250,250,248,0))',
          paddingTop: 20,
          paddingBottom: 24,
        }}
      >
        <div className="mx-auto max-w-md px-5">
          {!revealed ? (
            <button
              onClick={onConfirm}
              disabled={!selected}
              className="w-full rounded-btn text-white font-semibold"
              style={{
                minHeight: 56,
                fontSize: 17,
                background: selected ? s.color : '#CCCAC4',
                transition: 'background 0.15s ease',
              }}
            >
              確認答案
            </button>
          ) : (
            <button
              onClick={onNext}
              className="w-full inline-flex items-center justify-center gap-2 rounded-btn text-white font-semibold"
              style={{ minHeight: 56, fontSize: 17, background: s.color }}
            >
              {isLast ? '看結果' : '下一題'}
              <ArrowRight size={18} strokeWidth={2.25} />
            </button>
          )}
        </div>
      </div>

      {zoomedImg && (
        <div
          onClick={() => setZoomedImg(null)}
          className="fixed inset-0 z-30 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', cursor: 'zoom-out' }}
        >
          <img
            src={zoomedImg}
            alt="題目放大"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </div>
      )}
    </div>
  )
}

function OptionButton({ letter, text, state, color, onClick }) {
  const styles = {
    default: {
      bg: '#fff',
      border: '#E5E3DD',
      circleBg: '#F3F1EB',
      circleFg: '#1A1A1A',
    },
    selected: {
      bg: color + '14',
      border: color,
      circleBg: color,
      circleFg: '#fff',
    },
    correct: {
      bg: '#E6F1EE',
      border: '#3B8A7C',
      circleBg: '#3B8A7C',
      circleFg: '#fff',
    },
    wrong: {
      bg: '#FBEBEB',
      border: '#D14343',
      circleBg: '#D14343',
      circleFg: '#fff',
    },
  }[state]
  return (
    <button
      onClick={onClick}
      disabled={state === 'correct' || state === 'wrong'}
      className="w-full flex items-center gap-3 rounded-option text-left"
      style={{
        minHeight: 52,
        padding: '10px 14px 10px 10px',
        background: styles.bg,
        border: `2px solid ${styles.border}`,
        transition: 'all 0.15s ease',
      }}
    >
      <span
        className="inline-flex items-center justify-center font-semibold shrink-0"
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: styles.circleBg,
          color: styles.circleFg,
          fontSize: 13,
        }}
      >
        {state === 'correct' ? (
          <Check size={16} strokeWidth={3} />
        ) : state === 'wrong' ? (
          <X size={16} strokeWidth={3} />
        ) : (
          letter
        )}
      </span>
      <span style={{ fontSize: 15, lineHeight: 1.5 }}>{text}</span>
    </button>
  )
}
