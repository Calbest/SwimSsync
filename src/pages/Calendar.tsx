import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LayoutDashboard, CalendarCheck, ArrowRightLeft, ChevronLeft, ChevronRight, Plus, X, Pencil, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { writeMeetNotification } from '../lib/friends'
import TimeConverterPopup from '../components/TimeConverterPopup'
import './Calendar.css'

// ─── Types ───────────────────────────────────────────────────────────────────

type DrylandType  = 'gym' | 'stretching' | 'yoga' | 'cardio' | 'core' | 'other'
type SessionStatus = 'attended' | 'absent' | 'cancelled' | 'late'
type CalView      = 'month' | 'year' | 'career'

interface SessionData {
  startTime:      string
  endTime:        string
  status:         SessionStatus
  mood:           number | null
  absenceReason:  string
  minutesLate?:   number
  name?:          string
}

interface DrylandData {
  type:         DrylandType
  mood:         number | null
  startTime?:   string
  endTime?:     string
  minutesLate?: number
}

interface DayData {
  s1:      SessionData | null
  s2:      SessionData | null
  dryland: DrylandData | null
}

type AttendanceMap = Record<string, DayData>

interface Meet {
  id:               string
  name:             string
  date:             string
  time:             string
  mood:             number | null
  confidence:       number | null
  weather:          number | null
  injuries:         string
  performanceNotes: string
}

interface DayConfig {
  practice:  boolean
  s1Start:   string
  s1End:     string
  s2:        boolean
  s2Start:   string
  s2End:     string
  dryland:   boolean
  dryStart:  string
  dryEnd:    string
}

interface ScheduleTemplate {
  days:         Record<number, DayConfig>   // 0=Sun … 6=Sat
  practiceNote: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const MOOD = {
  labels: ['','Really Bad','Bad','OK','Good','Great'],
  emojis: ['','😣','😕','😐','😊','😄'],
  colors: ['','#ef4444','#f97316','#eab308','#22c55e','#0ea5e9'],
}

const DRYLAND_TYPES: { id: DrylandType; label: string; color: string }[] = [
  { id: 'gym',        label: 'Gym',        color: '#7c3aed' },
  { id: 'stretching', label: 'Stretching', color: '#0891b2' },
  { id: 'yoga',       label: 'Yoga',       color: '#be185d' },
  { id: 'cardio',     label: 'Cardio',     color: '#dc2626' },
  { id: 'core',       label: 'Core',       color: '#16a34a' },
  { id: 'other',      label: 'Other',      color: '#78716c' },
]

const WEATHER_LABELS = ['','Terrible','Bad','OK','Good','Perfect']

function defaultDayConfig(practice = false): DayConfig {
  return { practice, s1Start: '', s1End: '', s2: false, s2Start: '', s2End: '', dryland: false, dryStart: '', dryEnd: '' }
}

const DEFAULT_SCHEDULE: ScheduleTemplate = {
  days: {
    0: defaultDayConfig(false),
    1: defaultDayConfig(true),
    2: defaultDayConfig(true),
    3: defaultDayConfig(true),
    4: defaultDayConfig(true),
    5: defaultDayConfig(true),
    6: defaultDayConfig(false),
  },
  practiceNote: '',
}

function migrateSchedule(raw: Record<string, unknown>): ScheduleTemplate {
  if (raw.days && typeof raw.days === 'object' && !Array.isArray(raw.days)) {
    return raw as unknown as ScheduleTemplate
  }
  const oldDays = (raw.days as number[]) ?? [1,2,3,4,5]
  const oldTwo  = (raw.twoSessionDays as number[]) ?? []
  const oldDry  = (raw.drylandDays as number[]) ?? []
  const s1t = (raw.session1Time as string) ?? ''
  const s1e = (raw.session1EndTime as string) ?? ''
  const s2t = (raw.session2Time as string) ?? ''
  const s2e = (raw.session2EndTime as string) ?? ''
  const days: Record<number, DayConfig> = {}
  for (let i = 0; i <= 6; i++) {
    days[i] = {
      practice:  oldDays.includes(i),
      s1Start:   oldDays.includes(i) ? s1t : '',
      s1End:     oldDays.includes(i) ? s1e : '',
      s2:        oldTwo.includes(i),
      s2Start:   oldTwo.includes(i) ? s2t : '',
      s2End:     oldTwo.includes(i) ? s2e : '',
      dryland:   oldDry.includes(i),
      dryStart:  '',
      dryEnd:    '',
    }
  }
  return { days, practiceNote: (raw.practiceNote as string) ?? '' }
}

const SESSION_KEYS: Array<{ key: 's1' | 's2'; label: string }> = [
  { key: 's1', label: 'Session 1' },
  { key: 's2', label: 'Session 2' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
function firstDOW(y: number, m: number)    { return new Date(y, m, 1).getDay() }

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function fmtDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

function fmtShort(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  })
}

function defaultSession(startTime = '', endTime = ''): SessionData {
  return { startTime, endTime, status: 'attended', mood: null, absenceReason: '' }
}

function migrateSession(s: Record<string, unknown> | null): SessionData | null {
  if (!s) return null
  const startTime = (s.startTime as string) || (s.time as string) || ''
  return {
    startTime,
    endTime:       (s.endTime as string)       || '',
    status:        (s.status  as SessionStatus) || 'attended',
    mood:          (s.mood    as number | null) ?? null,
    absenceReason: (s.absenceReason as string)  || '',
    minutesLate:   s.minutesLate != null ? Number(s.minutesLate) : undefined,
  }
}

function migrateAttendance(raw: Record<string, unknown>): AttendanceMap {
  const out: AttendanceMap = {}
  for (const [date, v] of Object.entries(raw ?? {})) {
    if (!v || typeof v !== 'object') continue
    const vobj = v as Record<string, unknown>
    if ('s1' in vobj) {
      out[date] = {
        s1:      migrateSession(vobj.s1 as Record<string, unknown> | null),
        s2:      migrateSession(vobj.s2 as Record<string, unknown> | null),
        dryland: (vobj.dryland as DrylandData | null) ?? null,
      }
    } else {
      out[date] = {
        s1: {
          startTime: '', endTime: '', absenceReason: '',
          status: vobj.attended ? 'attended' : 'absent',
          mood: null,
        },
        s2: null,
        dryland: vobj.hasDryland ? { type: 'other', mood: null } : null,
      }
    }
  }
  return out
}

function migrateMeets(raw: unknown[]): Meet[] {
  return (raw ?? []).map((m: any) => ({
    id:               m.id   ?? crypto.randomUUID(),
    name:             m.name ?? '',
    date:             m.date ?? '',
    time:             m.time ?? '',
    mood:             m.mood             ?? null,
    confidence:       m.confidence       ?? null,
    weather:          m.weather          ?? null,
    injuries:         m.injuries         ?? '',
    performanceNotes: m.performanceNotes ?? m.comments ?? '',
  }))
}

// ─── SVG Donut Chart ──────────────────────────────────────────────────────────

interface PieSeg { label: string; value: number; color: string }

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg - 90) * Math.PI / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const
}

function donutPath(cx: number, cy: number, R: number, ri: number, s: number, e: number) {
  if (e - s >= 360) e = s + 359.99
  const [x1, y1] = polar(cx, cy, R,  s), [x2, y2] = polar(cx, cy, R,  e)
  const [x3, y3] = polar(cx, cy, ri, e), [x4, y4] = polar(cx, cy, ri, s)
  const lg = e - s > 180 ? 1 : 0
  const f  = (n: number) => n.toFixed(2)
  return `M${f(x1)} ${f(y1)} A${R} ${R} 0 ${lg} 1 ${f(x2)} ${f(y2)} L${f(x3)} ${f(y3)} A${ri} ${ri} 0 ${lg} 0 ${f(x4)} ${f(y4)}Z`
}

