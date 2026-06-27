import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, Clock, Star, Copy, Check, BookOpen, CalendarCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SCS_STANDARDS, getAgeGroup, getCut, type StdLevel } from '../lib/scsStandards'
import ColorLegend from '../components/ColorLegend'
import TimeConverterPopup from '../components/TimeConverterPopup'
import './EventPlanning.css'

// ── Types ────────────────────────────────────────────────────────────────────

type Course    = 'SCY' | 'LCM' | 'SCM'
type Proximity = 'met' | 'close' | 'near' | 'far' | 'very-far' | 'no-time' | 'no-cut'
type Staleness = 'fresh' | 'aging' | 'stale' | 'unknown'
type Rec       = 'enter' | 'consider' | 'skip' | 'no-time'
type RecFilter = 'all' | 'enter' | 'consider' | 'skip'

interface GoalEntry { course: Course; eventId: string; targetTime: string }
interface HistEntry { date: string; time: string }

interface EventAnalysis {
  eventId: string
  fullLabel: string
  stroke: string
  key: string
  userTime: string
  userSec: number | null
  staleness: Staleness
  lastSwum: string | null
  daysAgo: number | null
  cutTime: string
  cutSec: number | null
  proximity: Proximity
  gap: string
  goalTime: string
  goalMeetsCut: boolean
  rec: Rec
}

// ── Event groups (mirrors Compare.tsx) ───────────────────────────────────────

const SCY_GROUPS = [
  { stroke: 'Freestyle', events: [
    { id: '50-free', label: '50 Free' }, { id: '100-free', label: '100 Free' },
    { id: '200-free', label: '200 Free' }, { id: '500-free', label: '500 Free' },
    { id: '1000-free', label: '1000 Free' }, { id: '1650-free', label: '1650 Free' },
  ]},
  { stroke: 'Backstroke', events: [
    { id: '50-back', label: '50 Back' }, { id: '100-back', label: '100 Back' }, { id: '200-back', label: '200 Back' },
  ]},
  { stroke: 'Breaststroke', events: [
    { id: '50-breast', label: '50 Breast' }, { id: '100-breast', label: '100 Breast' }, { id: '200-breast', label: '200 Breast' },
  ]},
  { stroke: 'Butterfly', events: [
    { id: '50-fly', label: '50 Fly' }, { id: '100-fly', label: '100 Fly' }, { id: '200-fly', label: '200 Fly' },
  ]},
  { stroke: 'Individual Medley', events: [
    { id: '100-im', label: '100 IM' }, { id: '200-im', label: '200 IM' }, { id: '400-im', label: '400 IM' },
  ]},
]

const LCM_GROUPS = [
  { stroke: 'Freestyle', events: [
    { id: '50-free', label: '50 Free' }, { id: '100-free', label: '100 Free' },
    { id: '200-free', label: '200 Free' }, { id: '400-free', label: '400 Free' },
    { id: '800-free', label: '800 Free' }, { id: '1500-free', label: '1500 Free' },
  ]},
  { stroke: 'Backstroke', events: [
    { id: '50-back', label: '50 Back' }, { id: '100-back', label: '100 Back' }, { id: '200-back', label: '200 Back' },
  ]},
  { stroke: 'Breaststroke', events: [
    { id: '50-breast', label: '50 Breast' }, { id: '100-breast', label: '100 Breast' }, { id: '200-breast', label: '200 Breast' },
  ]},
  { stroke: 'Butterfly', events: [
    { id: '50-fly', label: '50 Fly' }, { id: '100-fly', label: '100 Fly' }, { id: '200-fly', label: '200 Fly' },
  ]},
  { stroke: 'Individual Medley', events: [
    { id: '200-im', label: '200 IM' }, { id: '400-im', label: '400 IM' },
  ]},
]

const SCM_GROUPS = LCM_GROUPS

