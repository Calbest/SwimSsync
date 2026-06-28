import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, CheckCircle2, Info, FileText, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './Import.css'

// ─── Types ─────────────────────────────────────────────────────────────────

type Course = 'SCY' | 'LCM' | 'SCM'

interface SwimEntry { date: string; time: string; meet?: string }

interface ParsedRow {
  key: string
  course: Course
  eventId: string
  eventLabel: string
  bestTime: string
  entries: SwimEntry[]
  selected: boolean
}

interface EventMapping { id: number; course: Course; eventId: string }

// ─── Grouped events for dropdown ─────────────────────────────────────────────

const GROUPED_EVENTS: { group: string; events: [string, string][] }[] = [
  { group: 'Freestyle', events: [
    ['50-free','50 Free'], ['100-free','100 Free'], ['200-free','200 Free'],
    ['400-free','400 Free'], ['500-free','500 Free'], ['800-free','800 Free'],
    ['1000-free','1000 Free'], ['1500-free','1500 Free'], ['1650-free','1650 Free'],
  ]},
  { group: 'Backstroke', events: [
    ['50-back','50 Back'], ['100-back','100 Back'], ['200-back','200 Back'],
  ]},
  { group: 'Breaststroke', events: [
    ['50-breast','50 Breast'], ['100-breast','100 Breast'], ['200-breast','200 Breast'],
  ]},
  { group: 'Butterfly', events: [
    ['50-fly','50 Fly'], ['100-fly','100 Fly'], ['200-fly','200 Fly'],
  ]},
  { group: 'Individual Medley', events: [
    ['100-im','100 IM'], ['200-im','200 IM'], ['400-im','400 IM'],
  ]},
]

const EVENT_LABEL: Record<string, string> = Object.fromEntries(
  GROUPED_EVENTS.flatMap(g => g.events)
)

// ─── Event patterns ─────────────────────────────────────────────────────────

const EVENT_PATTERNS: Array<[RegExp, string, string]> = [
  [/\b1650\s*(freestyle|free|fr)\b/i,                   '1650-free',  '1650 Free'],
  [/\b1500\s*(freestyle|free|fr)\b/i,                   '1500-free',  '1500 Free'],
  [/\b1000\s*(freestyle|free|fr)\b/i,                   '1000-free',  '1000 Free'],
  [/\b800\s*(freestyle|free|fr)\b/i,                    '800-free',   '800 Free'],
  [/\b500\s*(freestyle|free|fr)\b/i,                    '500-free',   '500 Free'],
  [/\b400\s*(freestyle|free|fr)\b/i,                    '400-free',   '400 Free'],
  [/\b400\s*(individual\s*medley|i\.?m\.?|im)\b/i,      '400-im',     '400 IM'],
  [/\b200\s*(individual\s*medley|i\.?m\.?|im)\b/i,      '200-im',     '200 IM'],
  [/\b200\s*(freestyle|free|fr)\b/i,                    '200-free',   '200 Free'],
  [/\b200\s*(backstroke|back|bk)\b/i,                   '200-back',   '200 Back'],
  [/\b200\s*(breaststroke|breast|br)\b/i,               '200-breast', '200 Breast'],
  [/\b200\s*(butterfly|fly|fl)\b/i,                     '200-fly',    '200 Fly'],
  [/\b100\s*(individual\s*medley|i\.?m\.?|im)\b/i,      '100-im',     '100 IM'],
  [/\b100\s*(freestyle|free|fr)\b/i,                    '100-free',   '100 Free'],
  [/\b100\s*(backstroke|back|bk)\b/i,                   '100-back',   '100 Back'],
  [/\b100\s*(breaststroke|breast|br)\b/i,               '100-breast', '100 Breast'],
  [/\b100\s*(butterfly|fly|fl)\b/i,                     '100-fly',    '100 Fly'],
  [/\b50\s*(freestyle|free|fr)\b/i,                     '50-free',    '50 Free'],
  [/\b50\s*(backstroke|back|bk)\b/i,                    '50-back',    '50 Back'],
  [/\b50\s*(breaststroke|breast|br)\b/i,                '50-breast',  '50 Breast'],
  [/\b50\s*(butterfly|fly|fl)\b/i,                      '50-fly',     '50 Fly'],
]

const COURSE_RE = /\b(SCY|LCM|SCM)\b/i
const TIME_RE   = /\b(\d{1,2}:\d{2}\.\d{2}|\d{2}\.\d{2})\b/
const SKIP_LINE = /^(event\s+#|course|standard|meet name|club\b|lsc\b|^date\b|^time\b|swimmer|^name\b|^place\b|^pl\b|^rank\b|^#\b|finals\s+time|seed\s+time|prelim)/i

const MONTH_NAMES: Record<string, string> = {
  jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
  jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
}

function extractDate(line: string): string | null {
  let m = line.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
  if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`

  m = line.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`

  m = line.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/i)
  if (m) return `${m[3]}-${MONTH_NAMES[m[1].toLowerCase().slice(0,3)]}-${m[2].padStart(2,'0')}`

  m = line.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})\b/i)
  if (m) return `${m[2]}-${MONTH_NAMES[m[1].toLowerCase().slice(0,3)]}-01`

  return null
}

