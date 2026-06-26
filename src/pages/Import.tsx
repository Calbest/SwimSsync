import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './Import.css'

// ─── Parser ────────────────────────────────────────────────────────────────

type Course = 'SCY' | 'LCM' | 'SCM'

interface ParsedRow {
  key: string
  course: Course
  eventId: string
  eventLabel: string
  time: string
  selected: boolean
}

// Ordered longest-first so "1650 Free" matches before "50 Free"
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
const TIME_RE   = /\b(\d{1,2}:\d{2}\.\d{2}|\d{1,2}\.\d{2})\b/
// Exclude obvious non-times like dates (e.g. "01/15") and years
const SKIP_LINE = /^(event|course|standard|meet name|club|lsc|date|age|time\b|swimmer|name\b)/i

function toSec(t: string): number {
  const p = t.split(':')
  return p.length === 2 ? parseFloat(p[0]) * 60 + parseFloat(p[1]) : parseFloat(t)
}

function parseRawText(raw: string): ParsedRow[] {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  const best  = new Map<string, ParsedRow>()

  for (const line of lines) {
    if (SKIP_LINE.test(line)) continue

    const timeMatch = line.match(TIME_RE)
    if (!timeMatch) continue

    const courseMatch = line.match(COURSE_RE)
    if (!courseMatch) continue
    const course = courseMatch[1].toUpperCase() as Course

    let foundEvent: [string, string] | null = null
    for (const [re, id, label] of EVENT_PATTERNS) {
      if (re.test(line)) { foundEvent = [id, label]; break }
    }
    if (!foundEvent) continue

    const [eventId, eventLabel] = foundEvent
    const time = timeMatch[1]
    const key  = `${course}-${eventId}`

    const existing = best.get(key)
    if (!existing || toSec(time) < toSec(existing.time)) {
      best.set(key, { key, course, eventId, eventLabel, time, selected: true })
    }
  }

  const ORDER: Course[] = ['SCY', 'LCM', 'SCM']
  const EVENT_ORDER = EVENT_PATTERNS.map(([,id]) => id)
  return Array.from(best.values()).sort((a, b) => {
    const ci = ORDER.indexOf(a.course) - ORDER.indexOf(b.course)
    if (ci !== 0) return ci
    return EVENT_ORDER.indexOf(a.eventId) - EVENT_ORDER.indexOf(b.eventId)
  })
}

// ─── Component ─────────────────────────────────────────────────────────────

type Step   = 'paste' | 'review'
type Source = 'usaswim' | 'swimcloud'

