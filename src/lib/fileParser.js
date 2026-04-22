// Parse teacher-uploaded question files into normalised question objects.
// Ported from insurance_quiz/src/lib/fileParser.js. Supports:
//   .json   — array of objects matching the DB question shape
//   .docx   — Word tables (preferred) or plain text fallback
//   .pdf    — pdfjs-dist extracts text by y-coordinates, then plain-text parse
//   image/* — tesseract.js OCR (chi_tra), then plain-text parse
//
// Normalisation converts insurance-style shapes (option_1..4, answer 1-4,
// category) into the kids-quiz DB shape (option_a..d, answer A-D, subject).

import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import Tesseract from 'tesseract.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const SUBJECT_MAP = {
  chinese: 'chinese', 國語: 'chinese', 中文: 'chinese', 語文: 'chinese', 國文: 'chinese',
  math: 'math', 數學: 'math', 數: 'math', 算數: 'math', 算術: 'math',
  english: 'english', 英文: 'english', 英: 'english', 英語: 'english',
}

const CHINESE_NUMS = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 }

// =============================================================
// Entry point
// =============================================================

export async function parseFile(file) {
  const name = (file.name || '').toLowerCase()
  const type = file.type || ''
  const subjectHint = detectSubjectFromName(file.name || '')
  const gradeHint = detectGradeFromName(file.name || '')

  let rows
  if (name.endsWith('.json') || type === 'application/json') {
    rows = await parseJSON(file)
  } else if (
    name.endsWith('.docx') ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    rows = await parseDOCX(file)
  } else if (name.endsWith('.pdf') || type === 'application/pdf') {
    rows = await parsePDF(file)
  } else if (type.startsWith('image/')) {
    rows = await parseImage(file)
  } else {
    throw new Error(`不支援的檔案格式(${type || '.' + name.split('.').pop()});支援 .json / .docx / .pdf / 圖片`)
  }

  return { questions: rows.map((r) => normalize(r, subjectHint, gradeHint)) }
}

// =============================================================
// JSON
// =============================================================

async function parseJSON(file) {
  const text = await file.text()
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    throw new Error('JSON 格式有誤: ' + e.message)
  }
  if (!Array.isArray(data)) throw new Error('JSON 最外層必須是陣列')
  return data
}

// =============================================================
// DOCX — try HTML table first, fall back to raw-text extractQuestions
// =============================================================

async function parseDOCX(file) {
  const buf = await file.arrayBuffer()
  try {
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer: buf })
    const fromTable = extractFromDOCXTables(htmlResult.value)
    if (fromTable.length) return fromTable
  } catch (e) {
    console.warn('[parseDOCX] HTML 解析失敗,改用純文字', e)
  }
  const textResult = await mammoth.extractRawText({ arrayBuffer: buf })
  return extractQuestions(textResult.value)
}

function extractFromDOCXTables(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const tables = doc.querySelectorAll('table')
  const rows = []
  for (const table of tables) {
    const trs = [...table.querySelectorAll('tr')]
    if (trs.length < 2) continue
    const headerCells = [...trs[0].querySelectorAll('td, th')].map((c) =>
      cellText(c).trim()
    )
    const headerMap = detectHeader(headerCells)
    if (headerMap.question === undefined) continue
    for (let i = 1; i < trs.length; i++) {
      const cells = [...trs[i].querySelectorAll('td, th')].map((c) =>
        cellText(c).trim()
      )
      const row = buildFromHeaderRow(headerMap, cells)
      if (row) rows.push(row)
    }
  }
  return rows
}

function cellText(cell) {
  let out = ''
  const walk = (n) => {
    if (n.nodeType === 3) out += n.textContent
    else if (n.nodeName === 'BR') out += '\n'
    else if (n.nodeName === 'P' || n.nodeName === 'DIV') {
      if (out && !out.endsWith('\n')) out += '\n'
      for (const c of n.childNodes) walk(c)
      if (!out.endsWith('\n')) out += '\n'
    } else {
      for (const c of n.childNodes) walk(c)
    }
  }
  for (const c of cell.childNodes) walk(c)
  return out.replace(/\n{3,}/g, '\n\n').trim()
}

function detectHeader(cells) {
  const map = {}
  cells.forEach((raw, idx) => {
    const s = raw.replace(/\s+/g, '')
    if (/^(題目|問題|題幹|題)$/.test(s)) map.question = idx
    else if (/^(選項)?A$/i.test(s) || s === '選項1') map.option_a = idx
    else if (/^(選項)?B$/i.test(s) || s === '選項2') map.option_b = idx
    else if (/^(選項)?C$/i.test(s) || s === '選項3') map.option_c = idx
    else if (/^(選項)?D$/i.test(s) || s === '選項4') map.option_d = idx
    else if (/^(答案|正解|正確答案)$/.test(s)) map.answer = idx
    else if (/^(解析|說明|解說|解釋)$/.test(s)) map.explanation = idx
    else if (/^(科目|科)$/.test(s)) map.subject = idx
    else if (/^(年級|年)$/.test(s)) map.grade = idx
    else if (/^(難度|星級|星)$/.test(s)) map.difficulty = idx
    else if (/^(單元|章節|主題)$/.test(s)) map.unit = idx
  })
  return map
}