function toSec(t: string): number {
  const p = t.split(':')
  return p.length === 2 ? parseFloat(p[0]) * 60 + parseFloat(p[1]) : parseFloat(t)
}

// ─── Swim-Standards personal-best format parser ──────────────────────────────
// Handles alternating two-line pairs:
//   50 Y Free 29.80 BB 439
//   12 2026 CA GOLD Fall Age Group Meet 10/18/2025
// Y → SCY, M/L/LM → LCM

const SWTD_EVENT_RE = /^(\d+)\s+(Y|LY|L|LM|M)\s+(free(?:style)?|back(?:stroke)?|breast(?:stroke)?|fly|butterfly|i\.?m\.?|individual\s*medley)\s+((?:\d+:)?\d{1,2}\.\d{2})/i

const SWTD_COURSE_MAP: Record<string, Course> = {
  Y: 'SCY', LY: 'SCY', L: 'LCM', LM: 'LCM', M: 'LCM',
}

function parseSwimStandardsFormat(raw: string): ParsedRow[] | null {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.filter(l => SWTD_EVENT_RE.test(l)).length === 0) return null

  const ORDER: Course[] = ['SCY', 'LCM', 'SCM']
  const EVENT_ORDER = GROUPED_EVENTS.flatMap(g => g.events.map(([id]) => id))
  const map = new Map<string, { course: Course; eventId: string; eventLabel: string; entries: SwimEntry[] }>()

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(SWTD_EVENT_RE)
    if (!m) continue

    const [, dist, courseKey, strokeRaw, time] = m
    const course = SWTD_COURSE_MAP[courseKey.toUpperCase()] ?? 'SCY'
    const stroke = strokeRaw.toLowerCase().replace(/[\s.]+/g, '')

    let strokeId: string
    if (/^(free|freestyle)$/.test(stroke))           strokeId = 'free'
    else if (/^(back|backstroke)$/.test(stroke))     strokeId = 'back'
    else if (/^(breast|breaststroke)$/.test(stroke)) strokeId = 'breast'
    else if (/^(fly|butterfly)$/.test(stroke))       strokeId = 'fly'
    else if (/^(im|individualmedley)$/.test(stroke)) strokeId = 'im'
    else continue

    const eventId    = `${dist}-${strokeId}`
    const eventLabel = EVENT_LABEL[eventId] ?? `${dist} ${strokeId}`

    // Date lives on the next line (the meet line)
    let date = 'unknown'
    if (i + 1 < lines.length && !SWTD_EVENT_RE.test(lines[i + 1])) {
      date = extractDate(lines[i + 1]) ?? 'unknown'
    }

    const key = `${course}-${eventId}`
    const existing = map.get(key)
    if (existing) {
      if (!existing.entries.some(e => e.date === date && e.time === time))
        existing.entries.push({ date, time })
    } else {
      map.set(key, { course, eventId, eventLabel, entries: [{ date, time }] })
    }
  }

  if (map.size === 0) return null

  return Array.from(map.entries()).map(([key, { course, eventId, eventLabel, entries }]) => {
    const bestTime = entries.reduce((b, e) => toSec(e.time) < toSec(b.time) ? e : b).time
    return { key, course, eventId, eventLabel, bestTime, entries, selected: true }
  }).sort((a, b) => {
    const ci = ORDER.indexOf(a.course) - ORDER.indexOf(b.course)
    if (ci !== 0) return ci
    return EVENT_ORDER.indexOf(a.eventId) - EVENT_ORDER.indexOf(b.eventId)
  })
}

// ─── Section parser (SwimCloud manual event mapping) ─────────────────────────
// Splits pasted text on blank lines; each block is matched to an EventMapping.

function parseSwimCloudSections(raw: string, mappings: EventMapping[]): ParsedRow[] {
  const filled = mappings.filter(m => m.eventId)
  if (filled.length === 0) return []

  // Split on one-or-more blank lines
  const sections = raw.split(/\n[ \t]*\n+/).map(s => s.trim()).filter(Boolean)

  const ORDER: Course[] = ['SCY', 'LCM', 'SCM']
  const EVENT_ORDER = GROUPED_EVENTS.flatMap(g => g.events.map(([id]) => id))
  const map = new Map<string, { course: Course; eventId: string; eventLabel: string; entries: SwimEntry[] }>()

  sections.forEach((section, i) => {
    const mapping = filled[i]
    if (!mapping) return

    const { course, eventId } = mapping
    const eventLabel = EVENT_LABEL[eventId] ?? eventId
    const key = `${course}-${eventId}`

    for (const line of section.split('\n').map(l => l.trim()).filter(Boolean)) {
      if (SKIP_LINE.test(line)) continue
      const timeMatch = line.match(TIME_RE)
      if (!timeMatch) continue
      const time = timeMatch[1]
      const date = extractDate(line) ?? 'unknown'
      const existing = map.get(key)
      if (existing) {
        if (!existing.entries.some(e => e.date === date && e.time === time))
          existing.entries.push({ date, time })
      } else {
        map.set(key, { course, eventId, eventLabel, entries: [{ date, time }] })
      }
    }
  })

  return Array.from(map.entries()).map(([key, { course, eventId, eventLabel, entries }]) => {
    const bestTime = entries.reduce((b, e) => toSec(e.time) < toSec(b.time) ? e : b).time
    return { key, course, eventId, eventLabel, bestTime, entries, selected: true }
  }).sort((a, b) => {
    const ci = ORDER.indexOf(a.course) - ORDER.indexOf(b.course)
    if (ci !== 0) return ci
    return EVENT_ORDER.indexOf(a.eventId) - EVENT_ORDER.indexOf(b.eventId)
  })
}

