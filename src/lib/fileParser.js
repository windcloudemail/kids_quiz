// Parse teacher-uploaded question files into normalised question objects.
// Supports:
//   .json   — array of objects matching the DB question shape
//   .docx   — Word tables (preferred) or plain text fallback
//   .pdf    — pdfjs-dist extracts text by y-coordinates, then plain-text parse
//   image/* — tesseract.js OCR (chi_tra), then plain-text parse
//
// Separate entry parseAnswerFile() parses answer sheets (.xlsx / .json / .csv)
// into a Map<sourceNumber, 'A'|'B'|'C'|'D'> so the caller can merge answers
// into questions whose source didn't include the answer (e.g. Taiwan
// official exam question booklets).

import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import Tesseract from 'tesseract.js'
import * as XLSX from 'xlsx'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const SUBJECT_MAP = {
  chinese: 'chinese', 國語: 'chinese', 中文: 'chinese', 語文: 'chinese', 國文: 'chinese',
  math: 'math', 數學: 'math', 數: 'math', 算數: 'math', 算術: 'math',
  english: 'english', 英文: 'english', 英: 'english', 英語: 'english',
}

const CHINESE_NUMS = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 }

// =============================================================
// Entry point — question file
// =============================================================

export async function parseFile(file) {
  const name = (file.name || '').toLowerCase()
  const type = file.type || ''
  const subjectHint = detectSubjectFromName(file.name || '')
  const gradeHint = detectGradeFromName(file.name || '')
  const unitHint = deriveBookNameFromFilename(file.name || '')

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
    throw new Error(`不支援的檔案格式(${type || '.' + name.split('.').pop()})`)
  }

  return {
    questions: rows.map((r) => normalize(r, subjectHint, gradeHint, unitHint)),
  }
}

function deriveBookNameFromFilename(name) {
  if (!name) return null
  // Drop extension and any trailing number suffix like (1), (2)
  let base = name.replace(/\.[^.]+$/, '').replace(/\s*\(\d+\)\s*$/, '')
  base = base.replace(/_/g, ' ').trim()
  return base || null
}

// =============================================================
// Entry point — answer file
// =============================================================

export async function parseAnswerFile(file) {
  const name = (file.name || '').toLowerCase()
  const type = file.type || ''
  if (name.endsWith('.json') || type === 'application/json') {
    return parseAnswerJSON(file)
  }
  if (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    type.includes('spreadsheet') ||
    type.includes('excel')
  ) {
    return parseAnswerXLSX(file)
  }
  if (name.endsWith('.csv') || type === 'text/csv') {
    return parseAnswerCSV(file)
  }
  throw new Error(`答案檔格式不支援(${type || name.split('.').pop()})`)
}

export function mergeAnswers(questions, answerMap) {
  if (!answerMap || answerMap.size === 0) return { merged: questions, hit: 0 }
  let hit = 0
  const merged = questions.map((q, i) => {
    const key = q.source_number ?? i + 1
    const ans = answerMap.get(Number(key))
    if (ans && !q.answer) {
      hit++
      return { ...q, answer: ans }
    }
    return q
  })
  return { merged, hit }
}

// =============================================================
// JSON questions
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
// PDF
// =============================================================
//
// parsePDF renders each page to a hi-DPI canvas AND collects per-line text
// with its PDF-space y coordinate. It first tries extractTrailingMarkerStyle
// on the rich lines (so each question carries a {pageIndex, yStart, yEnd}
// slice); if that yields fewer questions than the leading-marker style, we
// fall back to leading style without images. Images are always JPEG q=0.85
// to keep R2 storage small (PNG would bloat 3-5×).

async function parsePDF(file) {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf, useSystemFonts: true }).promise

  const pages = []
  const richLines = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d', { alpha: false })
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise
    pages.push({ canvas, viewport, pageIndex: i - 1 })

    const content = await page.getTextContent()
    let curText = ''
    let curY = null
    let lastY = null
    for (const item of content.items) {
      if (!item.str) continue
      const y = item.transform[5]
      if (lastY !== null && Math.abs(lastY - y) > 2) {
        if (curText) richLines.push({ text: curText, y: curY, pageIndex: i - 1 })
        curText = ''
        curY = null
      }
      if (!curText) curY = y
      curText += item.str
      lastY = y
    }
    if (curText) richLines.push({ text: curText, y: curY, pageIndex: i - 1 })
  }

  const rawText = richLines.map((l) => l.text).join('\n')

  const withLoc = extractTrailingMarkerStyleWithLoc(richLines)
  const plain = extractLeadingMarkerStyle(rawText)

  if (withLoc.length > plain.length) {
    return attachImagesToQuestions(withLoc, pages)
  }
  return plain
}