export default function Import() {
  const navigate = useNavigate()
  const [step,       setStep]       = useState<Step>('paste')
  const [source,     setSource]     = useState<Source>('usaswim')
  const [rawText,    setRawText]    = useState('')
  const [parsed,     setParsed]     = useState<ParsedRow[]>([])
  const [existing,   setExisting]   = useState<Record<string, string>>({})
  const [parseError, setParseError] = useState('')
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      if (!user) { navigate('/'); return }
      setExisting(user.user_metadata?.times ?? {})
    })
  }, [navigate])

  function handleParse() {
    setParseError('')
    const rows = parseRawText(rawText)
    if (rows.length === 0) {
      setParseError(
        'No times found. Make sure your copied text includes an event name, ' +
        'a course (SCY / LCM / SCM), and a time on each row. See the instructions above.'
      )
      return
    }
    setParsed(rows)
    setStep('review')
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
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    if (!user) { navigate('/'); return }

    const today = new Date().toISOString().slice(0, 10)
    const mergedTimes: Record<string, string> = { ...(user.user_metadata?.times ?? {}) }
    const mergedHistory: Record<string, { date: string; time: string }[]> =
      { ...(user.user_metadata?.timeHistory ?? {}) }

    for (const row of toSave) {
      mergedTimes[row.key] = row.time
      const existing = mergedHistory[row.key] ?? []
      // Skip if this exact time was already recorded today
      if (!existing.some(e => e.date === today && e.time === row.time)) {
        mergedHistory[row.key] = [...existing, { date: today, time: row.time }]
      }
    }

    await supabase.auth.updateUser({ data: { times: mergedTimes, timeHistory: mergedHistory } })
    setSaving(false)
    navigate('/dashboard')
  }

  const selectedCount = parsed.filter(r => r.selected).length

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

        {/* ── Notices ── */}
        <div className="import-notice import-notice--info">
          <Info size={16} className="import-notice-icon" />
          <div>
            <strong>No setup required.</strong> This is a free, client-side text parser —
            no API key or account needed. Copy your times from a browser tab and paste
            them below.
          </div>
        </div>

        <div className="import-notice import-notice--warn">
          <AlertTriangle size={16} className="import-notice-icon" />
          <div>
            <strong>Before you import:</strong> Each line in your pasted text must include
            an <strong>event name</strong> (e.g. "100 Freestyle"), a <strong>course</strong>{' '}
            (SCY, LCM, or SCM), and a <strong>time</strong> (e.g. 52.34 or 1:52.34)
            on the <em>same row</em>. If course is missing from a row, that row will be skipped.
            Always review before saving.
          </div>
        </div>

        {/* ── Source tabs + instructions ── */}
        <div className="import-card">
          <div className="import-source-tabs">
            <button
              className={`import-source-tab${source === 'usaswim' ? ' active' : ''}`}
              onClick={() => setSource('usaswim')}
            >USA Swimming</button>
            <button
              className={`import-source-tab${source === 'swimcloud' ? ' active' : ''}`}
              onClick={() => setSource('swimcloud')}
            >Swimcloud</button>
          </div>

          {source === 'usaswim' ? (
            <ol className="import-steps">
              <li>Go to <strong>usaswimming.org</strong> → Times → Individual Times Search</li>
              <li>Enter your first and last name. Set <strong>Course</strong> to <em>All Courses</em> so SCY, LCM, and SCM all appear.</li>
              <li>Click <strong>Search</strong> and wait for the results table to load.</li>
              <li>Click anywhere inside the results table, then <strong>Select All</strong> (Ctrl+A / Cmd+A).</li>
              <li>Copy (Ctrl+C / Cmd+C), then paste in the box below.</li>
              <li className="import-step-note">
                <AlertTriangle size={13} />
                You may need to be <strong>logged in</strong> to USA Swimming to see your full history.
                If no times appear, create a free account and link your swimmer profile.
              </li>
              <li className="import-step-note">
                <AlertTriangle size={13} />
                USA Swimming shows <strong>every recorded swim</strong>, not just your bests.
                The importer automatically keeps the <strong>fastest time</strong> per event per course.
              </li>
            </ol>
          ) : (
            <ol className="import-steps">
              <li>Go to <strong>swimcloud.com</strong> and find your swimmer profile.</li>
              <li>Click the <strong>Times</strong> tab (the full meet-by-meet list, not the Best Times summary table).</li>
              <li>Select all text in the times table (Ctrl+A / Cmd+A inside the table).</li>
              <li>Copy (Ctrl+C / Cmd+C), then paste in the box below.</li>
              <li className="import-step-note">
                <AlertTriangle size={13} />
                <span>Swimcloud's Best Times comparison table puts SCY and LCM on the <strong>same row</strong>, which can confuse the parser. The individual Times tab (one row per swim) works much better.</span>
              </li>
              <li className="import-step-note">
                <AlertTriangle size={13} />
                <span>Your Swimcloud profile must be <strong>public</strong>, or you must be logged in, to see times.</span>
              </li>
            </ol>
          )}
        </div>

        {/* ── Paste area ── */}
        <div className="import-card">
          <label className="import-label">Paste your times here</label>
          <textarea
            className="import-textarea"
            placeholder={
              source === 'usaswim'
                ? 'Paste your USA Swimming results here…\n\nExample of what a copied row might look like:\n50 Freestyle\tSCY\tA\t23.45\tJanuary 15, 2025\t17\tSome Meet\tYour Club\tPC'
                : 'Paste your Swimcloud times here…\n\nExample of what a copied row might look like:\n50 Freestyle\t23.45\tSCY\tJan 2025\tSome Meet'
            }
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
            Found <strong>{parsed.length}</strong> unique event{parsed.length !== 1 ? 's' : ''}.
            Check the rows below, uncheck anything that looks wrong, then click Save.
            Saving will <strong>overwrite</strong> your existing time for each checked event
            and <strong>add a dated entry</strong> to your Progress history automatically.
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
              <span>Imported Time</span>
              <span>Current Time</span>
            </div>

            {parsed.map(row => {
              const curr = existing[row.key] || ''
              const currSec = curr ? toSec(curr) : null
              const newSec  = toSec(row.time)
              const isFaster = currSec !== null && newSec < currSec
              const isSlower = currSec !== null && newSec > currSec

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
                    {row.time}
                    {isFaster && <span className="import-tag import-tag--faster">↑ PR</span>}
                    {isSlower && <span className="import-tag import-tag--slower">↓ slower</span>}
                  </span>
                  <span className="import-time-curr">{curr || '—'}</span>
                </label>
              )
            })}
          </div>

          <div className="import-actions import-actions--review">
            <button className="import-cancel-btn" onClick={() => setStep('paste')}>
              ← Edit Paste
            </button>
            <button
              className="import-save-btn"
              onClick={handleSave}
              disabled={selectedCount === 0 || saving}
            >
              {saving ? 'Saving…' : `Save ${selectedCount} time${selectedCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