// Longest-first to avoid "50 Free" matching inside "1650 Free"
const EVENT_PATTERNS: Array<[RegExp, string]> = [
  [/\b1650\s*(freestyle|free|fr)\b/i, '1650-free'],
  [/\b1500\s*(freestyle|free|fr)\b/i, '1500-free'],
  [/\b1000\s*(freestyle|free|fr)\b/i, '1000-free'],
  [/\b800\s*(freestyle|free|fr)\b/i,  '800-free'],
  [/\b500\s*(freestyle|free|fr)\b/i,  '500-free'],
  [/\b400\s*(freestyle|free|fr)\b/i,  '400-free'],
  [/\b400\s*(individual\s*medley|i\.?m\.?|im)\b/i, '400-im'],
  [/\b200\s*(individual\s*medley|i\.?m\.?|im)\b/i, '200-im'],
  [/\b200\s*(freestyle|free|fr)\b/i,  '200-free'],
  [/\b200\s*(backstroke|back|bk)\b/i, '200-back'],
  [/\b200\s*(breaststroke|breast|br)\b/i, '200-breast'],
  [/\b200\s*(butterfly|fly|fl)\b/i,   '200-fly'],
  [/\b100\s*(individual\s*medley|i\.?m\.?|im)\b/i, '100-im'],
  [/\b100\s*(freestyle|free|fr)\b/i,  '100-free'],
  [/\b100\s*(backstroke|back|bk)\b/i, '100-back'],
  [/\b100\s*(breaststroke|breast|br)\b/i, '100-breast'],
  [/\b100\s*(butterfly|fly|fl)\b/i,   '100-fly'],
  [/\b50\s*(freestyle|free|fr)\b/i,   '50-free'],
  [/\b50\s*(backstroke|back|bk)\b/i,  '50-back'],
  [/\b50\s*(breaststroke|breast|br)\b/i, '50-breast'],
  [/\b50\s*(butterfly|fly|fl)\b/i,    '50-fly'],
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function toSec(t: string): number | null {
  if (!t || t === '—') return null
  const p = t.split(':')
  return p.length === 2 ? parseFloat(p[0]) * 60 + parseFloat(p[1]) : parseFloat(t)
}

function fmtGap(userSec: number, cutSec: number): string {
  const g = userSec - cutSec
  if (g <= 0) return ''
  if (g < 60) return `+${g.toFixed(2)}s`
  const m = Math.floor(g / 60)
  const s = (g % 60).toFixed(2).padStart(5, '0')
  return `+${m}:${s}`
}

function calcAge(dob: string): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function getProximity(userSec: number | null, cutSec: number | null, userTime: string): Proximity {
  if (!userTime || userSec === null) return 'no-time'
  if (cutSec === null) return 'no-cut'
  const pct = (userSec - cutSec) / cutSec * 100
  if (pct <= 0)  return 'met'
  if (pct <= 3)  return 'close'
  if (pct <= 7)  return 'near'
  if (pct <= 15) return 'far'
  return 'very-far'
}

function getStaleness(key: string, history: Record<string, HistEntry[]>) {
  const entries = history[key]
  if (!entries || entries.length === 0) return { staleness: 'unknown' as Staleness, lastSwum: null, daysAgo: null }
  const sorted  = [...entries].sort((a, b) => b.date.localeCompare(a.date))
  const last    = sorted[0].date
  const daysAgo = Math.floor((Date.now() - new Date(last + 'T12:00:00').getTime()) / 86_400_000)
  const staleness: Staleness = daysAgo < 90 ? 'fresh' : daysAgo < 180 ? 'aging' : 'stale'
  return { staleness, lastSwum: last, daysAgo }
}

function getRec(proximity: Proximity, staleness: Staleness): Rec {
  if (proximity === 'no-time') return 'no-time'
  if (proximity === 'very-far') return 'skip'
  if (proximity === 'no-cut') return 'consider'
  if (proximity === 'far') return staleness === 'fresh' ? 'consider' : 'skip'
  if (staleness === 'stale') return 'consider'
  if (proximity === 'near') return 'consider'
  return 'enter'  // met or close, fresh/aging/unknown
}

function parseMeetEvents(raw: string, course: Course): string[] {
  const groups = course === 'SCY' ? SCY_GROUPS : course === 'LCM' ? LCM_GROUPS : SCM_GROUPS
  const validIds = new Set(groups.flatMap(g => g.events.map(e => e.id)))
  const found = new Set<string>()
  for (const line of raw.split('\n')) {
    for (const [re, id] of EVENT_PATTERNS) {
      if (re.test(line) && validIds.has(id)) found.add(id)
    }
  }
  // Return in canonical stroke/distance order
  return groups.flatMap(g => g.events.map(e => e.id)).filter(id => found.has(id))
}

const PROX_RANK: Record<Proximity, number> = {
  met: 0, close: 1, near: 2, far: 3, 'very-far': 4, 'no-cut': 5, 'no-time': 6,
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StalenessIcon({ staleness, daysAgo, lastSwum }: { staleness: Staleness; daysAgo: number | null; lastSwum: string | null }) {
  if (staleness === 'fresh') return null
  const fmtDate = lastSwum ? new Date(lastSwum + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
  const tooltip =
    staleness === 'unknown'
      ? 'No race history found — this time may have been entered manually without a recorded date. Consider the accuracy of this time when selecting events.'
      : staleness === 'aging'
      ? `Swum ${daysAgo} days ago (${fmtDate}). Time is getting older — if your fitness has changed significantly, keep this in mind.`
      : `Last swum ${Math.floor(daysAgo! / 30)} months ago (${fmtDate}). This time may no longer reflect current fitness. Weigh this when picking events.`
  return (
    <span className={`ep-stale ep-stale--${staleness}`} title={tooltip}>
      <Clock size={12} />
    </span>
  )
}

function RecBadge({ rec }: { rec: Rec }) {
  const map: Record<Rec, { label: string; cls: string }> = {
    enter:    { label: 'Enter',    cls: 'ep-rec--enter' },
    consider: { label: 'Consider', cls: 'ep-rec--consider' },
    skip:     { label: 'Skip',     cls: 'ep-rec--skip' },
    'no-time':{ label: 'No Time',  cls: 'ep-rec--notime' },
  }
  const { label, cls } = map[rec]
  return <span className={`ep-rec ${cls}`}>{label}</span>
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EventPlanning() {
  const navigate = useNavigate()

  // User data
  const [times,   setTimes]   = useState<Record<string, string>>({})
  const [history, setHistory] = useState<Record<string, HistEntry[]>>({})
  const [goals,   setGoals]   = useState<GoalEntry[]>([])
  const [dob,     setDob]     = useState('')
  const [gender,  setGender]  = useState('')

  // Meet setup
  const [meetName,      setMeetName]      = useState('')
  const [meetDate,      setMeetDate]      = useState('')
  const [course,        setCourse]        = useState<Course>('SCY')
  const [entryDeadline, setEntryDeadline] = useState('')
  const [standard,      setStandard]      = useState<StdLevel>('a')
  const [calSaved,      setCalSaved]      = useState(false)

  // Event selection
  const [selMode,        setSelMode]        = useState<'paste' | 'manual'>('paste')
  const [pasteText,      setPasteText]      = useState('')
  const [parseError,     setParseError]     = useState('')
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set())

  // Analysis controls
  const [recFilter,   setRecFilter]   = useState<RecFilter>('all')
  const [copied,      setCopied]      = useState(false)
  const [showLegend,  setShowLegend]  = useState(false)
  const [showTC,      setShowTC]      = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      if (!user) { navigate('/'); return }
      const m = user.user_metadata ?? {}
      setTimes(m.times ?? {})
      setHistory(m.timeHistory ?? {})
      setGoals((m.goals ?? []) as GoalEntry[])
      setDob(m.dob ?? '')
      setGender(m.gender ?? '')
    })
  }, [navigate])

  async function saveToCalendar() {
    if (!meetName.trim() || !meetDate) return
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    if (!user) return
    const existing: { id: string; name: string; date: string }[] = user.user_metadata?.calMeets ?? []
    const alreadyExists = existing.some(m => m.name === meetName.trim() && m.date === meetDate)
    if (alreadyExists) { setCalSaved(true); setTimeout(() => setCalSaved(false), 2500); return }
    const next = [...existing, { id: crypto.randomUUID(), name: meetName.trim(), date: meetDate }]
    await supabase.auth.updateUser({ data: { calMeets: next } })
    setCalSaved(true)
    setTimeout(() => setCalSaved(false), 2500)
  }

  // Age/standard setup (same pattern as Compare)
  const age       = calcAge(dob)
  const ageGroup  = getAgeGroup(age)
  const agData    = SCS_STANDARDS[ageGroup]
  const allLevels = agData?.levels ?? (['a', 'b'] as StdLevel[])
  const stdLabels = agData?.labels ?? { a: 'A Standard', b: 'B Standard' }
  const safeStd   = allLevels.includes(standard) ? standard : allLevels[0] ?? 'a'

  const groups    = course === 'SCY' ? SCY_GROUPS : course === 'LCM' ? LCM_GROUPS : SCM_GROUPS

  // Deadline countdown
  const daysUntilDeadline = useMemo(() => {
    if (!entryDeadline) return null
    return Math.ceil((new Date(entryDeadline + 'T12:00:00').getTime() - Date.now()) / 86_400_000)
  }, [entryDeadline])

  // Build analyses for all selected events
  const analyses = useMemo<EventAnalysis[]>(() => {
    return groups.flatMap(({ stroke, events }) =>
      events
        .filter(e => selectedIds.has(e.id))
        .map(e => {
          const key       = `${course}-${e.id}`
          const userTime  = times[key] || ''
          const userSec   = toSec(userTime)
          const cutTime   = getCut(ageGroup, gender, course, e.id, safeStd) || ''
          const cutSec    = toSec(cutTime)
          const proximity = getProximity(userSec, cutSec, userTime)
          const gap       = userSec !== null && cutSec !== null ? fmtGap(userSec, cutSec) : ''
          const { staleness, lastSwum, daysAgo } = getStaleness(key, history)
          const rec       = getRec(proximity, staleness)
          const goal      = goals.find(g => g.course === course && g.eventId === e.id)
          const goalSec   = toSec(goal?.targetTime ?? '')
          const goalMeetsCut = goalSec !== null && cutSec !== null && goalSec <= cutSec
          return {
            eventId: e.id,
            fullLabel: e.label,
            stroke,
            key,
            userTime,
            userSec,
            staleness,
            lastSwum,
            daysAgo,
            cutTime,
            cutSec,
            proximity,
            gap,
            goalTime: goal?.targetTime ?? '',
            goalMeetsCut,
            rec,
          }
        })
    )
  }, [selectedIds, times, history, goals, course, ageGroup, gender, safeStd, groups])

  // Best bets: enter events first, then consider, sorted by proximity within each
  const bestBets = useMemo(() => {
    return [...analyses]
      .filter(a => a.rec === 'enter' || a.rec === 'consider')
      .sort((a, b) => {
        const recOrder = { enter: 0, consider: 1, skip: 2, 'no-time': 3 }
        const rd = recOrder[a.rec] - recOrder[b.rec]
        if (rd !== 0) return rd
        return PROX_RANK[a.proximity] - PROX_RANK[b.proximity]
      })
      .slice(0, 4)
  }, [analyses])

  // Filtered rows for analysis table
  const filteredAnalyses = useMemo(() => {
    if (recFilter === 'all') return analyses
    return analyses.filter(a => a.rec === recFilter)
  }, [analyses, recFilter])

  // Change course — clear events that don't exist in new course
  function handleCourseChange(c: Course) {
    const newGroups   = c === 'SCY' ? SCY_GROUPS : c === 'LCM' ? LCM_GROUPS : SCM_GROUPS
    const validIds    = new Set(newGroups.flatMap(g => g.events.map(e => e.id)))
    setSelectedIds(prev => new Set([...prev].filter(id => validIds.has(id))))
    setCourse(c)
  }

  function handlePaste() {
    setParseError('')
    const ids = parseMeetEvents(pasteText, course)
    if (ids.length === 0) {
      setParseError('No recognized events found. Try including event names like "100 Freestyle", "200 Back", "400 IM".')
      return
    }
    setSelectedIds(new Set(ids))
  }

  function toggleEvent(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(groups.flatMap(g => g.events.map(e => e.id))))
  }

  function clearAll() {
    setSelectedIds(new Set())
  }

  function copyEnterEvents() {
    const list = analyses
      .filter(a => a.rec === 'enter')
      .map(a => `${a.fullLabel} (${a.userTime})`)
      .join('\n')
    if (!list) return
    navigator.clipboard.writeText(list).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const enterCount   = analyses.filter(a => a.rec === 'enter').length
  const considerCount = analyses.filter(a => a.rec === 'consider').length

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div className="ep-layout">

      {showLegend && <ColorLegend onClose={() => setShowLegend(false)} />}
      <TimeConverterPopup isOpen={showTC} onClose={() => setShowTC(false)} />

      {/* ── Sidebar ── */}
      <aside className="ep-sidebar">
        <div className="ep-sidebar-brand">Event Planning</div>
        <nav className="ep-sidebar-nav">
          <button className="ep-nav-btn" onClick={() => navigate('/dashboard')}>
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </button>
          <button className="ep-nav-btn" onClick={() => setShowLegend(true)}>
            <BookOpen size={16} />
            <span>Color Legend</span>
          </button>
        </nav>
      </aside>

      {/* ── Main ── */}
      <div className="ep-page">
        <div className="ep-header">
          <div className="ep-header-info">
            <h1 className="ep-title">Event Planning</h1>
            <p className="ep-subtitle">
              Compare your times to meet standards and find your best events
            </p>
          </div>
          <img src="/logos/scs.svg" alt="Southern California Swimming" className="scs-logo-corner" />
        </div>

        <div className="ep-body">

          {/* ── Meet Setup Card ── */}
          <div className="ep-card">
            <h2 className="ep-card-title">Meet Details</h2>

            <div className="ep-setup-grid">
              <div className="ep-field">
                <label className="ep-label">Meet Name</label>
                <input
                  className="ep-input"
                  type="text"
                  placeholder="e.g. 2025 Southern California Championships"
                  value={meetName}
                  onChange={e => setMeetName(e.target.value)}
                />
              </div>

              <div className="ep-field ep-field--sm">
                <label className="ep-label">Meet Date</label>
                <input
                  className="ep-input"
                  type="date"
                  value={meetDate}
                  onChange={e => setMeetDate(e.target.value)}
                />
              </div>

              <div className="ep-field ep-field--sm">
                <label className="ep-label">Entry Deadline</label>
                <input
                  className="ep-input"
                  type="date"
                  value={entryDeadline}
                  onChange={e => setEntryDeadline(e.target.value)}
                />
                {daysUntilDeadline !== null && (
                  <span className={`ep-deadline-chip ${daysUntilDeadline < 0 ? 'ep-deadline-chip--past' : daysUntilDeadline <= 7 ? 'ep-deadline-chip--urgent' : daysUntilDeadline <= 14 ? 'ep-deadline-chip--soon' : 'ep-deadline-chip--ok'}`}>
                    {daysUntilDeadline < 0
                      ? 'Deadline passed'
                      : daysUntilDeadline === 0
                      ? 'Due today!'
                      : `${daysUntilDeadline} day${daysUntilDeadline !== 1 ? 's' : ''} left`}
                  </span>
                )}
              </div>
            </div>

            {meetName.trim() && meetDate && (
              <button
                className={`ep-cal-btn${calSaved ? ' ep-cal-btn--saved' : ''}`}
                onClick={saveToCalendar}
              >
                {calSaved ? <><Check size={14} /> Saved to Calendar</> : <><CalendarCheck size={14} /> Save to Calendar</>}
              </button>
            )}

            <div className="ep-setup-row2">
              {/* Course */}
              <div className="ep-field">
                <label className="ep-label">Course</label>
                <div className="ep-tabs">
                  {(['SCY', 'LCM', 'SCM'] as Course[]).map(c => (
                    <button
                      key={c}
                      className={`ep-tab${course === c ? ' active' : ''}`}
                      onClick={() => handleCourseChange(c)}
                    >{c}</button>
                  ))}
                </div>
              </div>

              {/* Qualifying Standard */}
              <div className="ep-field">
                <label className="ep-label">Qualifying Standard</label>
                <select
                  className="ep-select"
                  value={safeStd}
                  onChange={e => setStandard(e.target.value as StdLevel)}
                >
                  {allLevels.map(lvl => (
                    <option key={lvl} value={lvl}>{stdLabels[lvl] ?? lvl}</option>
                  ))}
                </select>
                {!ageGroup && (
                  <p className="ep-hint">Add your birthday in Settings for age-group cuts.</p>
                )}
              </div>
            </div>

            {/* ── Event Selection ── */}
            <div className="ep-sel-header">
              <span className="ep-card-subtitle">Select Events</span>
              <div className="ep-sel-mode-tabs">
                <button
                  className={`ep-mode-tab${selMode === 'paste' ? ' active' : ''}`}
                  onClick={() => setSelMode('paste')}
                >Paste Schedule</button>
                <button
                  className={`ep-mode-tab${selMode === 'manual' ? ' active' : ''}`}
                  onClick={() => setSelMode('manual')}
                >Manual Select</button>
              </div>
            </div>

            {selMode === 'paste' ? (
              <div className="ep-paste-area">
                <textarea
                  className="ep-textarea"
                  rows={6}
                  placeholder={`Paste your meet schedule or event list here.\n\nExamples that work:\n  100 Freestyle\n  200 Back\n  400 IM\n  Girls 13-14 50 Butterfly\n  Event 3: Boys 200 Breaststroke\n\nThe parser extracts event names and ignores everything else.`}
                  value={pasteText}
                  onChange={e => { setPasteText(e.target.value); setParseError('') }}
                />
                {parseError && <p className="ep-parse-error">{parseError}</p>}
                <div className="ep-paste-actions">
                  <button
                    className="ep-parse-btn"
                    onClick={handlePaste}
                    disabled={!pasteText.trim()}
                  >
                    Parse Events
                  </button>
                  {selectedIds.size > 0 && (
                    <span className="ep-parsed-count">{selectedIds.size} event{selectedIds.size !== 1 ? 's' : ''} selected</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="ep-manual-area">
                <div className="ep-manual-toolbar">
                  <button className="ep-mini-btn" onClick={selectAll}>Select all</button>
                  <button className="ep-mini-btn" onClick={clearAll}>Clear all</button>
                  <span className="ep-parsed-count">{selectedIds.size} selected</span>
                </div>
                {groups.map(({ stroke, events }) => (
                  <div key={stroke} className="ep-check-group">
                    <p className="ep-check-stroke">{stroke}</p>
                    <div className="ep-check-list">
                      {events.map(({ id, label }) => (
                        <label key={id} className="ep-check-label">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(id)}
                            onChange={() => toggleEvent(id)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Best Bets Panel ── */}
          {bestBets.length > 0 && (
            <div className="ep-card ep-card--bestbets">
              <div className="ep-bestbets-header">
                <Star size={15} className="ep-star-icon" />
                <h2 className="ep-card-title">Best Bets</h2>
                <span className="ep-bestbets-sub">
                  {enterCount > 0 && `${enterCount} event${enterCount !== 1 ? 's' : ''} you can enter`}
                  {enterCount > 0 && considerCount > 0 && ', '}
                  {considerCount > 0 && `${considerCount} to consider`}
                </span>
              </div>
              <div className="ep-bets-grid">
                {bestBets.map(a => (
                  <div key={a.eventId} className={`ep-bet-card ep-bet-card--${a.rec}`}>
                    <div className="ep-bet-event">{a.fullLabel}</div>
                    <div className="ep-bet-time">
                      {a.userTime || '—'}
                      {a.staleness !== 'fresh' && a.userTime && (
                        <StalenessIcon staleness={a.staleness} daysAgo={a.daysAgo} lastSwum={a.lastSwum} />
                      )}
                    </div>
                    <div className="ep-bet-gap">
                      {a.proximity === 'met' ? '✓ Meets standard' : a.gap ? `${a.gap} to cut` : '—'}
                    </div>
                    <RecBadge rec={a.rec} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Analysis Table ── */}
          {selectedIds.size > 0 && (
            <div className="ep-card ep-card--analysis">
              <div className="ep-analysis-toolbar">
                <div className="ep-filter-group">
                  {(['all', 'enter', 'consider', 'skip'] as RecFilter[]).map(f => (
                    <button
                      key={f}
                      className={`ep-filter-btn${recFilter === f ? ' active' : ''}`}
                      onClick={() => setRecFilter(f)}
                    >
                      {f === 'all' ? 'All Events' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
                {enterCount > 0 && (
                  <button className="ep-copy-btn" onClick={copyEnterEvents}>
                    {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy "Enter" list</>}
                  </button>
                )}
              </div>

              {/* Table header */}
              <div className="ep-table-head">
                <span>Event</span>
                <span>Your Time</span>
                <span>Standard</span>
                <span>Gap</span>
                <span>Goal</span>
                <span>Rec</span>
              </div>

              {/* Rows grouped by stroke */}
              {groups.map(({ stroke, events }) => {
                const rows = filteredAnalyses.filter(a => a.stroke === stroke && events.some(e => e.id === a.eventId))
                if (rows.length === 0) return null
                return (
                  <div key={stroke} className="ep-stroke-section">
                    <div className="ep-stroke-heading">{stroke}</div>
                    {rows.map(a => (
                      <div key={a.eventId} className={`ep-table-row ep-table-row--${a.rec}`}>
                        <span className="ep-row-event">{a.fullLabel}</span>

                        <span className="ep-row-time">
                          {a.userTime || <span className="ep-no-time">—</span>}
                          {a.staleness !== 'fresh' && a.userTime && (
                            <StalenessIcon staleness={a.staleness} daysAgo={a.daysAgo} lastSwum={a.lastSwum} />
                          )}
                        </span>

                        <span className="ep-row-standard">
                          {a.cutTime || <span className="ep-no-time">—</span>}
                        </span>

                        <span className={`ep-row-gap ep-prox--${a.proximity}`}>
                          {a.proximity === 'met'     ? '✓ Made!'
                           : a.proximity === 'no-time' ? '—'
                           : a.proximity === 'no-cut'  ? 'No cut'
                           : a.gap || '—'}
                        </span>

                        <span className="ep-row-goal">
                          {a.goalTime
                            ? <>{a.goalTime}{a.goalMeetsCut && <span className="ep-goal-check" title="Your goal meets this standard">✓</span>}</>
                            : <span className="ep-no-time">—</span>
                          }
                        </span>

                        <RecBadge rec={a.rec} />
                      </div>
                    ))}
                  </div>
                )
              })}

              {filteredAnalyses.length === 0 && recFilter !== 'all' && (
                <div className="ep-filter-empty">
                  No "{recFilter}" events in your selection.
                  <button className="ep-filter-reset" onClick={() => setRecFilter('all')}>Show all</button>
                </div>
              )}
            </div>
          )}

          {/* ── Empty state ── */}
          {selectedIds.size === 0 && (
            <div className="ep-empty">
              <p className="ep-empty-title">No events selected yet</p>
              <p className="ep-empty-sub">
                Paste your meet schedule above, or switch to Manual Select to choose events
                from the checkbox grid. Once you pick events, you'll see a full analysis
                of your times vs. the qualifying standard.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