function buildFromHeaderRow(headerMap, cells) {
  const get = (k) => (headerMap[k] !== undefined ? cells[headerMap[k]] : '')
  const question = get('question')
  if (!question) return null
  return {
    subject: get('subject'),
    grade: get('grade'),
    unit: get('unit'),
    difficulty: get('difficulty'),
    question,
    option_a: get('option_a'),
    option_b: get('option_b'),
    option_c: get('option_c'),
    option_d: get('option_d'),
    answer: get('answer'),
    explanation: get('explanation'),
  }
}

// =============================================================
// PDF — extract text with line breaks by y-coordinate, then extractQuestions
// =============================================================

async function parsePDF(file) {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument(buf).promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    let lastY = null
    let pageText = ''
    for (const item of content.items) {
      if (!item.str) continue
      const y = item.transform[5]
      if (lastY !== null && Math.abs(lastY - y) > 2) pageText += '\n'
      pageText += item.str
      lastY = y
    }
    fullText += pageText + '\n\n'
  }
  return extractQuestions(fullText)
}

// =============================================================
// Image OCR — tesseract.js chi_tra, then extractQuestions
// =============================================================

async function parseImage(file) {
  const {
    data: { text },
  } = await Tesseract.recognize(file, 'chi_tra', {
    logger: (m) => {
      if (m?.status === 'recognizing text' && typeof m.progress === 'number') {
        // swallow — caller can wire a progress UI later
      }
    },
  })
  const cleaned = text
    .replace(/[ \t\r]+/g, (match, offset, str) => {
      const prev = str[offset - 1]
      const next = str[offset + match.length]
      if (prev && next && /[a-zA-Z0-9]/.test(prev) && /[a-zA-Z0-9]/.test(next))
        return ' '
      return ''
    })
    .trim()
  return extractQuestions(cleaned)
}

// =============================================================
// Plain-text extractQuestions — ported near-verbatim from insurance_quiz,
// but outputs A-D answers instead of 1-4
// =============================================================

function extractQuestions(rawText) {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  const out = []
  let current = null

  const flush = () => {
    if (!current || !current._raw) return
    let body = current._raw.trim()

    // explanation — accept 解說 / 解析 / 說明 / Explanation / Explain
    const expMatch = body.match(
      /【?(?:解說|解析|說明|Explanation|Explain)】?[:：\s]*([\s\S]*?)$/i
    )
    if (expMatch) {
      current.explanation = expMatch[1].trim()
      body = body.substring(0, expMatch.index).trim()
    }

    // answer — accept 答案 / 解答 / Ans / Answer
    if (!current._answerLetter) {
      const ansMatch = body.match(
        /【?(?:答案|解答|Answer|Ans)】?[:：\s]*(?:\(|（|)?([1-4A-D])(?:\)|）|)?/i
      )
      if (ansMatch) {
        current._answerLetter = toLetter(ansMatch[1])
        body = body.substring(0, ansMatch.index).trim()
      }
    }

    // options
    const opts = extractOptions(body)
    if (opts) {
      current.question = [opts.q, opts.qp2].filter(Boolean).join(' ').trim()
      current.option_a = opts.o1
      current.option_b = opts.o2
      current.option_c = opts.o3
      current.option_d = opts.o4
    } else {
      current.question = body
    }

    // finalise
    current.answer = current._answerLetter || ''
    if (
      current.question &&
      current.option_a &&
      current.option_b &&
      current.option_c &&
      current.option_d &&
      /^[ABCD]$/.test(current.answer)
    ) {
      delete current._raw
      delete current._answerLetter
      out.push(current)
    }
  }

  for (const line of lines) {
    if (line.replace(/\s/g, '').includes('題號答案')) continue

    const newFmt = line.match(/^(\d+)\s+([1-4A-D])(?:\s+(.*))?$/i)
    const oldFmt = line.match(/^(\d+)[\.、]\s*(.*)$/)

    let qText = null
    let ansLetter = null
    if (newFmt) {
      ansLetter = toLetter(newFmt[2])
      qText = newFmt[3] || ''
    } else if (oldFmt) {
      qText = oldFmt[2] || ''
    }

    if (qText !== null) {
      flush()
      current = {
        _raw: qText,
        _answerLetter: ansLetter,
        question: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        answer: '',
        explanation: '',
      }
    } else if (current) {
      current._raw = current._raw ? current._raw + '\n' + line : line
    }
  }
  flush()
  return out
}