function DonutChart({ segs, size = 120 }: { segs: PieSeg[]; size?: number }) {
  const [hov, setHov] = useState<number | null>(null)
  const nonZero = segs.filter(s => s.value > 0)
  const total   = nonZero.reduce((a, s) => a + s.value, 0)

  if (!total) return <div className="cal-pie-empty">No data yet</div>

  const cx = size / 2, cy = size / 2
  const R  = size / 2 - 7, ri = R * 0.56

  let cumulative = 0
  const slices = nonZero.map(seg => {
    const start = cumulative / total * 360
    cumulative += seg.value
    const end = cumulative / total * 360
    const pct = Math.round(seg.value / total * 100)
    return { ...seg, start, end, pct }
  })

  const hovSeg = hov !== null ? slices[hov] : null

  return (
    <div className="cal-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="cal-donut-svg">
        {slices.map((s, i) => (
          <path
            key={i}
            d={donutPath(cx, cy, R, ri, s.start, s.end)}
            fill={s.color}
            stroke="#fff"
            strokeWidth="2.5"
            opacity={hov !== null && hov !== i ? 0.38 : 1}
            className="cal-donut-slice"
            onMouseEnter={() => setHov(i)}
            onMouseLeave={() => setHov(null)}
          />
        ))}
        <text x={cx} y={cy - 5} textAnchor="middle" className="cal-donut-big"
          fill={hovSeg ? hovSeg.color : '#0f172a'}>
          {hovSeg ? `${hovSeg.pct}%` : total}
        </text>
        <text x={cx} y={cy + 11} textAnchor="middle" className="cal-donut-sm" fill="#64748b">
          {hovSeg ? hovSeg.label : 'total'}
        </text>
      </svg>

      <div className="cal-donut-legend">
        {slices.map((s, i) => (
          <div
            key={i}
            className={`cal-leg-row${hov === i ? ' hov' : ''}`}
            onMouseEnter={() => setHov(i)}
            onMouseLeave={() => setHov(null)}
          >
            <span className="cal-leg-dot" style={{ background: s.color }} />
            <span className="cal-leg-label">{s.label}</span>
            <span className="cal-leg-pct">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Mood Picker ─────────────────────────────────────────────────────────────

function MoodPicker({ value, onChange, label }: {
  value: number | null
  onChange: (n: number) => void
  label?: string
}) {
  return (
    <div className="cal-mood">
      {label && <span className="cal-field-lbl">{label}</span>}
      <div className="cal-mood-row">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n} type="button"
            className={`cal-mood-btn${value === n ? ' sel' : ''}`}
            style={value === n ? { background: MOOD.colors[n], borderColor: MOOD.colors[n] } : {}}
            title={MOOD.labels[n]}
            onClick={() => onChange(n)}
          >
            {MOOD.emojis[n]}
          </button>
        ))}
      </div>
      {value !== null && (
        <span className="cal-mood-text" style={{ color: MOOD.colors[value] }}>
          {MOOD.labels[value]}
        </span>
      )}
    </div>
  )
}

// ─── Scale Picker (numeric 1–5) ───────────────────────────────────────────────

function ScalePicker({ value, onChange, label, sublabels }: {
  value: number | null
  onChange: (n: number) => void
  label: string
  sublabels?: string[]
}) {
  return (
    <div className="cal-scale">
      <span className="cal-field-lbl">
        {label}{value !== null && sublabels ? ` — ${sublabels[value]}` : ''}
      </span>
      <div className="cal-scale-row">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n} type="button"
            className={`cal-scale-btn${value === n ? ' sel' : ''}`}
            onClick={() => onChange(n)}
          >{n}</button>
        ))}
      </div>
    </div>
  )
}

// ─── Session Block (inside DayModal) ─────────────────────────────────────────

function SessionBlock({ session, onChange, label, defaultTime, onRemove }: {
  session:     SessionData
  onChange:    (s: SessionData) => void
  label:       string
  defaultTime?: string
  onRemove?:   () => void
}) {
  const [editingName, setEditingName] = useState(false)
  const [draftName,   setDraftName]   = useState(session.name ?? '')

  const set = <K extends keyof SessionData>(k: K, v: SessionData[K]) =>
    onChange({ ...session, [k]: v })

  function commitName() {
    set('name', draftName.trim() || undefined)
    setEditingName(false)
  }

  return (
    <div className="cal-session">
      <div className="cal-session-head">
        {editingName ? (
          <div className="cal-session-name-edit">
            <input
              className="cal-session-name-input"
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false) }}
              placeholder={label}
              autoFocus
              maxLength={32}
            />
            <button className="cal-session-name-ok" type="button" onClick={commitName}>
              <Check size={13} />
            </button>
          </div>
        ) : (
          <div className="cal-session-name-row">
            <span className="cal-session-label">{session.name || label}</span>
            <button
              className="cal-session-rename-btn"
              type="button"
              title="Rename session"
              onClick={() => { setDraftName(session.name ?? ''); setEditingName(true) }}
            >
              <Pencil size={12} />
            </button>
          </div>
        )}
        {onRemove && (
          <button className="cal-session-remove" type="button" onClick={onRemove}>
            <X size={13} />
          </button>
        )}
      </div>
      <div className="cal-session-times">
        <div className="cal-time-field">
          <label className="cal-time-lbl">Start</label>
          <input
            className="cal-time-input" type="time"
            value={session.startTime || defaultTime || ''}
            onChange={e => set('startTime', e.target.value)}
          />
        </div>
        <span className="cal-time-arrow">→</span>
        <div className="cal-time-field">
          <label className="cal-time-lbl">End</label>
          <input
            className="cal-time-input" type="time"
            value={session.endTime || ''}
            onChange={e => set('endTime', e.target.value)}
          />
        </div>
      </div>

      <div className="cal-status-row">
        {(['attended', 'late', 'absent', 'cancelled'] as SessionStatus[]).map(st => (
          <button
            key={st} type="button"
            className={`cal-status-btn cal-status-btn--${st}${session.status === st ? ' sel' : ''}`}
            onClick={() => set('status', st)}
          >
            {st.charAt(0).toUpperCase() + st.slice(1)}
          </button>
        ))}
      </div>

      {session.status === 'attended' && (
        <MoodPicker value={session.mood} onChange={v => set('mood', v)} label="How was it?" />
      )}
      {session.status === 'late' && (
        <>
          <div className="cal-field cal-late-field">
            <label className="cal-field-lbl">How many minutes late?</label>
            <div className="cal-late-input-row">
              <input
                className="cal-field-input cal-late-input"
                type="number"
                min={1}
                max={120}
                placeholder="e.g. 10"
                value={session.minutesLate ?? ''}
                onChange={e => set('minutesLate', e.target.value ? parseInt(e.target.value) : undefined)}
              />
              <span className="cal-late-unit">min</span>
            </div>
          </div>
          <MoodPicker value={session.mood} onChange={v => set('mood', v)} label="How was it?" />
        </>
      )}
      {session.status === 'absent' && (
        <div className="cal-field">
          <label className="cal-field-lbl">Reason (optional)</label>
          <input
            className="cal-field-input"
            placeholder="Why did you miss practice?"
            value={session.absenceReason}
            onChange={e => set('absenceReason', e.target.value)}
          />
        </div>
      )}
    </div>
  )
}

// ─── Day Modal ────────────────────────────────────────────────────────────────