// ─── Parser (handles both copy-paste rows and multi-line PDF result sheets) ──
// Strategy:
//   1. Each line is checked for event/course/time.
//   2. When an event or course is found, it becomes the "sticky" context.
//   3. When a time is found, it's attributed to the sticky event+course.
//      If the same line also has its own event/course, those take precedence.
//   4. This makes Hy-Tek / CTS / Meet Mobile PDF formats work out of the box.

function parseRawText(raw: string, targetName?: string): ParsedRow[] {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  const map = new Map<string, { course: Course; eventId: string; eventLabel: string; entries: SwimEntry[] }>()

  let stickyEvent: [string, string] | null = null  // [id, label]
  let stickyCourse: Course | null = null

  // Normalise the target name to tokens for matching swimmer rows
  const nameTokens = targetName
    ? targetName.toLowerCase().split(/\s+/).filter(Boolean)
    : null

  for (const line of lines) {
    if (SKIP_LINE.test(line)) continue

    // Update sticky event if this line mentions one
    for (const [re, id, label] of EVENT_PATTERNS) {
      if (re.test(line)) { stickyEvent = [id, label]; break }
    }

    // Update sticky course — but on data rows (lines that contain a time),
    // only check the content before the first tab. This prevents course
    // abbreviations inside meet names (e.g. "2025 SCM JAG Qualifier") from
    // overriding the course set by the section header ("100 FREE SCY:").
    const timeMatch = line.match(TIME_RE)
    const courseSearch = timeMatch ? line.split('\t')[0] : line
    const courseMatch  = courseSearch.match(COURSE_RE)
    if (courseMatch) stickyCourse = courseMatch[1].toUpperCase() as Course

    if (!timeMatch) continue

    // Skip header / column-label rows that happen to contain a number
    if (!stickyEvent && !stickyCourse) continue

    // If we know the swimmer's name, only take rows that contain their name
    // (helps with multi-swimmer result sheets)
    if (nameTokens && nameTokens.length >= 2) {
      const lower = line.toLowerCase()
      const hasName = nameTokens.every(tok => lower.includes(tok))
      if (!hasName) continue
    }

    const event  = stickyEvent  ?? null
    const course = stickyCourse ?? null
    if (!event || !course) continue

    const [eventId, eventLabel] = event
    const time = timeMatch[1]
    const key  = `${course}-${eventId}`
    const date = extractDate(line) ?? 'unknown'

    const existing = map.get(key)
    if (existing) {
      if (!existing.entries.some(e => e.date === date && e.time === time)) {
        existing.entries.push({ date, time })
      }
    } else {
      map.set(key, { course, eventId, eventLabel, entries: [{ date, time }] })
    }
  }

  const ORDER: Course[] = ['SCY', 'LCM', 'SCM']
  const EVENT_ORDER = EVENT_PATTERNS.map(([,id]) => id)

  return Array.from(map.entries()).map(([key, { course, eventId, eventLabel, entries }]) => {
    const bestTime = entries.reduce((b, e) => toSec(e.time) < toSec(b.time) ? e : b).time
    return { key, course, eventId, eventLabel, bestTime, entries, selected: true }
  }).sort((a, b) => {
    const ci = ORDER.indexOf(a.course) - ORDER.indexOf(b.course)
    if (ci !== 0) return ci
    return EVENT_ORDER.indexOf(a.eventId) - EVENT_ORDER.indexOf(b.eventId)
  })
}

// ─── Meet results parser ─────────────────────────────────────────────────────
// Handles the tab-separated format from Swimcloud meet results:
//   Event          Time      Imp     Place
//   100 Y Free     1:00.55   –       18th

interface MeetBlock { id: number; name: string; date: string; text: string }

function parseMeetEventStr(eventStr: string): { course: Course; eventId: string; eventLabel: string } | null {
  const m = eventStr.trim().match(/^(\d+)\s+(Y|M)\s+(.+)$/i)
  if (!m) return null
  const [, dist, courseChar, strokeStr] = m
  const course: Course = courseChar.toUpperCase() === 'Y' ? 'SCY' : 'LCM'
  const stroke = strokeStr.trim().toLowerCase().replace(/\./g, '')
  let strokeId: string | null = null
  if (/^(freestyle|free|fr)$/.test(stroke))           strokeId = 'free'
  else if (/^(backstroke|back|bk)$/.test(stroke))     strokeId = 'back'
  else if (/^(breaststroke|breast|br)$/.test(stroke)) strokeId = 'breast'
  else if (/^(butterfly|fly|fl)$/.test(stroke))       strokeId = 'fly'
  else if (/^(individual medley|im)$/.test(stroke))   strokeId = 'im'
  else return null
  const eventId = `${dist}-${strokeId}`
  const eventLabel = EVENT_LABEL[eventId] ?? `${dist} ${strokeId.charAt(0).toUpperCase() + strokeId.slice(1)}`
  return { course, eventId, eventLabel }
}