function extractTrailingMarkerStyleWithLoc(richLines) {
  const out = []
  let current = null
  let optBuffer = ''
  const options = { 1: null, 2: null, 3: null, 4: null }
  let nextExpected = 1
  let collectingQuestion = true

  const flush = (nextStartLoc) => {
    if (!current) return
    const [o1, o2, o3, o4] = [options[1], options[2], options[3], options[4]]
    if (current.question && o1 && o2 && o3 && o4) {
      let yEnd = null
      if (
        nextStartLoc &&
        nextStartLoc.pageIndex === current._loc.pageIndex
      ) {
        yEnd = nextStartLoc.y
      }
      current._loc.yEnd = yEnd
      out.push({
        source_number: current.n,
        question: current.question.trim(),
        option_a: o1,
        option_b: o2,
        option_c: o3,
        option_d: o4,
        answer: '',
        explanation: '',
        _loc: current._loc,
      })
    }
    current = null
    options[1] = options[2] = options[3] = options[4] = null
    nextExpected = 1
    collectingQuestion = true
    optBuffer = ''
  }

  for (const line of richLines) {
    if (/請繼續作答/.test(line.text)) continue

    const qStart = line.text.match(/^(\d+)\.\s*(.*)$/)
    if (qStart) {
      flush({ pageIndex: line.pageIndex, y: line.y })
      current = {
        n: parseInt(qStart[1], 10),
        question: qStart[2] || '',
        _loc: { pageIndex: line.pageIndex, yStart: line.y, yEnd: null },
      }
      collectingQuestion = true
      continue
    }

    if (!current) continue

    const trailing = line.text.match(/^(.*?)\s*([1-4])\s*$/)
    if (trailing) {
      const marker = parseInt(trailing[2], 10)
      const optText = (optBuffer + ' ' + (trailing[1] || '')).trim()
      if (marker === nextExpected && optText.length > 0) {
        options[marker] = optText
        nextExpected++
        optBuffer = ''
        collectingQuestion = false
        continue
      }
    }

    if (collectingQuestion) {
      current.question = (current.question + ' ' + line.text).trim()
    } else {
      optBuffer = (optBuffer + ' ' + line.text).trim()
    }
  }
  flush(null)
  return out
}

