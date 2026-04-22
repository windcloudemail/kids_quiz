// Parse teacher-uploaded question files into normalised question objects.
// Supports:
//   .json   — array of objects matching the DB question shape
//   .docx   — Word table where header cells identify columns
// PDF / OCR left out of MVP (add pdfjs-dist / tesseract.js back in later).

import mammoth from 'mammoth'

const SUBJECT_MAP = {
  chinese: 'chinese', 國語: 'chinese', 中文: 'chinese', 語文: 'chinese',
  math: 'math', 數學: 'math', 數: 'math',
  english: 'english', 英文: 'english', 英: 'english', 英語: 'english',
}

export async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'json') return parseJSON(file)
  if (ext === 'docx') return parseDOCX(file)
  throw new Error(`不支援的格式: .${ext}(只接受 .json / .docx)`)
}

async function parseJSON(file) {
  const text = await file.text()
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    throw new Error('JSON 格式有誤: ' + e.message)
  }
  if (!Array.isArray(data)) throw new Error('JSON 最外層必須是陣列')
  return { questions: data.map(normalize) }
}

async function parseDOCX(file) {
  const buf = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer: buf })
  const html = result.value
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const tables = doc.querySelectorAll('table')
  if (!tables.length) throw new Error('docx 中找不到表格(請用表格格式填題目)')
  const questions = []
  for (const table of tables) {
    const rows = [...table.querySelectorAll('tr')]
    if (rows.length < 2) continue
    const headerCells = [...rows[0].querySelectorAll('td, th')].map((c) =>
      c.textContent.trim()
    )
    const headerMap = detectHeader(headerCells)
    if (headerMap.question === undefined) continue
    for (let i = 1; i < rows.length; i++) {
      const cells = [...rows[i].querySelectorAll('td, th')].map((c) =>
        c.textContent.trim()
      )
      const q = buildFromRow(headerMap, cells)
      if (q) questions.push(normalize(q))
    }
  }
  return { questions }
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

function buildFromRow(headerMap, cells) {
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

function normalize(raw) {
  const subject =
    SUBJECT_MAP[(raw.subject || '').toLowerCase()] ||
    SUBJECT_MAP[raw.subject] ||
    ''
  const rawAns = String(raw.answer || '')
    .toUpperCase()
    .trim()
  const answer = /^[ABCD]$/.test(rawAns)
    ? rawAns
    : /^[1-4]$/.test(rawAns)
      ? 'ABCD'[parseInt(rawAns, 10) - 1]
      : ''
  return {
    subject,
    grade: parseInt(raw.grade, 10) || 0,
    unit: (raw.unit || '').trim() || null,
    difficulty: parseInt(raw.difficulty, 10) || 1,
    question: (raw.question || '').trim(),
    option_a: (raw.option_a || '').trim(),
    option_b: (raw.option_b || '').trim(),
    option_c: (raw.option_c || '').trim(),
    option_d: (raw.option_d || '').trim(),
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
      reasons.push('科目必須是 chinese/math/english(或 國語/數學/英文)')
    if (q.grade < 1 || q.grade > 6) reasons.push('年級需 1-6')
    if (q.difficulty < 1 || q.difficulty > 5) reasons.push('難度需 1-5')
    if (reasons.length) errors.push({ index: i, reasons, question: q })
    else valid.push(q)
  })
  return { valid, errors }
}