function parseMeetResults(meets: MeetBlock[]): ParsedRow[] {
  const ORDER: Course[] = ['SCY', 'LCM', 'SCM']
  const EVENT_ORDER = GROUPED_EVENTS.flatMap(g => g.events.map(([id]) => id))
  const map = new Map<string, { course: Course; eventId: string; eventLabel: string; entries: SwimEntry[] }>()

  for (const meet of meets) {
    const date = meet.date || 'unknown'
    const lines = meet.text.split('\n').map(l => l.trim()).filter(Boolean)
    for (const line of lines) {
      if (/^event\s+time/i.test(line)) continue
      const cols = line.split('\t')
      if (cols.length < 2) continue
      const eventStr = cols[0].trim()
      const timeStr  = cols[1].trim()
      if (!timeStr || timeStr === '–' || timeStr === '-' || /^(NT|DQ|DNS|SCR)$/i.test(timeStr)) continue
      const timeMatch = timeStr.match(TIME_RE)
      if (!timeMatch) continue
      const eventInfo = parseMeetEventStr(eventStr)
      if (!eventInfo) continue
      const key = `${eventInfo.course}-${eventInfo.eventId}`
      const time = timeMatch[1]
      const existing = map.get(key)
      const meetName = meet.name.trim() || undefined
      if (existing) {
        if (!existing.entries.some(e => e.date === date && e.time === time))
          existing.entries.push({ date, time, meet: meetName })
      } else {
        map.set(key, { course: eventInfo.course, eventId: eventInfo.eventId, eventLabel: eventInfo.eventLabel, entries: [{ date, time, meet: meetName }] })
      }
    }
  }

  return Array.from(map.entries()).map(([key, { course, eventId, eventLabel, entries }]) => {
    const bestTime = entries.reduce((b, e) => toSec(e.time) < toSec(b.time) ? e : b).time
    return { key, course, eventId, eventLabel, bestTime, entries, selected: true }
  }).sort((a, b) => {
    const ci = ORDER.indexOf(a.course) - ORDER.indexOf(b.course)
    if (ci !== 0) return ci
    return EVENT_ORDER.indexOf(a.eventId) - EVENT_ORDER.indexOf(b.eventId)
  })
}

// ─── PDF extraction ─────────────────────────────────────────────────────────

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href

  const buffer    = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: buffer })
  const pdf       = await loadingTask.promise

  const textParts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i)
    const content = await page.getTextContent()
    // Join items on the same line with a space; separate lines with newline
    let prevY: number | null = null
    const lineParts: string[] = []
    for (const item of content.items) {
      if (!('str' in item)) continue
      const y = Math.round((item as { transform: number[] }).transform[5])
      if (prevY !== null && Math.abs(y - prevY) > 2) {
        textParts.push(lineParts.join(' '))
        lineParts.length = 0
      }
      lineParts.push((item as { str: string }).str)
      prevY = y
    }
    if (lineParts.length) textParts.push(lineParts.join(' '))
  }
  return textParts.join('\n')
}

// ─── Component ─────────────────────────────────────────────────────────────

type Step   = 'paste' | 'review'
type Source = 'swimstandards' | 'usaswim' | 'swimcloud' | 'pdf'