function attachImagesToQuestions(questions, pages) {
  for (const q of questions) {
    const loc = q._loc
    delete q._loc
    if (!loc) continue
    const page = pages[loc.pageIndex]
    if (!page) continue
    const { canvas, viewport } = page
    const scale = viewport.scale
    const h = viewport.height

    // PDF y is bottom-up, canvas y is top-down.
    // Text y is the baseline of the line, so top-of-line ≈ y + font size (~12pt).
    // Add a small padding around the crop so we don't clip glyphs.
    const padTop = 18
    const padBottom = 12
    const topPx = Math.max(0, Math.floor(h - loc.yStart * scale) - padTop)
    const bottomPx =
      loc.yEnd != null
        ? Math.min(h, Math.ceil(h - loc.yEnd * scale) + padBottom)
        : h
    const sliceH = bottomPx - topPx
    if (sliceH < 40) continue

    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = sliceH
    const sctx = slice.getContext('2d', { alpha: false })
    sctx.fillStyle = '#fff'
    sctx.fillRect(0, 0, slice.width, slice.height)
    sctx.drawImage(canvas, 0, topPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
    q.image_data_url = slice.toDataURL('image/jpeg', 0.85)
  }
  return questions
}

// =============================================================
// Image OCR
// =============================================================

async function parseImage(file) {
  const {
    data: { text },
  } = await Tesseract.recognize(file, 'chi_tra')
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
// extractQuestions — tries two plain-text layouts, keeps the more productive
// =============================================================

function extractQuestions(rawText) {
  const aStyle = extractLeadingMarkerStyle(rawText)
  const bStyle = extractTrailingMarkerStyle(rawText)
  return bStyle.length > aStyle.length ? bStyle : aStyle
}

// A. Leading-marker layout (insurance_quiz style):
//    "1. question text (A) opt1 (B) opt2 (C) opt3 (D) opt4  答案: B"
function extractLeadingMarkerStyle(rawText) {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  const out = []
  let current = null

  const flush = () => {
    if (!current || !current._raw) return
    let body = current._raw.trim()

    const expMatch = body.match(
      /【?(?:解說|解析|說明|Explanation|Explain)】?[:：\s]*([\s\S]*?)$/i
    )
    if (expMatch) {
      current.explanation = expMatch[1].trim()
      body = body.substring(0, expMatch.index).trim()
    }

    if (!current._answerLetter) {
      const ansMatch = body.match(
        /【?(?:答案|解答|Answer|Ans)】?[:：\s]*(?:\(|（|)?([1-4A-D])(?:\)|）|)?/i
      )
      if (ansMatch) {
        current._answerLetter = toLetter(ansMatch[1])
        body = body.substring(0, ansMatch.index).trim()
      }
    }

    const opts = extractLeadingOptions(body)
    if (opts) {
      current.question = [opts.q, opts.qp2].filter(Boolean).join(' ').trim()
      current.option_a = opts.o1
      current.option_b = opts.o2
      current.option_c = opts.o3
      current.option_d = opts.o4
    } else {
      current.question = body
    }

    current.answer = current._answerLetter || ''
    if (
      current.question &&
      current.option_a &&
      current.option_b &&
      current.option_c &&
      current.option_d
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
        source_number: newFmt ? parseInt(newFmt[1], 10) : parseInt(oldFmt[1], 10),
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

function extractLeadingOptions(text) {
  const markersList = [
    ['(1)', '(2)', '(3)', '(4)'],
    ['(A)', '(B)', '(C)', '(D)'],
    ['（1）', '（2）', '（3）', '（4）'],
    ['（A）', '（B）', '（C）', '（D）'],
    ['①', '②', '③', '④'],
    ['A.', 'B.', 'C.', 'D.'],
    ['A、', 'B、', 'C、', 'D、'],
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
    const tail = text.substring(i4 + m[3].length)
    const enders = ['。', '？', '！']
    let endIdx = tail.length
    for (const e of enders) {
      const idx = tail.indexOf(e)
      if (idx > 0 && idx < endIdx) endIdx = idx
    }
    const o4 = tail.substring(0, endIdx).trim()
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

// B. Trailing-marker layout (Taiwan official exam booklet style):
//    "1. question text..."
//    "option-1 text 1"
//    "option-2 text 2"
//    "option-3 text 3"
//    "option-4 text 4"
// Each option line ends with its marker number 1..4. No answer in booklet.
function extractTrailingMarkerStyle(rawText) {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const out = []
  let current = null
  let optBuffer = ''
  const options = { 1: null, 2: null, 3: null, 4: null }
  let nextExpected = 1
  let collectingQuestion = true

  const flush = () => {
    if (!current) return
    const [o1, o2, o3, o4] = [options[1], options[2], options[3], options[4]]
    if (current.question && o1 && o2 && o3 && o4) {
      out.push({
        source_number: current.n,
        question: current.question.trim(),
        option_a: o1,
        option_b: o2,
        option_c: o3,
        option_d: o4,
        answer: '',
        explanation: '',
      })
    }
    current = null
    options[1] = options[2] = options[3] = options[4] = null
    nextExpected = 1
    collectingQuestion = true
    optBuffer = ''
  }

  for (const line of lines) {
    if (/請繼續作答/.test(line)) continue

    const qStart = line.match(/^(\d+)\.\s*(.*)$/)
    if (qStart) {
      flush()
      current = { n: parseInt(qStart[1], 10), question: qStart[2] || '' }
      collectingQuestion = true
      continue
    }

    if (!current) continue

    const trailing = line.match(/^(.*?)\s*([1-4])\s*$/)
    if (trailing) {
      const marker = parseInt(trailing[2], 10)
      const optText = (optBuffer + ' ' + (trailing[1] || '')).trim()
      if (marker === nextExpected && optText.length > 0) {
        options[marker] = optText
        nextExpected++
        optBuffer = ''
        collectingQuestion = false
        continue
      }
    }

    if (collectingQuestion) {
      current.question = (current.question + ' ' + line).trim()
    } else {
      optBuffer = (optBuffer + ' ' + line).trim()
    }
  }
  flush()
  return out
}

function toLetter(v) {
  if (!v) return null
  const s = String(v).toUpperCase()
  if (/^[ABCD]$/.test(s)) return s
  if (/^[1-4]$/.test(s)) return 'ABCD'[parseInt(s, 10) - 1]
  return null
}

// =============================================================
// Answer files (xlsx / json / csv)
// =============================================================

async function parseAnswerJSON(file) {
  const text = await file.text()
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    throw new Error('答案 JSON 格式有誤: ' + e.message)
  }
  const map = new Map()
  // Accept any of:
  //   [{q: 1, answer: "A"}, ...]
  //   [{n: 1, a: "A"}, ...]
  //   { "1": "A", "2": "B", ... }
  //   [ "A","B","C",...]  (index+1 is the question number)
  if (Array.isArray(data)) {
    data.forEach((row, i) => {
      if (typeof row === 'string' || typeof row === 'number') {
        const ans = toLetter(row)
        if (ans) map.set(i + 1, ans)
        return
      }
      if (row && typeof row === 'object') {
        const n = parseInt(row.q ?? row.n ?? row.number ?? row.source_number ?? i + 1, 10)
        const a = toLetter(row.a ?? row.answer ?? row.ans)
        if (n && a) map.set(n, a)
      }
    })
  } else if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      const n = parseInt(k, 10)
      const a = toLetter(v)
      if (n && a) map.set(n, a)
    }
  }
  return map
}

async function parseAnswerCSV(file) {
  const text = await file.text()
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/[,\t]/).map((c) => c.trim()))
  return answerMapFromRows(rows)
}

async function parseAnswerXLSX(file) {
  const buf = await file.arrayBuffer()
  // SheetJS type:'array' expects a Uint8Array, not a raw ArrayBuffer —
  // passing the ArrayBuffer directly hangs the renderer in some builds.
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    const map = answerMapFromRows(rows)
    if (map.size > 0) return map
  }
  return new Map()
}

function answerMapFromRows(rows) {
  if (!rows || rows.length === 0) return new Map()
  const map = new Map()

  // Strategy 1: wide format — header row has question numbers across columns,
  // later rows have answers per question
  const header = rows[0] || []
  const numericCols = []
  header.forEach((cell, col) => {
    const n = parseInt(cell, 10)
    if (!isNaN(n) && n >= 1 && n <= 999) numericCols.push({ col, n })
  })
  if (numericCols.length >= 3) {
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || []
      const tentative = new Map()
      for (const { col, n } of numericCols) {
        const ans = toLetter(row[col])
        if (ans) tentative.set(n, ans)
      }
      if (tentative.size > 0) {
        for (const [n, a] of tentative) map.set(n, a)
        if (map.size >= numericCols.length) return map
      }
    }
    if (map.size > 0) return map
  }

  // Strategy 2: long format — first col is question number, second col is answer
  for (const row of rows) {
    if (!row || row.length < 2) continue
    const n = parseInt(row[0], 10)
    if (isNaN(n) || n < 1 || n > 999) continue
    const a = toLetter(row[1])
    if (a) map.set(n, a)
  }
  return map
}

// =============================================================
// Normalisation + validation
// =============================================================

function normalize(raw, subjectHint, gradeHint, unitHint) {
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

  const rawUnit = (raw.unit || '').trim()
  const unit = rawUnit || unitHint || null

  return {
    source_number: raw.source_number || null,
    subject,
    grade: parseInt(raw.grade, 10) || gradeHint || 0,
    unit,
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
    if (!/^[ABCD]$/.test(q.answer)) reasons.push('缺答案(請補上答案檔或手動編輯)')
    if (!['chinese', 'math', 'english'].includes(q.subject))
      reasons.push('科目空白(可手動挑或檔名含「國語/數學/英文」)')
    if (q.grade < 1 || q.grade > 6) reasons.push('年級需 1-6')
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
  const m = name.match(/([一二三四五六])年級|grade\s*([1-6])|g([1-6])|([1-6])\s*年級/i)
  if (!m) return null
  for (const cap of m.slice(1)) {
    if (!cap) continue
    if (CHINESE_NUMS[cap]) return CHINESE_NUMS[cap]
    const n = parseInt(cap, 10)
    if (n >= 1 && n <= 6) return n
  }
  return null
}