function extractOptions(text) {
  const markersList = [
    ['(1)', '(2)', '(3)', '(4)'],
    ['(A)', '(B)', '(C)', '(D)'],
    ['(1)', '(2)', '(3)', '(4)'],
    ['(A)', '(B)', '(C)', '(D)'],
    ['①', '②', '③', '④'],
    ['A.', 'B.', 'C.', 'D.'],
    ['A、', 'B、', 'C、', 'D、'],
    ['A', 'B', 'C', 'D'],
  ]
  for (const m of markersList) {
    const i1 = text.indexOf(m[0])
    if (i1 === -1) continue
    const i2 = text.indexOf(m[1], i1 + m[0].length)
    if (i2 === -1) continue
    const i3 = text.indexOf(m[2], i2 + m[1].length)
    if (i3 === -1) continue
    const i4 = text.indexOf(m[3], i3 + m[2].length)
    if (i4 === -1) continue

    // Guard: full-width A may be inside ()
    if (m[0] === 'A' && i1 > 0 && /[(（]/.test(text[i1 - 1])) continue

    const tail = text.substring(i4 + m[3].length)
    const enders = ['。', '？', '！']
    let endIdx = tail.length
    for (const e of enders) {
      const idx = tail.indexOf(e)
      if (idx > 0 && idx < endIdx) endIdx = idx
    }
    let o4 = tail.substring(0, endIdx).trim()
    const qp2 = tail
      .substring(endIdx)
      .replace(/^[。,,、;;:：?!!\s]+/, '')
      .trim()
    return {
      q: text.substring(0, i1).trim(),
      qp2,
      o1: text.substring(i1 + m[0].length, i2).trim(),
      o2: text.substring(i2 + m[1].length, i3).trim(),
      o3: text.substring(i3 + m[2].length, i4).trim(),
      o4: o4.replace(/。$/, '').trim(),
    }
  }
  return null
}

function toLetter(v) {
  if (!v) return null
  const s = String(v).toUpperCase()
  if (/^[ABCD]$/.test(s)) return s
  if (/^[1-4]$/.test(s)) return 'ABCD'[parseInt(s, 10) - 1]
  return null
}

// =============================================================
// Normalisation + validation
// =============================================================

function normalize(raw, subjectHint, gradeHint) {
  const subjectKey = raw.subject
  const subject =
    SUBJECT_MAP[subjectKey] ||
    SUBJECT_MAP[String(subjectKey || '').toLowerCase()] ||
    subjectHint ||
    ''

  const rawAns = String(raw.answer || '').toUpperCase().trim()
  const answer =
    /^[ABCD]$/.test(rawAns)
      ? rawAns
      : /^[1-4]$/.test(rawAns)
        ? 'ABCD'[parseInt(rawAns, 10) - 1]
        : ''

  const opt = (letter, num) => {
    const v =
      raw['option_' + letter] ||
      raw['option_' + num] ||
      raw['option' + num] ||
      ''
    return String(v || '').trim()
  }

  const questionMain = String(raw.question || '').trim()
  const questionPart2 = String(raw.question_part2 || '').trim()
  const question = [questionMain, questionPart2].filter(Boolean).join(' ')

  return {
    subject,
    grade: parseInt(raw.grade, 10) || gradeHint || 0,
    unit: (raw.unit || '').trim() || null,
    difficulty: parseInt(raw.difficulty, 10) || 2,
    question,
    option_a: opt('a', 1),
    option_b: opt('b', 2),
    option_c: opt('c', 3),
    option_d: opt('d', 4),
    answer,
    explanation: (raw.explanation || '').trim() || null,
  }
}

export function validateQuestions(list) {
  const valid = []
  const errors = []
  list.forEach((q, i) => {
    const reasons = []
    if (!q.question) reasons.push('題目空白')
    if (!q.option_a || !q.option_b || !q.option_c || !q.option_d)
      reasons.push('選項不齊')
    if (!/^[ABCD]$/.test(q.answer)) reasons.push('答案需為 A/B/C/D')
    if (!['chinese', 'math', 'english'].includes(q.subject))
      reasons.push('科目 subject 必須是 chinese/math/english(或 國語/數學/英文,或於檔名標示)')
    if (q.grade < 1 || q.grade > 6) reasons.push('年級需 1-6(可在檔名寫 X年級)')
    if (q.difficulty < 1 || q.difficulty > 5) reasons.push('難度需 1-5')
    if (reasons.length) errors.push({ index: i, reasons, question: q })
    else valid.push(q)
  })
  return { valid, errors }
}

function detectSubjectFromName(name) {
  const lower = (name || '').toLowerCase()
  for (const [k, v] of Object.entries(SUBJECT_MAP)) {
    if (lower.includes(k.toLowerCase()) || name.includes(k)) return v
  }
  return null
}

function detectGradeFromName(name) {
  if (!name) return null
  const m = name.match(/([一二三四五六])年級|grade\s*([1-6])|g([1-6])|([1-6])\s*年級|([1-6])nd|([1-6])rd|([1-6])th/i)
  if (!m) return null
  for (const cap of m.slice(1)) {
    if (!cap) continue
    if (CHINESE_NUMS[cap]) return CHINESE_NUMS[cap]
    const n = parseInt(cap, 10)
    if (n >= 1 && n <= 6) return n
  }
  return null
}