export default function Import() {
  const navigate = useNavigate()
  const [step,        setStep]        = useState<Step>('paste')
  const [source,      setSource]      = useState<Source>('swimcloud')
  const [rawText,     setRawText]     = useState('')
  const [swimmerName, setSwimmerName] = useState('')
  const [parsed,      setParsed]      = useState<ParsedRow[]>([])
  const [existing,    setExisting]    = useState<Record<string, string>>({})
  const [parseError,  setParseError]  = useState('')
  const [saving,      setSaving]      = useState(false)
  const [pdfFile,     setPdfFile]     = useState<File | null>(null)
  const [pdfLoading,  setPdfLoading]  = useState(false)
  const [dragOver,    setDragOver]    = useState(false)
  const fileInputRef    = useRef<HTMLInputElement>(null)
  const mappingCounter  = useRef(1)
  const meetCounter     = useRef(1)
  const [swimcloudMode, setSwimcloudMode] = useState<'history' | 'meet'>('history')
  const [meets,         setMeets]         = useState<MeetBlock[]>([{ id: 0, name: '', date: '', text: '' }])
  const [eventMappings, setEventMappings] = useState<EventMapping[]>([
    { id: 0, course: 'SCY', eventId: '' },
  ])

  function addMeet() {
    setMeets(prev => [...prev, { id: meetCounter.current++, name: '', date: '', text: '' }])
  }
  function removeMeet(id: number) {
    setMeets(prev => prev.filter(m => m.id !== id))
  }
  function updateMeet(id: number, field: 'name' | 'date' | 'text', value: string) {
    setMeets(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m))
  }

  function addMapping() {
    setEventMappings(prev => [...prev, { id: mappingCounter.current++, course: 'SCY', eventId: '' }])
  }
  function removeMapping(id: number) {
    setEventMappings(prev => prev.filter(m => m.id !== id))
  }
  function updateMapping(id: number, field: 'course' | 'eventId', value: string) {
    setEventMappings(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m))
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      if (!user) { navigate('/'); return }
      setExisting(user.user_metadata?.times ?? {})
      // Pre-fill swimmer name from profile
      const meta = user.user_metadata ?? {}
      const full  = (meta.full_name as string) ?? ''
      if (full) setSwimmerName(full)
    })
  }, [navigate])

  function handleParse() {
    setParseError('')

    if (source === 'swimcloud' && swimcloudMode === 'meet') {
      const rows = parseMeetResults(meets)
      if (rows.length === 0) {
        setParseError(
          'No times found. Paste your meet results in the box(es) above — each row must have an event name ' +
          '(e.g. "100 Y Free"), a tab, and a time (e.g. "1:00.55"). Make sure the date is filled in for each meet.'
        )
        return
      }
      setParsed(rows)
      setStep('review')
      return
    }

    const filledMappings = eventMappings.filter(m => m.eventId)
    const useManual = source === 'swimcloud' && filledMappings.length > 0

    const rows = useManual
      ? parseSwimCloudSections(rawText, eventMappings)
      : (parseSwimStandardsFormat(rawText) ?? parseRawText(rawText))

    if (rows.length === 0) {
      setParseError(
        useManual
          ? 'No times found. Make sure each event block in the pasted text is separated by a blank line, and the block order matches the event list above.'
          : 'No times found. Make sure your pasted text includes an event header ' +
            '(e.g. "100 FREE SCY:") and time rows below it, or that each row has ' +
            'an event name, a course (SCY / LCM / SCM), and a time.'
      )
      return
    }
    setParsed(rows)
    setStep('review')
  }

  async function handlePdfParse() {
    if (!pdfFile) return
    setPdfLoading(true)
    setParseError('')
    try {
      const text = await extractPdfText(pdfFile)
      const rows = parseRawText(text, swimmerName.trim() || undefined)
      if (rows.length === 0) {
        setParseError(
          'No times found in this PDF. Make sure it\'s a swim meet result sheet and that ' +
          'the event names and course (SCY/LCM/SCM) are visible in the document. ' +
          'If the PDF has your name, enter it in the "Swimmer name" field so only your rows are imported.'
        )
        setPdfLoading(false)
        return
      }
      setParsed(rows)
      setStep('review')
    } catch (err) {
      console.error(err)
      setParseError('Could not read this PDF. Make sure it\'s not password-protected and contains selectable text (not a scanned image).')
    }
    setPdfLoading(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.type === 'application/pdf') {
      setPdfFile(file)
      setParseError('')
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) { setPdfFile(file); setParseError('') }
  }

  function toggleRow(key: string) {
    setParsed(prev => prev.map(r => r.key === key ? { ...r, selected: !r.selected } : r))
  }

  function toggleAll(on: boolean) {
    setParsed(prev => prev.map(r => ({ ...r, selected: on })))
  }

  async function handleSave() {
    const toSave = parsed.filter(r => r.selected)
    if (toSave.length === 0) return
    setSaving(true)
    setParseError('')

    const { data: sessionData } = await supabase.auth.getSession()
    const user = sessionData.session?.user
    if (!user) { navigate('/'); return }

    const mergedTimes: Record<string, string> = { ...(user.user_metadata?.times ?? {}) }
    const mergedHistory: Record<string, SwimEntry[]> = { ...(user.user_metadata?.timeHistory ?? {}) }

    for (const row of toSave) {
      mergedTimes[row.key] = row.bestTime
      const hist = [...(mergedHistory[row.key] ?? [])]
      for (const entry of row.entries) {
        if (!hist.some(e => e.date === entry.date && e.time === entry.time)) {
          hist.push(entry)
        }
      }
      mergedHistory[row.key] = hist
    }

    try {
      const { error } = await supabase.auth.updateUser({
        data: { times: mergedTimes, timeHistory: mergedHistory },
      })
      if (error) throw new Error(error.message)
    } catch (err) {
      setSaving(false)
      setParseError(
        `Save failed: ${err instanceof Error ? err.message : 'unknown error'}. ` +
        `Check your connection and try again.`
      )
      return
    }
    setSaving(false)
    navigate('/dashboard')
  }

  const selectedCount = parsed.filter(r => r.selected).length
  const totalEntries  = parsed.filter(r => r.selected).reduce((s, r) => s + r.entries.length, 0)
  const withDates     = parsed.filter(r => r.selected).reduce((s, r) => s + r.entries.filter(e => e.date !== 'unknown').length, 0)

  // ── Paste step ──────────────────────────────────────────────────────────
  if (step === 'paste') return (
    <div className="import-page">
      <div className="import-header">
        <button className="import-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} />
          Dashboard
        </button>
        <h1 className="import-title">Import Times</h1>
        <img src="/logos/scs.svg" alt="Southern California Swimming" className="scs-logo-corner" />
      </div>

      <div className="import-body">

        <div className="import-notice import-notice--info">
          <Info size={16} className="import-notice-icon" />
          <div>
            <strong>Imports your full progression</strong> — every swim with its date, not just your best times.
            All entries are saved to your Progress Tracker so you can see your improvement over time.
          </div>
        </div>

        <div className="import-notice import-notice--recommend">
          <span className="import-recommend-badge">Recommended</span>
          <div>
            <strong>Use Swimcloud for your full career history.</strong> Go to swimcloud.com, search your name, open your profile's <em>Times</em> tab, and copy the full table.
          </div>
        </div>

        {/* ── Source tabs ── */}
        <div className="import-card">
          <div className="import-source-tabs">
            <button
              className={`import-source-tab${source === 'swimstandards' ? ' active' : ''}`}
              onClick={() => setSource('swimstandards')}
            >Swim Standards</button>
            <button
              className={`import-source-tab${source === 'usaswim' ? ' active' : ''}`}
              onClick={() => setSource('usaswim')}
            >USA Swimming</button>
            <button
              className={`import-source-tab${source === 'swimcloud' ? ' active' : ''}`}
              onClick={() => setSource('swimcloud')}
            >Swimcloud</button>
            <button
              className={`import-source-tab import-source-tab--pdf${source === 'pdf' ? ' active' : ''}`}
              onClick={() => setSource('pdf')}
            ><FileText size={13} /> PDF Results</button>
          </div>

          {source === 'swimstandards' && (
            <ol className="import-steps">
              <li>Go to <strong>swimstandards.com/swimmer/[your-name]</strong> — search for your profile if you don't have the link.</li>
              <li>Scroll down to the <strong>Progression</strong> section. Each event has a table showing every recorded swim with its date and time.</li>
              <li>Click inside the progression table for the event you want, then <strong>Select All</strong> (Ctrl+A / Cmd+A) and <strong>Copy</strong> (Ctrl+C / Cmd+C).</li>
              <li>Paste below. Repeat for each event, or open multiple events and copy them all at once.</li>
              <li className="import-step-note"><Info size={13} />Swim Standards includes the date for each swim — these will be automatically detected.</li>
              <li className="import-step-note"><AlertTriangle size={13} />Make sure each row has the <strong>course</strong> (SCY, LCM, or SCM) visible.</li>
            </ol>
          )}

          {source === 'usaswim' && (
            <ol className="import-steps">
              <li>Go to <strong>usaswimming.org</strong> → Times → Individual Times Search</li>
              <li>Enter your first and last name. Set <strong>Course</strong> to <em>All Courses</em>.</li>
              <li>Click <strong>Search</strong>, then click inside the results table and Select All (Ctrl+A / Cmd+A).</li>
              <li>Copy (Ctrl+C / Cmd+C), then paste in the box below.</li>
              <li className="import-step-note"><Info size={13} />USA Swimming shows every recorded swim with dates.</li>
              <li className="import-step-note"><AlertTriangle size={13} />You may need to be <strong>logged in</strong> to USA Swimming to see your full history.</li>
            </ol>
          )}

          {source === 'swimcloud' && (
            <>
              {/* ── Mode toggle ── */}
              <div className="import-mode-toggle">
                <button
                  className={`import-mode-btn${swimcloudMode === 'history' ? ' active' : ''}`}
                  onClick={() => setSwimcloudMode('history')}
                >
                  Full career history
                </button>
                <button
                  className={`import-mode-btn${swimcloudMode === 'meet' ? ' active' : ''}`}
                  onClick={() => setSwimcloudMode('meet')}
                >
                  Meet results
                </button>
              </div>

              {swimcloudMode === 'history' && (
                <>
                  <ol className="import-steps">
                    <li>Go to <strong>swimcloud.com</strong> and find your swimmer profile.</li>
                    <li>Click the <strong>Times</strong> tab and copy the time rows for each event you want to import.</li>
                    <li>Paste them below, with a <strong>blank line between each event's block</strong>. Then use the event list below to tell the parser which event each block belongs to.</li>
                    <li className="import-step-note"><Info size={13} /><span>If your copy includes an event header line (e.g. <code>100 FREE SCY:</code>), the parser will detect it automatically — you can leave the list below empty.</span></li>
                    <li className="import-step-note"><AlertTriangle size={13} /><span>Use the per-event Times tab, not the Best Times comparison table (which mixes courses on the same row).</span></li>
                  </ol>

                  {/* ── Manual event mapping ── */}
                  <div className="import-mapping-block">
                    <div className="import-mapping-header">
                      <span className="import-mapping-title">Event order</span>
                      <span className="import-mapping-hint">Match each block (separated by a blank line) to its event. Leave empty if your data has event header lines.</span>
                    </div>

                    {eventMappings.map((m, idx) => (
                      <div key={m.id} className="import-mapping-row">
                        <span className="import-mapping-num">Block {idx + 1}</span>
                        <select
                          className="import-mapping-select import-mapping-select--course"
                          value={m.course}
                          onChange={e => updateMapping(m.id, 'course', e.target.value)}
                        >
                          <option value="SCY">SCY</option>
                          <option value="LCM">LCM</option>
                          <option value="SCM">SCM</option>
                        </select>
                        <select
                          className="import-mapping-select import-mapping-select--event"
                          value={m.eventId}
                          onChange={e => updateMapping(m.id, 'eventId', e.target.value)}
                        >
                          <option value="">— pick event —</option>
                          {GROUPED_EVENTS.map(g => (
                            <optgroup key={g.group} label={g.group}>
                              {g.events.map(([id, label]) => (
                                <option key={id} value={id}>{label}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        {eventMappings.length > 1 && (
                          <button
                            className="import-mapping-remove"
                            onClick={() => removeMapping(m.id)}
                            aria-label="Remove"
                          >×</button>
                        )}
                      </div>
                    ))}

                    <button className="import-mapping-add" onClick={addMapping}>
                      + Add event block
                    </button>
                  </div>
                </>
              )}

              {swimcloudMode === 'meet' && (
                <div className="import-meet-section">
                  <ol className="import-steps">
                    <li>On Swimcloud, open a meet result page and find the event results table for your swims.</li>
                    <li>Copy the rows (Event / Time / Imp / Place columns) and paste into the box below. One meet per block.</li>
                    <li>Enter the meet name and the date you swam. Use <strong>Add another meet</strong> to import multiple meets at once.</li>
                    <li className="import-step-note"><Info size={13} /><span>Events with "Y" in the name are imported as SCY; events with "M" are imported as LCM.</span></li>
                  </ol>

                  {meets.map((meet, idx) => (
                    <div key={meet.id} className="import-meet-block">
                      <div className="import-meet-block-header">
                        <span className="import-meet-block-num">Meet {idx + 1}</span>
                        {meets.length > 1 && (
                          <button className="import-meet-remove" onClick={() => removeMeet(meet.id)}>Remove</button>
                        )}
                      </div>
                      <div className="import-meet-fields">
                        <div className="import-meet-field">
                          <label className="import-label">Meet name</label>
                          <input
                            className="import-meet-name"
                            type="text"
                            placeholder="e.g. SCS JAG Championships"
                            value={meet.name}
                            onChange={e => updateMeet(meet.id, 'name', e.target.value)}
                          />
                        </div>
                        <div className="import-meet-field import-meet-field--date">
                          <label className="import-label">Date swum</label>
                          <input
                            className="import-meet-date"
                            type="date"
                            value={meet.date}
                            max={new Date().toISOString().slice(0, 10)}
                            onChange={e => updateMeet(meet.id, 'date', e.target.value)}
                          />
                        </div>
                      </div>
                      <textarea
                        className="import-textarea import-meet-textarea"
                        placeholder={`Event\tTime\tImp\tPlace\n100 Y Free\t1:00.55\t–\t18th\n50 Y Free\t26.83\t-2.00\t19th`}
                        value={meet.text}
                        onChange={e => updateMeet(meet.id, 'text', e.target.value)}
                        rows={6}
                      />
                    </div>
                  ))}

                  <button className="import-mapping-add import-meet-add-btn" onClick={addMeet}>
                    + Add another meet
                  </button>

                  {parseError && (
                    <p className="import-error">
                      <AlertTriangle size={14} />
                      {parseError}
                    </p>
                  )}

                  <div className="import-actions">
                    <button
                      className="import-parse-btn"
                      onClick={handleParse}
                      disabled={meets.every(m => !m.text.trim())}
                    >
                      Parse Meet Times
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {source === 'pdf' && (
            <div className="import-pdf-instructions">
              <p>Upload any <strong>swim meet result sheet PDF</strong> — Hy-Tek, CTS, Meet Mobile, or any standard USA Swimming results file. The parser reads the event headers and pulls out your times.</p>
              <ol className="import-steps">
                <li>Get your meet result PDF from <strong>Meet Mobile</strong>, your <strong>club's website</strong>, or the meet host's results page.</li>
                <li>Enter your name below so the parser only pulls <em>your</em> rows from a full-field result sheet.</li>
                <li>Drop the PDF in the zone below (or click Browse) and hit <strong>Parse PDF</strong>.</li>
                <li className="import-step-note"><AlertTriangle size={13} />The PDF must contain <strong>selectable text</strong> — scanned images cannot be read. If you can highlight text in the PDF, it will work.</li>
                <li className="import-step-note"><AlertTriangle size={13} />Password-protected PDFs cannot be read.</li>
              </ol>
            </div>
          )}
        </div>

        {/* ── Swimmer name (shown for PDF, optional for others) ── */}
        {source === 'pdf' && (
          <div className="import-card">
            <label className="import-label">Your name (as it appears in the results)</label>
            <input
              className="import-name-input"
              type="text"
              placeholder="e.g. Smith, John or John Smith"
              value={swimmerName}
              onChange={e => setSwimmerName(e.target.value)}
            />
            <p className="import-name-hint">This filters the PDF to only import rows matching your name. Leave blank to import all times found.</p>
          </div>
        )}

        {/* ── PDF drop zone ── */}
        {source === 'pdf' && (
          <div className="import-card">
            <label className="import-label">Upload PDF result sheet</label>
            <div
              className={`import-dropzone${dragOver ? ' import-dropzone--over' : ''}${pdfFile ? ' import-dropzone--has-file' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: 'none' }}
                onChange={handleFileInput}
              />
              {pdfFile ? (
                <>
                  <FileText size={28} className="import-dropzone-icon import-dropzone-icon--file" />
                  <p className="import-dropzone-filename">{pdfFile.name}</p>
                  <p className="import-dropzone-sub">{(pdfFile.size / 1024).toFixed(0)} KB — click to change</p>
                </>
              ) : (
                <>
                  <Upload size={28} className="import-dropzone-icon" />
                  <p className="import-dropzone-label">Drop PDF here or click to browse</p>
                  <p className="import-dropzone-sub">Hy-Tek, CTS, Meet Mobile result sheets supported</p>
                </>
              )}
            </div>

            {parseError && (
              <p className="import-error">
                <AlertTriangle size={14} />
                {parseError}
              </p>
            )}

            <div className="import-actions">
              <button
                className="import-parse-btn"
                onClick={handlePdfParse}
                disabled={!pdfFile || pdfLoading}
              >
                {pdfLoading ? 'Reading PDF…' : 'Parse PDF'}
              </button>
            </div>
          </div>
        )}

        {/* ── Paste area (text sources) ── */}
        {source !== 'pdf' && !(source === 'swimcloud' && swimcloudMode === 'meet') && (
          <div className="import-card">
            <label className="import-label">Paste your times here</label>
            <textarea
              className="import-textarea"
              placeholder="Paste your copied times here…

Each row should contain an event name (e.g. '100 Freestyle'), a course (SCY / LCM / SCM), and a time (e.g. 52.34 or 1:52.34). Dates are detected automatically when present."
              value={rawText}
              onChange={e => { setRawText(e.target.value); setParseError('') }}
              rows={12}
            />
            {parseError && (
              <p className="import-error">
                <AlertTriangle size={14} />
                {parseError}
              </p>
            )}
            <div className="import-actions">
              <button
                className="import-parse-btn"
                onClick={handleParse}
                disabled={!rawText.trim()}
              >
                Parse Times
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )

  // ── Review step ─────────────────────────────────────────────────────────
  const allSelected = parsed.every(r => r.selected)

  return (
    <div className="import-page">
      <div className="import-header">
        <button className="import-back" onClick={() => setStep('paste')}>
          <ArrowLeft size={16} />
          Back
        </button>
        <h1 className="import-title">Review Times</h1>
        <img src="/logos/scs.svg" alt="Southern California Swimming" className="scs-logo-corner" />
      </div>

      <div className="import-body">

        <div className="import-notice import-notice--info">
          <CheckCircle2 size={16} className="import-notice-icon" />
          <div>
            Found <strong>{parsed.length}</strong> event{parsed.length !== 1 ? 's' : ''} with <strong>{totalEntries}</strong> total swim{totalEntries !== 1 ? 's' : ''} ({withDates} with dates).
            Each swim will be added to your Progress Tracker. Your dashboard PR will be set to the fastest imported time per event.
          </div>
        </div>

        <div className="import-card">
          <div className="import-review-toolbar">
            <label className="import-select-all">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={e => toggleAll(e.target.checked)}
              />
              {allSelected ? 'Deselect all' : 'Select all'}
            </label>
            <span className="import-count">{selectedCount} of {parsed.length} selected</span>
          </div>

          <div className="import-table">
            <div className="import-table-head">
              <span />
              <span>Course</span>
              <span>Event</span>
              <span>Best Time</span>
              <span>Swims</span>
              <span>Current PR</span>
            </div>

            {parsed.map(row => {
              const curr    = existing[row.key] || ''
              const currSec = curr ? toSec(curr) : null
              const newSec  = toSec(row.bestTime)
              const isFaster = currSec !== null && newSec < currSec
              const isSlower = currSec !== null && newSec > currSec
              const datedCount = row.entries.filter(e => e.date !== 'unknown').length

              return (
                <label key={row.key} className={`import-row${row.selected ? '' : ' import-row--unchecked'}`}>
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={() => toggleRow(row.key)}
                  />
                  <span className={`import-course-badge import-course-badge--${row.course.toLowerCase()}`}>
                    {row.course}
                  </span>
                  <span className="import-event">{row.eventLabel}</span>
                  <span className={`import-time-new${isFaster ? ' import-time-new--faster' : isSlower ? ' import-time-new--slower' : ''}`}>
                    {row.bestTime}
                    {isFaster && <span className="import-tag import-tag--faster">↑ PR</span>}
                    {isSlower && <span className="import-tag import-tag--slower">↓ slower</span>}
                  </span>
                  <span className="import-swims-count">
                    {row.entries.length}
                    {datedCount < row.entries.length && (
                      <span className="import-undated" title={`${row.entries.length - datedCount} without a date`}> ⚠</span>
                    )}
                  </span>
                  <span className="import-time-curr">{curr || '—'}</span>
                </label>
              )
            })}
          </div>

          {parseError && (
            <p className="import-error">
              <AlertTriangle size={14} />
              {parseError}
            </p>
          )}

          <div className="import-actions import-actions--review">
            <button className="import-cancel-btn" onClick={() => setStep('paste')}>
              ← Edit
            </button>
            <button
              className="import-save-btn"
              onClick={handleSave}
              disabled={selectedCount === 0 || saving}
            >
              {saving ? 'Saving…' : `Save ${selectedCount} event${selectedCount !== 1 ? 's' : ''} · ${totalEntries} swim${totalEntries !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