function DayModal({ dateStr, initial, schedule, isPrac, onSave, onClose }: {
  dateStr:  string
  initial:  DayData | null
  schedule: ScheduleTemplate
  isPrac:   boolean
  onSave:   (d: DayData) => void
  onClose:  () => void
}) {
  const dow          = new Date(dateStr + 'T12:00:00').getDay()
  const dowCfg = schedule.days[dow] ?? defaultDayConfig(false)
  const hasTwoDefault = dowCfg.s2
  const hasDryDefault = dowCfg.dryland

  const [d, setD] = useState<DayData>(() => initial ?? {
    s1:      defaultSession(dowCfg.s1Start, dowCfg.s1End),
    s2:      hasTwoDefault ? defaultSession(dowCfg.s2Start, dowCfg.s2End) : null,
    dryland: hasDryDefault ? { type: 'other', mood: null } : null,
  })

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  return (
    <div className="cal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cal-modal cal-modal--day">
        <div className="cal-modal-header">
          <span className="cal-modal-title">{fmtDate(dateStr)}</span>
          <button className="cal-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="cal-modal-body">
          {!isPrac && !initial && (
            <div className="cal-no-prac-notice">
              <span>No practice scheduled this day</span>
            </div>
          )}

          {d.s1 && (
            <SessionBlock
              session={d.s1}
              onChange={s1 => setD(p => ({ ...p, s1 }))}
              label="Session 1"
              defaultTime={dowCfg.s1Start}
            />
          )}

          {d.s2 ? (
            <SessionBlock
              session={d.s2}
              onChange={s2 => setD(p => ({ ...p, s2 }))}
              label="Session 2"
              defaultTime={dowCfg.s2Start}
              onRemove={() => setD(p => ({ ...p, s2: null }))}
            />
          ) : (
            <button
              className="cal-add-session-btn" type="button"
              onClick={() => setD(p => ({ ...p, s2: defaultSession(dowCfg.s2Start, dowCfg.s2End) }))}
            >
              <Plus size={13} /> Add 2nd Session
            </button>
          )}

          <div className="cal-dryland-wrap">
            <div className="cal-dryland-head">
              <span className="cal-field-lbl">Dryland</span>
              <button
                className={`cal-toggle${d.dryland ? ' on' : ''}`} type="button"
                onClick={() => setD(p => ({
                  ...p, dryland: p.dryland ? null : { type: 'other', mood: null },
                }))}
              >
                {d.dryland ? 'On' : 'Off'}
              </button>
            </div>

            {d.dryland && (
              <div className="cal-dryland-body">
                <div className="cal-session-times" style={{marginBottom:10}}>
                  <div className="cal-time-field">
                    <label className="cal-time-lbl">Start</label>
                    <input
                      className="cal-time-input" type="time"
                      value={d.dryland.startTime || ''}
                      onChange={e => setD(p => ({ ...p, dryland: { ...p.dryland!, startTime: e.target.value } }))}
                    />
                  </div>
                  <span className="cal-time-arrow">→</span>
                  <div className="cal-time-field">
                    <label className="cal-time-lbl">End</label>
                    <input
                      className="cal-time-input" type="time"
                      value={d.dryland.endTime || ''}
                      onChange={e => setD(p => ({ ...p, dryland: { ...p.dryland!, endTime: e.target.value } }))}
                    />
                  </div>
                </div>
                <div className="cal-dry-type-grid">
                  {DRYLAND_TYPES.map(t => (
                    <button
                      key={t.id} type="button"
                      className={`cal-dry-type${d.dryland?.type === t.id ? ' sel' : ''}`}
                      style={d.dryland?.type === t.id
                        ? { background: t.color, color: '#fff', borderColor: t.color }
                        : {}}
                      onClick={() => setD(p => ({ ...p, dryland: { ...p.dryland!, type: t.id } }))}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="cal-dryland-late-row">
                  <span className="cal-field-lbl">Late to dryland?</span>
                  <button
                    className={`cal-toggle${d.dryland.minutesLate != null ? ' on' : ''}`}
                    type="button"
                    onClick={() => setD(p => ({
                      ...p,
                      dryland: {
                        ...p.dryland!,
                        minutesLate: p.dryland!.minutesLate != null ? undefined : 0,
                      },
                    }))}
                  >
                    {d.dryland.minutesLate != null ? 'Yes' : 'No'}
                  </button>
                  {d.dryland.minutesLate != null && (
                    <div className="cal-late-input-row">
                      <input
                        className="cal-field-input cal-late-input"
                        type="number"
                        min={1}
                        max={120}
                        placeholder="min"
                        value={d.dryland.minutesLate || ''}
                        onChange={e => setD(p => ({
                          ...p,
                          dryland: {
                            ...p.dryland!,
                            minutesLate: e.target.value ? parseInt(e.target.value) : 0,
                          },
                        }))}
                      />
                      <span className="cal-late-unit">min late</span>
                    </div>
                  )}
                </div>
                <MoodPicker
                  value={d.dryland.mood}
                  onChange={v => setD(p => ({ ...p, dryland: { ...p.dryland!, mood: v } }))}
                  label="Dryland rating"
                />
              </div>
            )}
          </div>
        </div>

        <div className="cal-modal-footer">
          <button className="cal-modal-cancel" onClick={onClose}>Cancel</button>
          <button className="cal-modal-save" onClick={() => { onSave(d); onClose() }}>Save</button>
        </div>
      </div>
    </div>
  )
}

// ─── Meet Modal ───────────────────────────────────────────────────────────────

function MeetModal({ meet, onSave, onDelete, onClose, defaultName = '', defaultDate = '', defaultTime = '' }: {
  meet:        Meet | null
  onSave:      (m: Meet) => void
  onDelete?:   (id: string) => void
  onClose:     () => void
  defaultName?: string
  defaultDate?: string
  defaultTime?: string
}) {
  const isNew = meet === null

  const [name,  setName]  = useState(meet?.name ?? defaultName)
  const [date,  setDate]  = useState(meet?.date ?? (defaultDate || new Date().toISOString().slice(0, 10)))
  const [time,  setTime]  = useState(meet?.time ?? defaultTime)
  const [mood,  setMood]  = useState<number | null>(meet?.mood ?? null)
  const [conf,  setConf]  = useState<number | null>(meet?.confidence ?? null)
  const [wthr,  setWthr]  = useState<number | null>(meet?.weather ?? null)
  const [inj,   setInj]   = useState(meet?.injuries ?? '')
  const [notes, setNotes] = useState(meet?.performanceNotes ?? '')

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  function save() {
    if (!name.trim()) return
    onSave({
      id: meet?.id ?? crypto.randomUUID(),
      name: name.trim(), date, time,
      mood, confidence: conf, weather: wthr,
      injuries: inj, performanceNotes: notes,
    })
    onClose()
  }

  return (
    <div className="cal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cal-modal cal-modal--meet">
        <div className="cal-modal-header">
          <span className="cal-modal-title">{isNew ? 'Add Meet' : meet!.name}</span>
          <button className="cal-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="cal-modal-body">
          <div className="cal-field">
            <label className="cal-field-lbl">Meet Name</label>
            <input
              className="cal-field-input"
              value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. SCS Junior Championships"
              autoFocus
            />
          </div>
          <div className="cal-field">
            <label className="cal-field-lbl">Date</label>
            <input
              className="cal-field-input" type="date"
              value={date} onChange={e => setDate(e.target.value)}
            />
          </div>
          <div className="cal-field">
            <label className="cal-field-lbl">Start Time <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span></label>
            <input
              className="cal-field-input" type="time"
              value={time} onChange={e => setTime(e.target.value)}
            />
          </div>

          {!isNew && (
            <>
              <div className="cal-divider" />
              <p className="cal-section-title">Meet Analysis</p>
              <MoodPicker value={mood} onChange={setMood} label="Overall meet mood" />
              <ScalePicker
                value={conf} onChange={setConf}
                label="Confidence"
                sublabels={['', 'Very Low', 'Low', 'Average', 'Good', 'High']}
              />
              <ScalePicker
                value={wthr} onChange={setWthr}
                label="Weather / Conditions"
                sublabels={WEATHER_LABELS}
              />
              <div className="cal-field">
                <label className="cal-field-lbl">Injuries / Pain</label>
                <input
                  className="cal-field-input"
                  value={inj} onChange={e => setInj(e.target.value)}
                  placeholder="Any injuries or pain during the meet?"
                />
              </div>
              <div className="cal-field">
                <label className="cal-field-lbl">Performance Notes</label>
                <textarea
                  className="cal-field-textarea" rows={3}
                  value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="How did it go overall? Explain results, what to improve…"
                />
              </div>
            </>
          )}
        </div>

        <div className="cal-modal-footer">
          {!isNew && onDelete && (
            <button
              className="cal-modal-delete"
              onClick={() => {
                if (window.confirm('Delete this meet?')) { onDelete(meet!.id); onClose() }
              }}
            >
              Delete
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="cal-modal-cancel" onClick={onClose}>Cancel</button>
          <button className="cal-modal-save" onClick={save} disabled={!name.trim()}>
            {isNew ? 'Add Meet' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Month Report ─────────────────────────────────────────────────────────────

type ReportTab = 'practice' | 'mood' | 'dryland' | 'meets'

function MonthReport({ year, month, attendance, meets, schedule }: {
  year:       number
  month:      number
  attendance: AttendanceMap
  meets:      Meet[]
  schedule:   ScheduleTemplate
}) {
  const [tab, setTab] = useState<ReportTab>('practice')

  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const dim    = daysInMonth(year, month)

  const practiceDates: string[] = []
  for (let d = 1; d <= dim; d++) {
    const ds = iso(year, month, d)
    const dow = new Date(ds + 'T12:00:00').getDay()
    if (schedule.days[dow]?.practice ?? false) practiceDates.push(ds)
  }

  let attended = 0, late = 0, absent = 0, cancelled = 0
  const moodCount    = [0, 0, 0, 0, 0, 0]
  const dryMoodCount = [0, 0, 0, 0, 0, 0]
  const excuses: { date: string; session: string; reason: string }[] = []
  const lateEntries: { date: string; session: string; minutes: number }[] = []

  for (const ds of practiceDates) {
    const day = attendance[ds]
    for (const { key, label } of SESSION_KEYS) {
      const s = day?.[key] ?? null
      if (!s) continue
      if (s.status === 'attended') {
        attended++
        if (s.mood) moodCount[s.mood]++
      } else if (s.status === 'late') {
        late++
        if (s.mood) moodCount[s.mood]++
        if (s.minutesLate) lateEntries.push({ date: ds, session: label, minutes: s.minutesLate })
      } else if (s.status === 'cancelled') {
        cancelled++
      } else {
        absent++
        if (s.absenceReason.trim())
          excuses.push({ date: ds, session: label, reason: s.absenceReason.trim() })
      }
    }
  }

  const dryCount: Record<DrylandType, number> = {
    gym: 0, stretching: 0, yoga: 0, cardio: 0, core: 0, other: 0,
  }
  const dryLateEntries: { date: string; minutes: number }[] = []
  let dryTotal = 0
  for (const ds of practiceDates) {
    const dry = attendance[ds]?.dryland
    if (dry) {
      dryCount[dry.type]++
      dryTotal++
      if (dry.mood) dryMoodCount[dry.mood]++
      if (dry.minutesLate) dryLateEntries.push({ date: ds, minutes: dry.minutesLate })
    }
  }

  const monthMeets = meets.filter(m => m.date.startsWith(prefix))
  const hasData    = attended + late + absent + cancelled > 0

  const avgLateMin = lateEntries.length > 0
    ? Math.round(lateEntries.reduce((s, e) => s + e.minutes, 0) / lateEntries.length)
    : null
  const avgDryLateMin = dryLateEntries.length > 0
    ? Math.round(dryLateEntries.reduce((s, e) => s + e.minutes, 0) / dryLateEntries.length)
    : null

  if (!hasData && monthMeets.length === 0) return null

  const REPORT_TABS: { id: ReportTab; label: string }[] = [
    { id: 'practice', label: '🏊 Practice' },
    { id: 'mood',     label: '😊 Mood' },
    { id: 'dryland',  label: '💪 Dryland' },
    { id: 'meets',    label: '🏆 Meets' },
  ]

  return (
    <div className="cal-report-section">
      <h2 className="cal-report-heading">
        {MONTH_NAMES[month]} {year} — Analysis
      </h2>

      {/* Tab bar */}
      <div className="cal-report-tabs">
        {REPORT_TABS.map(t => (
          <button
            key={t.id}
            className={`cal-report-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Practice tab ── */}
      {tab === 'practice' && hasData && (
        <div className="cal-report-panel">
          <div className="cal-charts-row">
            <div className="cal-chart-card">
              <div className="cal-chart-title">Attendance</div>
              <DonutChart segs={[
                { label: 'Attended',  value: attended,  color: '#22c55e' },
                { label: 'Late',      value: late,      color: '#f59e0b' },
                { label: 'Absent',    value: absent,    color: '#ef4444' },
                { label: 'Cancelled', value: cancelled, color: '#94a3b8' },
              ]} />
            </div>
          </div>

          {/* Late arrivals stats */}
          {(lateEntries.length > 0 || dryLateEntries.length > 0) && (
            <div className="cal-late-section">
              <h3 className="cal-excuses-title">Late Arrivals</h3>
              <div className="cal-late-stats">
                {lateEntries.length > 0 && (
                  <div className="cal-late-stat-card">
                    <div className="cal-late-stat-val">{avgLateMin}<span className="cal-late-stat-unit"> min avg</span></div>
                    <div className="cal-late-stat-label">Avg late to swim ({lateEntries.length} time{lateEntries.length !== 1 ? 's' : ''})</div>
                  </div>
                )}
                {dryLateEntries.length > 0 && (
                  <div className="cal-late-stat-card">
                    <div className="cal-late-stat-val">{avgDryLateMin}<span className="cal-late-stat-unit"> min avg</span></div>
                    <div className="cal-late-stat-label">Avg late to dryland ({dryLateEntries.length} time{dryLateEntries.length !== 1 ? 's' : ''})</div>
                  </div>
                )}
              </div>
              <div className="cal-excuses-list">
                {lateEntries.map((e, i) => (
                  <div key={i} className="cal-excuse-row cal-excuse-row--late">
                    <span className="cal-excuse-date">{fmtShort(e.date)}</span>
                    <span className="cal-excuse-session">{e.session}</span>
                    <span className="cal-excuse-text cal-late-badge">{e.minutes} min late</span>
                  </div>
                ))}
                {dryLateEntries.map((e, i) => (
                  <div key={`dry-${i}`} className="cal-excuse-row cal-excuse-row--late">
                    <span className="cal-excuse-date">{fmtShort(e.date)}</span>
                    <span className="cal-excuse-session">Dryland</span>
                    <span className="cal-excuse-text cal-late-badge">{e.minutes} min late</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {excuses.length > 0 && (
            <div className="cal-excuses">
              <h3 className="cal-excuses-title">Absence Reasons</h3>
              <div className="cal-excuses-list">
                {excuses.map((e, i) => (
                  <div key={i} className="cal-excuse-row">
                    <span className="cal-excuse-date">{fmtShort(e.date)}</span>
                    <span className="cal-excuse-session">{e.session}</span>
                    <span className="cal-excuse-text">"{e.reason}"</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Mood tab ── */}
      {tab === 'mood' && (
        <div className="cal-report-panel">
          {(attended + late) > 0 ? (
            <div className="cal-charts-row">
              <div className="cal-chart-card">
                <div className="cal-chart-title">Swim Practice Mood</div>
                <DonutChart segs={[1, 2, 3, 4, 5].map(n => ({
                  label: MOOD.labels[n], value: moodCount[n], color: MOOD.colors[n],
                }))} />
              </div>
              {dryTotal > 0 && (
                <div className="cal-chart-card">
                  <div className="cal-chart-title">Dryland Mood</div>
                  <DonutChart segs={[1, 2, 3, 4, 5].map(n => ({
                    label: MOOD.labels[n], value: dryMoodCount[n], color: MOOD.colors[n],
                  }))} />
                </div>
              )}
            </div>
          ) : (
            <p className="cal-report-empty">No mood data logged this month. Tap a practice day and rate how the session felt.</p>
          )}
        </div>
      )}

      {/* ── Dryland tab ── */}
      {tab === 'dryland' && (
        <div className="cal-report-panel">
          {dryTotal > 0 ? (
            <>
              <div className="cal-charts-row">
                <div className="cal-chart-card">
                  <div className="cal-chart-title">Dryland Types</div>
                  <DonutChart segs={DRYLAND_TYPES.map(t => ({
                    label: t.label, value: dryCount[t.id], color: t.color,
                  }))} />
                </div>
              </div>
              <div className="cal-dry-summary">
                <div className="cal-dry-stat"><span className="cal-dry-stat-num">{dryTotal}</span><span className="cal-dry-stat-lbl">total sessions</span></div>
                {avgDryLateMin !== null && (
                  <div className="cal-dry-stat"><span className="cal-dry-stat-num">{avgDryLateMin}<span style={{fontSize:12}}> min</span></span><span className="cal-dry-stat-lbl">avg late ({dryLateEntries.length}×)</span></div>
                )}
              </div>
              {dryLateEntries.length > 0 && (
                <div className="cal-excuses">
                  <h3 className="cal-excuses-title">Late to Dryland</h3>
                  <div className="cal-excuses-list">
                    {dryLateEntries.map((e, i) => (
                      <div key={i} className="cal-excuse-row cal-excuse-row--late">
                        <span className="cal-excuse-date">{fmtShort(e.date)}</span>
                        <span className="cal-excuse-text cal-late-badge">{e.minutes} min late</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="cal-report-empty">No dryland sessions logged this month. Toggle "Dryland" on when logging a practice day.</p>
          )}
        </div>
      )}

      {/* ── Meets tab ── */}
      {tab === 'meets' && (
        <div className="cal-report-panel">
          {monthMeets.length === 0 ? (
            <p className="cal-report-empty">No meets this month. Add a meet using "+ Add Meet" above the calendar.</p>
          ) : (
            <>
              {monthMeets.map(m => (
                <div key={m.id} className="cal-meet-an-card">
                  <div className="cal-meet-an-head">
                    <strong>{m.name}</strong>
                    <span className="cal-meet-an-date">{fmtShort(m.date)}</span>
                  </div>
                  {(m.mood || m.confidence || m.weather) && (
                    <div className="cal-meet-scales">
                      {m.mood && (
                        <div className="cal-meet-scale-row">
                          <span className="cal-meet-scale-lbl">Overall Mood</span>
                          <div className="cal-meet-scale-bar">
                            {[1,2,3,4,5].map(n => (
                              <div key={n} className={`cal-scale-pip${n <= (m.mood ?? 0) ? ' filled' : ''}`} style={n <= (m.mood ?? 0) ? {background: MOOD.colors[n]} : {}}/>
                            ))}
                            <span className="cal-meet-scale-label">{MOOD.emojis[m.mood]} {MOOD.labels[m.mood]}</span>
                          </div>
                        </div>
                      )}
                      {m.confidence && (
                        <div className="cal-meet-scale-row">
                          <span className="cal-meet-scale-lbl">Confidence</span>
                          <div className="cal-meet-scale-bar">
                            {[1,2,3,4,5].map(n => (
                              <div key={n} className={`cal-scale-pip${n <= (m.confidence ?? 0) ? ' filled' : ''}`} style={n <= (m.confidence ?? 0) ? {background:'#3b82f6'} : {}}/>
                            ))}
                            <span className="cal-meet-scale-label">{m.confidence}/5</span>
                          </div>
                        </div>
                      )}
                      {m.weather && (
                        <div className="cal-meet-scale-row">
                          <span className="cal-meet-scale-lbl">Conditions</span>
                          <div className="cal-meet-scale-bar">
                            {[1,2,3,4,5].map(n => (
                              <div key={n} className={`cal-scale-pip${n <= (m.weather ?? 0) ? ' filled' : ''}`} style={n <= (m.weather ?? 0) ? {background:'#0891b2'} : {}}/>
                            ))}
                            <span className="cal-meet-scale-label">{WEATHER_LABELS[m.weather]}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {m.injuries && (
                    <div className="cal-meet-an-chips">
                      <span className="cal-ma-chip cal-ma-chip--warn">⚠ {m.injuries}</span>
                    </div>
                  )}
                  {m.performanceNotes && (
                    <p className="cal-meet-an-notes">"{m.performanceNotes}"</p>
                  )}
                  {!m.mood && !m.confidence && !m.weather && !m.injuries && !m.performanceNotes && (
                    <p className="cal-report-empty" style={{margin:'8px 0 0'}}>No analysis logged. Tap the meet chip on the calendar to add details.</p>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Year View ────────────────────────────────────────────────────────────────

function YearView({ year, setYear, attendance, meets, schedule, onSelectMonth }: {
  year:          number
  setYear:       (y: number) => void
  attendance:    AttendanceMap
  meets:         Meet[]
  schedule:      ScheduleTemplate
  onSelectMonth: (m: number) => void
}) {
  const stats = Array.from({ length: 12 }, (_, m) => {
    const dim = daysInMonth(year, m)
    let att = 0, tot = 0
    for (let d = 1; d <= dim; d++) {
      const ds = iso(year, m, d)
      const dow = new Date(ds + 'T12:00:00').getDay()
      if (!(schedule.days[dow]?.practice ?? false)) continue
      const day = attendance[ds]
      if (!day?.s1) { tot++; continue }
      for (const { key } of SESSION_KEYS) {
        const s = day[key]
        if (!s || s.status === 'cancelled') continue
        tot++
        if (s.status === 'attended' || s.status === 'late') att++
      }
    }
    const pct = tot > 0 ? Math.round(att / tot * 100) : null
    const mc  = meets.filter(mt =>
      mt.date.startsWith(`${year}-${String(m + 1).padStart(2, '0')}`),
    ).length
    return { m, att, tot, pct, mc }
  })

  const yearTot = stats.reduce((a, s) => a + s.tot, 0)
  const yearAtt = stats.reduce((a, s) => a + s.att, 0)
  const yearPct = yearTot > 0 ? Math.round(yearAtt / yearTot * 100) : null

  return (
    <div className="cal-year-view cal-fade-in">
      <div className="cal-year-nav">
        <button className="cal-arrow-btn" onClick={() => setYear(year - 1)}><ChevronLeft size={18} /></button>
        <span className="cal-year-title">{year}</span>
        <button className="cal-arrow-btn" onClick={() => setYear(year + 1)}><ChevronRight size={18} /></button>
      </div>

      {yearPct !== null && (
        <div className="cal-year-summary">
          <span className="cal-year-big">{yearPct}%</span>
          <span className="cal-year-big-sub">
            {yearAtt} of {yearTot} sessions attended in {year}
          </span>
        </div>
      )}

      <div className="cal-year-grid">
        {stats.map(({ m, att, tot, pct, mc }, i) => (
          <div
            key={m}
            className="cal-year-card"
            style={{ '--yi': i } as React.CSSProperties}
            onClick={() => onSelectMonth(m)}
          >
            <div className="cal-year-card-month">{MONTH_NAMES[m].slice(0, 3)}</div>
            {pct !== null ? (
              <>
                <div className="cal-year-bar-bg">
                  <div
                    className="cal-year-bar-fill"
                    style={{
                      width: `${pct}%`,
                      background: pct >= 80 ? '#22c55e' : pct >= 60 ? '#eab308' : '#ef4444',
                    }}
                  />
                </div>
                <div
                  className="cal-year-card-pct"
                  style={{ color: pct >= 80 ? '#22c55e' : pct >= 60 ? '#eab308' : '#ef4444' }}
                >
                  {pct}%
                </div>
                <div className="cal-year-card-sub">{att}/{tot} sessions</div>
              </>
            ) : (
              <div className="cal-year-card-empty">No data</div>
            )}
            {mc > 0 && (
              <div className="cal-year-card-meets">{mc} meet{mc !== 1 ? 's' : ''}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Career View ──────────────────────────────────────────────────────────────

function CareerView({ attendance, meets, schedule }: {
  attendance: AttendanceMap
  meets:      Meet[]
  schedule:   ScheduleTemplate
}) {
  const yrSet = new Set<number>()
  Object.keys(attendance).forEach(d => yrSet.add(parseInt(d.slice(0, 4))))
  meets.forEach(m => yrSet.add(parseInt(m.date.slice(0, 4))))
  if (!yrSet.size) yrSet.add(new Date().getFullYear())

  const rows = Array.from(yrSet).sort((a, b) => b - a).map(yr => {
    let att = 0, tot = 0
    for (const [ds, day] of Object.entries(attendance)) {
      if (!ds.startsWith(String(yr))) continue
      const dowC = new Date(ds + 'T12:00:00').getDay()
      if (!(schedule.days[dowC]?.practice ?? false)) continue
      if (!day.s1) { tot++; continue }
      for (const { key } of SESSION_KEYS) {
        const s = day[key]
        if (!s || s.status === 'cancelled') continue
        tot++
        if (s.status === 'attended' || s.status === 'late') att++
      }
    }
    return {
      yr, att, tot,
      pct: tot > 0 ? Math.round(att / tot * 100) : null,
      mc:  meets.filter(m => m.date.startsWith(String(yr))).length,
    }
  })

  const totAll = rows.reduce((a, r) => a + r.tot, 0)
  const attAll = rows.reduce((a, r) => a + r.att, 0)
  const pctAll = totAll > 0 ? Math.round(attAll / totAll * 100) : null

  return (
    <div className="cal-career-view cal-fade-in">
      <h2 className="cal-year-title" style={{ marginBottom: 20 }}>Career Summary</h2>

      {pctAll !== null && (
        <div className="cal-career-hero">
          <span className="cal-career-pct">{pctAll}%</span>
          <span className="cal-career-sub">
            All-time attendance — {attAll} of {totAll} sessions
          </span>
        </div>
      )}

      <div className="cal-career-table">
        <div className="cal-career-head">
          <span>Year</span>
          <span>Attended</span>
          <span>Total</span>
          <span>Rate</span>
          <span>Meets</span>
        </div>
        {rows.map(r => (
          <div key={r.yr} className="cal-career-row">
            <span className="cal-career-yr">{r.yr}</span>
            <span>{r.att}</span>
            <span>{r.tot}</span>
            <span
              className="cal-career-rate"
              style={{
                color: r.pct === null ? '#94a3b8'
                  : r.pct >= 80 ? '#22c55e'
                  : r.pct >= 60 ? '#eab308' : '#ef4444',
              }}
            >
              {r.pct !== null ? `${r.pct}%` : '—'}
            </span>
            <span>{r.mc || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Calendar ────────────────────────────────────────────────────────────

export default function Calendar() {
  const navigate     = useNavigate()
  const [searchParams] = useSearchParams()
  const today    = new Date()
  const todayStr = iso(today.getFullYear(), today.getMonth(), today.getDate())

  const [year,      setYear]      = useState(today.getFullYear())
  const [month,     setMonth]     = useState(today.getMonth())
  const [view,      setView]      = useState<CalView>('month')
  const [meets,     setMeets]     = useState<Meet[]>([])
  const [attn,      setAttn]      = useState<AttendanceMap>({})
  const [sched,       setSched]       = useState<ScheduleTemplate>(DEFAULT_SCHEDULE)
  const [showSched,   setShowSched]   = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [showTC,    setShowTC]    = useState(false)
  const [saving,    setSaving]    = useState(false)

  const [schedDay,    setSchedDay]    = useState(1)
  const [s1Saved,     setS1Saved]     = useState(false)
  const [s2Saved,     setS2Saved]     = useState(false)
  const [drylandSaved, setDrylandSaved] = useState(false)
  const [repeatMode,  setRepeatMode]  = useState<'every' | 'next'>('every')

  const [dayModal,  setDayModal]  = useState<string | null>(null)
  const dayModalIsPrac = dayModal
    ? (sched.days[new Date(dayModal + 'T12:00:00').getDay()]?.practice ?? false)
    : false
  const [meetModal, setMeetModal] = useState<Meet | null | 'new'>(null)

  const prefillName = searchParams.get('prefill_name') ?? ''
  const prefillDate = searchParams.get('prefill_date') ?? ''
  const prefillTime = searchParams.get('prefill_time') ?? ''

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      if (!user) { navigate('/'); return }
      const m = user.user_metadata ?? {}
      setMeets(migrateMeets(m.calMeets ?? []))
      setAttn(migrateAttendance(m.calAttendance ?? {}))
      if (m.calSchedule) setSched(migrateSchedule(m.calSchedule))
      if (prefillName) setMeetModal('new')
    })
  }, [navigate]) // eslint-disable-line react-hooks/exhaustive-deps

  async function persist(patch: object) {
    setSaving(true)
    await supabase.auth.updateUser({ data: patch })
    setSaving(false)
  }

  async function handleMeetSave(m: Meet) {
    const isNew = !meets.some(x => x.id === m.id)
    const next = isNew ? [...meets, m] : meets.map(x => x.id === m.id ? m : x)
    setMeets(next)
    persist({ calMeets: next })
    if (isNew) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const meta = user.user_metadata ?? {}
        const privacy = meta.privacySettings ?? {}
        if (privacy.shareMeets !== false) {
          writeMeetNotification(
            { id: user.id, full_name: meta.full_name || null, username: meta.username || '', avatar_url: meta.avatar_url || null },
            m,
          )
        }
      }
    }
  }

  function handleMeetDelete(id: string) {
    const next = meets.filter(m => m.id !== id)
    setMeets(next)
    persist({ calMeets: next })
  }

  function handleDaySave(ds: string, d: DayData) {
    const next = { ...attn, [ds]: d }
    setAttn(next)
    persist({ calAttendance: next })
  }

  function handleSchedSave(s: ScheduleTemplate) {
    setSched(s)
    persist({ calSchedule: s })
  }

  function updateSchedDay(update: Partial<DayConfig>) {
    const dc = sched.days[schedDay] ?? defaultDayConfig(false)
    const newDays = { ...sched.days, [schedDay]: { ...dc, ...update } }
    setSched({ ...sched, days: newDays })
  }

  function applyDayToNextOccurrence(part: 's1' | 's2dry') {
    const today2 = new Date()
    const daysUntil = (schedDay - today2.getDay() + 7) % 7
    const d2 = new Date(today2)
    d2.setDate(today2.getDate() + daysUntil)
    const dateStr = iso(d2.getFullYear(), d2.getMonth(), d2.getDate())
    const dc = sched.days[schedDay] ?? defaultDayConfig(false)
    const existing = attn[dateStr]
    if (part === 's1') {
      const s1 = { ...(existing?.s1 ?? defaultSession()), startTime: dc.s1Start, endTime: dc.s1End }
      handleDaySave(dateStr, { ...(existing ?? { s1, s2: null, dryland: null, note: '', weather: null }), s1 })
    }
  }

  function saveS1ForDay() {
    handleSchedSave(sched)
    setS1Saved(true)
    setTimeout(() => setS1Saved(false), 2000)
    if (repeatMode === 'next') applyDayToNextOccurrence('s1')
  }

  function saveS2ForDay() {
    handleSchedSave(sched)
    setS2Saved(true)
    setTimeout(() => setS2Saved(false), 2000)
  }

  function saveDrylandForDay() {
    handleSchedSave(sched)
    setDrylandSaved(true)
    setTimeout(() => setDrylandSaved(false), 2000)
    if (repeatMode === 'next') applyDayToNextOccurrence('s2dry')
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const dim  = daysInMonth(year, month)
  const fday = firstDOW(year, month)
  const monthPfx = `${year}-${String(month + 1).padStart(2, '0')}`

  const meetsByDate = new Map<string, Meet>()
  meets.forEach(m => meetsByDate.set(m.date, m))

  const meetsThisMonth = meets
    .filter(m => m.date.startsWith(monthPfx))
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="cal-layout">
      <TimeConverterPopup isOpen={showTC} onClose={() => setShowTC(false)} />

      {dayModal && (
        <DayModal
          key={dayModal}
          dateStr={dayModal}
          initial={attn[dayModal] ?? null}
          schedule={sched}
          isPrac={dayModalIsPrac}
          onSave={d => handleDaySave(dayModal, d)}
          onClose={() => setDayModal(null)}
        />
      )}

      {meetModal !== null && (
        <MeetModal
          key={meetModal === 'new' ? 'new' : (meetModal as Meet).id}
          meet={meetModal === 'new' ? null : meetModal as Meet}
          onSave={handleMeetSave}
          onDelete={handleMeetDelete}
          onClose={() => setMeetModal(null)}
          defaultName={meetModal === 'new' ? prefillName : ''}
          defaultDate={meetModal === 'new' ? prefillDate : ''}
          defaultTime={meetModal === 'new' ? prefillTime : ''}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className="cal-sidebar">
        <div className="cal-sidebar-brand">Calendar</div>
        <nav className="cal-sidebar-nav">
          <button className="cal-nav-btn" onClick={() => navigate('/dashboard')}>
            <LayoutDashboard size={16} /><span>Dashboard</span>
          </button>
          <button className="cal-nav-btn" onClick={() => navigate('/event-planning')}>
            <CalendarCheck size={16} /><span>Event Planning</span>
          </button>
          <button className="cal-nav-btn" onClick={() => setShowTC(true)}>
            <ArrowRightLeft size={16} /><span>Time Converter</span>
          </button>
        </nav>
        <div className="cal-sidebar-lower">
          <button className="cal-sidebar-action-btn" onClick={() => setShowSched(v => !v)}>
            {showSched ? 'Close Schedule' : 'Edit Schedule'}
          </button>
          {saving && <span className="cal-saving">Saving…</span>}
        </div>
      </aside>

      {/* ── Page ── */}
      <div className="cal-page">
        <div className="cal-page-header">
          <button className="page-mob-back" onClick={() => navigate('/dashboard')}>
            <ChevronLeft size={15} /> Dashboard
          </button>
          <div>
            <h1 className="cal-title">Practice Calendar</h1>
            <p className="cal-subtitle">Track attendance, mood, dryland, and meets</p>
          </div>
          <img src="/logos/scs.svg" alt="SCS" className="scs-logo-corner" />
        </div>

        <div className="cal-body">

          {/* View tabs */}
          <div className="cal-view-tabs">
            {(['month', 'year', 'career'] as CalView[]).map(v => (
              <button
                key={v}
                className={`cal-view-tab${view === v ? ' active' : ''}`}
                onClick={() => setView(v)}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {/* Schedule editor */}
          {showSched && (
            <div className="cal-card cal-fade-in">
              <h2 className="cal-card-title">Practice Schedule</h2>

              {/* Day tabs */}
              <div className="cal-sched-day-tabs">
                {DAY_LABELS.map((lbl, i) => {
                  const hasPrac = sched.days[i]?.practice ?? false
                  return (
                    <button
                      key={i}
                      className={`cal-sched-day-tab${schedDay === i ? ' active' : ''}${hasPrac ? ' has-prac' : ''}`}
                      onClick={() => setSchedDay(i)}
                    >
                      {lbl}
                      {hasPrac && <span className="cal-sched-day-dot" />}
                    </button>
                  )
                })}
              </div>

              {/* Per-day panel */}
              {(() => {
                const dc = sched.days[schedDay] ?? defaultDayConfig(false)
                const dayName = DAY_LABELS[schedDay]
                return (
                  <div className="cal-sched-day-panel">

                    {/* ── Session 1 area ── */}
                    <div className="cal-sched-section">
                      <div className="cal-sched-section-head">
                        <label className="cal-sched-check-label">
                          <input
                            type="checkbox"
                            checked={dc.practice}
                            onChange={e => updateSchedDay({ practice: e.target.checked })}
                            className="cal-sched-checkbox"
                          />
                          <span className="cal-sched-check-text">Practice on {dayName}s</span>
                        </label>
                      </div>

                      <div className={`cal-sched-times-row${!dc.practice ? ' cal-sched-times-row--disabled' : ''}`}>
                        <div className="cal-field">
                          <label className="cal-field-lbl">Start</label>
                          <input
                            className="cal-field-input" type="time"
                            value={dc.s1Start}
                            disabled={!dc.practice}
                            onChange={e => updateSchedDay({ s1Start: e.target.value })}
                          />
                        </div>
                        <span className="cal-sched-times-arrow">→</span>
                        <div className="cal-field">
                          <label className="cal-field-lbl">End</label>
                          <input
                            className="cal-field-input" type="time"
                            value={dc.s1End}
                            disabled={!dc.practice}
                            onChange={e => updateSchedDay({ s1End: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="cal-sched-save-row">
                        <select
                          className="cal-sched-repeat-select"
                          value={repeatMode}
                          onChange={e => setRepeatMode(e.target.value as 'every' | 'next')}
                        >
                          <option value="every">Every {dayName}</option>
                          <option value="next">Next {dayName} only</option>
                        </select>
                        <button
                          className={`cal-sched-save-btn${s1Saved ? ' saved' : ''}`}
                          onClick={saveS1ForDay}
                        >
                          {s1Saved ? '✓ Saved' : 'Save Session 1'}
                        </button>
                      </div>
                    </div>

                    {/* ── Session 2 (optional) area ── */}
                    <div className="cal-sched-section cal-sched-section--optional">
                      <div className="cal-sched-section-head">
                        <label className="cal-sched-check-label">
                          <input
                            type="checkbox"
                            checked={dc.s2}
                            disabled={!dc.practice}
                            onChange={e => updateSchedDay({ s2: e.target.checked })}
                            className="cal-sched-checkbox"
                          />
                          <span className="cal-sched-check-text">Swim Practice 2</span>
                          <span className="cal-sched-optional-badge">optional</span>
                        </label>
                      </div>

                      <div className={`cal-sched-times-row${(!dc.practice || !dc.s2) ? ' cal-sched-times-row--disabled' : ''}`}>
                        <div className="cal-field">
                          <label className="cal-field-lbl">Start</label>
                          <input
                            className="cal-field-input" type="time"
                            value={dc.s2Start}
                            disabled={!dc.practice || !dc.s2}
                            onChange={e => updateSchedDay({ s2Start: e.target.value })}
                          />
                        </div>
                        <span className="cal-sched-times-arrow">→</span>
                        <div className="cal-field">
                          <label className="cal-field-lbl">End</label>
                          <input
                            className="cal-field-input" type="time"
                            value={dc.s2End}
                            disabled={!dc.practice || !dc.s2}
                            onChange={e => updateSchedDay({ s2End: e.target.value })}
                          />
                        </div>
                      </div>

                      {dc.practice && dc.s2 && (
                        <div className="cal-sched-save-row" style={{ marginTop: 8 }}>
                          <button
                            className={`cal-sched-save-btn${s2Saved ? ' saved' : ''}`}
                            onClick={saveS2ForDay}
                          >
                            {s2Saved ? '✓ Saved' : 'Save Practice 2'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* ── Dryland area ── */}
                    <div className="cal-sched-section">
                      <div className="cal-sched-section-head">
                        <label className="cal-sched-check-label">
                          <input
                            type="checkbox"
                            checked={dc.dryland}
                            disabled={!dc.practice}
                            onChange={e => updateSchedDay({ dryland: e.target.checked })}
                            className="cal-sched-checkbox"
                          />
                          <span className="cal-sched-check-text">Dryland</span>
                        </label>
                      </div>

                      <div className={`cal-sched-times-row${(!dc.practice || !dc.dryland) ? ' cal-sched-times-row--disabled' : ''}`}>
                        <div className="cal-field">
                          <label className="cal-field-lbl">Start</label>
                          <input
                            className="cal-field-input" type="time"
                            value={dc.dryStart}
                            disabled={!dc.practice || !dc.dryland}
                            onChange={e => updateSchedDay({ dryStart: e.target.value })}
                          />
                        </div>
                        <span className="cal-sched-times-arrow">→</span>
                        <div className="cal-field">
                          <label className="cal-field-lbl">End</label>
                          <input
                            className="cal-field-input" type="time"
                            value={dc.dryEnd}
                            disabled={!dc.practice || !dc.dryland}
                            onChange={e => updateSchedDay({ dryEnd: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="cal-sched-save-row">
                        <select
                          className="cal-sched-repeat-select"
                          value={repeatMode}
                          onChange={e => setRepeatMode(e.target.value as 'every' | 'next')}
                        >
                          <option value="every">Every {dayName}</option>
                          <option value="next">Next {dayName} only</option>
                        </select>
                        <button
                          className={`cal-sched-save-btn${drylandSaved ? ' saved' : ''}`}
                          onClick={saveDrylandForDay}
                        >
                          {drylandSaved ? '✓ Saved' : 'Save Dryland'}
                        </button>
                      </div>
                    </div>

                    {/* ── Practice note ── */}
                    <div className="cal-field" style={{ marginTop: 4 }}>
                      <label className="cal-field-lbl">Practice note (optional)</label>
                      <input
                        className="cal-field-input"
                        value={sched.practiceNote}
                        onChange={e => handleSchedSave({ ...sched, practiceNote: e.target.value })}
                        placeholder="e.g. 6:00–8:00 AM at Rosemead Aquatics"
                      />
                    </div>

                    {/* ── Reset ── */}
                    <div className="cal-sched-reset-wrap">
                      {!confirmReset ? (
                        <button className="cal-sched-reset-btn" onClick={() => setConfirmReset(true)}>
                          Reset to default
                        </button>
                      ) : (
                        <div className="cal-sched-reset-confirm">
                          <span>Clear all schedule settings?</span>
                          <button className="cal-sched-reset-yes" onClick={() => {
                            handleSchedSave(DEFAULT_SCHEDULE)
                            setConfirmReset(false)
                          }}>Reset</button>
                          <button className="cal-sched-reset-no" onClick={() => setConfirmReset(false)}>Cancel</button>
                        </div>
                      )}
                    </div>

                  </div>
                )
              })()}
            </div>
          )}

          {/* ── MONTH VIEW ── */}
          {view === 'month' && (
            <>
              <div className="cal-controls">
                <div className="cal-month-nav">
                  <button className="cal-arrow-btn" onClick={prevMonth}><ChevronLeft size={18} /></button>
                  <span className="cal-month-label">{MONTH_NAMES[month]} {year}</span>
                  <button className="cal-arrow-btn" onClick={nextMonth}><ChevronRight size={18} /></button>
                </div>
                <div className="cal-controls-right">
                  <button
                    className="cal-today-btn"
                    onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setDayModal(todayStr) }}
                  >
                    Today
                  </button>
                  <button className="cal-add-meet-btn" onClick={() => setMeetModal('new')}>
                    <Plus size={13} /> Add Meet
                  </button>
                </div>
              </div>

              {/* Grid */}
              <div className="cal-grid" key={`${year}-${month}`}>
                {DAY_LABELS.map(d => (
                  <div key={d} className="cal-grid-head">{d}</div>
                ))}

                {Array.from({ length: fday }, (_, i) => (
                  <div key={`b${i}`} className="cal-cell cal-cell--empty" />
                ))}

                {Array.from({ length: dim }, (_, i) => {
                  const day    = i + 1
                  const ds     = iso(year, month, day)
                  const dow    = new Date(year, month, day).getDay()
                  const isPrac = sched.days[dow]?.practice ?? false
                  const meet   = meetsByDate.get(ds)
                  const dayDat = attn[ds]
                  const isToday = ds === todayStr

                  const hasTwoSched = sched.days[dow]?.s2 ?? false
                  const showS2Dot   = !!(dayDat?.s2 || hasTwoSched)

                  return (
                    <div
                      key={day}
                      className={[
                        'cal-cell',
                        isPrac   ? 'cal-cell--prac'     : '',
                        meet     ? 'cal-cell--meet'     : '',
                        isToday  ? 'cal-cell--today'    : '',
                        isPrac   ? 'cal-cell--click'    : '',
                      ].filter(Boolean).join(' ')}
                      style={{ '--ci': i } as React.CSSProperties}
                      onClick={() => isPrac && setDayModal(ds)}
                    >
                      <span className={`cal-cell-num${isToday ? ' today' : ''}`}>{day}</span>

                      {meet && (
                        <div
                          className="cal-meet-chip"
                          onClick={e => { e.stopPropagation(); setMeetModal(meet) }}
                        >
                          <span className="cal-meet-chip-name">{meet.name}</span>
                          {meet.mood && <span>{MOOD.emojis[meet.mood]}</span>}
                        </div>
                      )}

                      {isPrac && !meet && (
                        <div className="cal-cell-dots">
                          {(['s1', 's2'] as const).map(key => {
                            if (key === 's2' && !showS2Dot) return null
                            const s = dayDat?.[key] ?? null
                            const color = !s ? '#e2e8f0'
                              : s.status === 'attended'  ? (s.mood ? MOOD.colors[s.mood] : '#22c55e')
                              : s.status === 'late'      ? '#f59e0b'
                              : s.status === 'cancelled' ? '#94a3b8'
                              : '#ef4444'
                            return (
                              <span
                                key={key}
                                className={`cal-dot${!s ? ' cal-dot--empty' : ''}`}
                                style={{ background: color }}
                                title={s ? `${key.toUpperCase()}: ${s.status}${s.mood ? ` (${MOOD.labels[s.mood]})` : ''}` : `${key.toUpperCase()}: not logged`}
                              />
                            )
                          })}
                          {dayDat?.dryland && (
                            <span
                              className="cal-dot cal-dot--dry"
                              style={{
                                background: DRYLAND_TYPES.find(t => t.id === dayDat.dryland?.type)?.color ?? '#7c3aed',
                              }}
                              title={`Dryland: ${dayDat.dryland.type}`}
                            />
                          )}
                        </div>
                      )}

                      {!isPrac && !meet && (
                        <button
                          className="cal-cell-add-sched"
                          onClick={e => { e.stopPropagation(); setShowSched(true) }}
                          title="Add to schedule"
                        >
                          + Add to schedule
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="cal-legend">
                <span className="cal-legend-item">
                  <span className="cal-dot" style={{ background: '#22c55e' }} /> Attended
                </span>
                <span className="cal-legend-item">
                  <span className="cal-dot" style={{ background: '#f59e0b' }} /> Late
                </span>
                <span className="cal-legend-item">
                  <span className="cal-dot" style={{ background: '#ef4444' }} /> Absent
                </span>
                <span className="cal-legend-item">
                  <span className="cal-dot" style={{ background: '#94a3b8' }} /> Cancelled
                </span>
                <span className="cal-legend-item">
                  <span className="cal-dot" style={{ background: '#7c3aed' }} /> Dryland
                </span>
                <span className="cal-legend-item">
                  <span className="cal-dot cal-dot--empty" style={{ background: '#e2e8f0' }} /> Not logged
                </span>
              </div>

              {/* Meets this month */}
              {meetsThisMonth.length > 0 && (
                <div className="cal-meets-list">
                  <div className="cal-meets-list-head">
                    <h3 className="cal-meets-title">Meets This Month</h3>
                  </div>
                  {meetsThisMonth.map(m => (
                    <div key={m.id} className="cal-meet-row" onClick={() => setMeetModal(m)}>
                      <span className="cal-meet-date">{fmtShort(m.date)}</span>
                      <span className="cal-meet-name">{m.name}</span>
                      {m.mood && <span className="cal-meet-mood">{MOOD.emojis[m.mood]}</span>}
                      <button
                        className="cal-meet-del"
                        onClick={e => { e.stopPropagation(); handleMeetDelete(m.id) }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Month analysis */}
              <MonthReport
                year={year} month={month}
                attendance={attn} meets={meets} schedule={sched}
              />
            </>
          )}

          {/* ── YEAR VIEW ── */}
          {view === 'year' && (
            <YearView
              year={year} setYear={setYear}
              attendance={attn} meets={meets} schedule={sched}
              onSelectMonth={m => { setMonth(m); setView('month') }}
            />
          )}

          {/* ── CAREER VIEW ── */}
          {view === 'career' && (
            <CareerView attendance={attn} meets={meets} schedule={sched} />
          )}

        </div>
      </div>
    </div>
  )
}
