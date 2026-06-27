import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, ChevronLeft, ChevronRight, Plus, X, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import TimeConverterPopup from '../components/TimeConverterPopup'
import './Calendar.css'

// ── Types ──────────────────────────────────────────────────────────────────

interface Meet {
  id: string
  name: string
  date: string // YYYY-MM-DD
}

interface ScheduleTemplate {
  days: number[]       // 0=Sun … 6=Sat
  practiceNote: string
  drylandDays: number[]
}

interface DayData {
  attended: boolean
  hasDryland: boolean
}

type AttendanceMap = Record<string, DayData> // key: YYYY-MM-DD

// ── Helpers ────────────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_LABELS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// ── Component ───────────────────────────────────────────────────────────────

export default function Calendar() {
  const navigate  = useNavigate()
  const today     = new Date()

  const [year,        setYear]        = useState(today.getFullYear())
  const [month,       setMonth]       = useState(today.getMonth())
  const [meets,       setMeets]       = useState<Meet[]>([])
  const [attendance,  setAttendance]  = useState<AttendanceMap>({})
  const [schedule,    setSchedule]    = useState<ScheduleTemplate>({
    days: [1, 2, 3, 4, 5],
    practiceNote: '',
    drylandDays: [],
  })
  const [showAddMeet,  setShowAddMeet]  = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [showTC,       setShowTC]       = useState(false)
  const [newMeetName,  setNewMeetName]  = useState('')
  const [newMeetDate,  setNewMeetDate]  = useState('')
  const [saving,       setSaving]       = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      if (!user) { navigate('/'); return }
      const m = user.user_metadata ?? {}
      setMeets(m.calMeets ?? [])
      setAttendance(m.calAttendance ?? {})
      if (m.calSchedule) setSchedule(m.calSchedule)
    })
  }, [navigate])

  async function persist(patch: object) {
    setSaving(true)
    await supabase.auth.updateUser({ data: patch })
    setSaving(false)
  }

  // ── Meet CRUD ──────────────────────────────────────────────────────────

  async function addMeet() {
    if (!newMeetName.trim() || !newMeetDate) return
    const next: Meet[] = [...meets, { id: crypto.randomUUID(), name: newMeetName.trim(), date: newMeetDate }]
    setMeets(next)
    setNewMeetName('')
    setNewMeetDate('')
    setShowAddMeet(false)
    await persist({ calMeets: next })
  }

  async function deleteMeet(id: string) {
    const next = meets.filter(m => m.id !== id)
    setMeets(next)
    await persist({ calMeets: next })
  }

  // ── Attendance ─────────────────────────────────────────────────────────

  async function toggleAttended(dateStr: string) {
    const cur = attendance[dateStr] ?? { attended: false, hasDryland: false }
    const next = { ...attendance, [dateStr]: { ...cur, attended: !cur.attended } }
    setAttendance(next)
    await persist({ calAttendance: next })
  }

  async function toggleDryland(dateStr: string) {
    const cur = attendance[dateStr] ?? { attended: false, hasDryland: false }
    const next = { ...attendance, [dateStr]: { ...cur, hasDryland: !cur.hasDryland } }
    setAttendance(next)
    await persist({ calAttendance: next })
  }

  // ── Schedule template ──────────────────────────────────────────────────

  async function saveSchedule(s: ScheduleTemplate) {
    setSchedule(s)
    await persist({ calSchedule: s })
  }

  function toggleScheduleDay(day: number) {
    const days = schedule.days.includes(day)
      ? schedule.days.filter(d => d !== day)
      : [...schedule.days, day]
    saveSchedule({ ...schedule, days })
  }

  function toggleDrylandDay(day: number) {
    const drylandDays = schedule.drylandDays.includes(day)
      ? schedule.drylandDays.filter(d => d !== day)
      : [...schedule.drylandDays, day]
    saveSchedule({ ...schedule, drylandDays })
  }

  // ── Navigation ─────────────────────────────────────────────────────────

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  // ── Calendar grid ──────────────────────────────────────────────────────

  const dim  = daysInMonth(year, month)
  const fday = firstDayOfMonth(year, month)

  // Meets this month
  const meetsByDate = new Map<string, Meet>()
  meets.forEach(m => { if (m.date.startsWith(`${year}-${String(month+1).padStart(2,'0')}`)) meetsByDate.set(m.date, m) })

  // ── Report ─────────────────────────────────────────────────────────────

  const practiceDaysThisMonth: string[] = []
  for (let d = 1; d <= dim; d++) {
    const date = new Date(year, month, d)
    if (schedule.days.includes(date.getDay())) {
      practiceDaysThisMonth.push(isoDate(year, month, d))
    }
  }
  const totalPracticeDays = practiceDaysThisMonth.length
  const attended = practiceDaysThisMonth.filter(dateStr => attendance[dateStr]?.attended).length
  const pct = totalPracticeDays > 0 ? Math.round((attended / totalPracticeDays) * 100) : 0
  const meetsThisMonth = meets.filter(m => m.date.startsWith(`${year}-${String(month+1).padStart(2,'0')}`)).length

  const todayStr = isoDate(today.getFullYear(), today.getMonth(), today.getDate())

  return (
    <div className="cal-layout">
      <TimeConverterPopup isOpen={showTC} onClose={() => setShowTC(false)} />
      <aside className="cal-sidebar">
        <div className="cal-sidebar-brand">Calendar</div>
        <nav className="cal-sidebar-nav">
          <button className="cal-nav-btn" onClick={() => navigate('/dashboard')}>
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </button>
        </nav>
        <div className="cal-sidebar-actions">
          <button className="cal-sidebar-action-btn" onClick={() => setShowAddMeet(true)}>
            <Plus size={14} /> Add Meet
          </button>
          <button className="cal-sidebar-action-btn" onClick={() => setShowSchedule(v => !v)}>
            {showSchedule ? 'Close Schedule' : 'Edit Schedule'}
          </button>
        </div>
        {saving && <div className="cal-saving">Saving…</div>}
      </aside>

      <div className="cal-page">
        <div className="cal-header">
          <div className="cal-header-info">
            <h1 className="cal-title">Practice Calendar</h1>
            <p className="cal-subtitle">Track attendance, dryland, and meets</p>
          </div>
          <img src="/logos/scs.svg" alt="Southern California Swimming" className="scs-logo-corner" />
        </div>

        <div className="cal-body">

          {/* ── Schedule editor ── */}
          {showSchedule && (
            <div className="cal-card cal-schedule-card">
              <h2 className="cal-card-title">Practice Schedule Template</h2>
              <p className="cal-card-desc">Select which days of the week you normally have practice.</p>

              <div className="cal-day-grid">
                {DAY_LABELS.map((lbl, i) => (
                  <button
                    key={i}
                    className={`cal-day-toggle${schedule.days.includes(i) ? ' active' : ''}`}
                    onClick={() => toggleScheduleDay(i)}
                  >{lbl}</button>
                ))}
              </div>

              <p className="cal-card-desc" style={{ marginTop: 14 }}>Dryland days:</p>
              <div className="cal-day-grid">
                {DAY_LABELS.map((lbl, i) => (
                  <button
                    key={i}
                    className={`cal-day-toggle cal-day-toggle--dryland${schedule.drylandDays.includes(i) ? ' active' : ''}`}
                    onClick={() => toggleDrylandDay(i)}
                  >{lbl}</button>
                ))}
              </div>

              <div className="cal-field" style={{ marginTop: 14 }}>
                <label className="cal-label">Practice note (optional)</label>
                <input
                  className="cal-input"
                  value={schedule.practiceNote}
                  onChange={e => saveSchedule({ ...schedule, practiceNote: e.target.value })}
                  placeholder="e.g. 6:00–8:00 AM at Rosemead Aquatics"
                />
              </div>
            </div>
          )}

          {/* ── Add meet modal ── */}
          {showAddMeet && (
            <div className="cal-card cal-meet-add-card">
              <h2 className="cal-card-title">Add Meet</h2>
              <div className="cal-field">
                <label className="cal-label">Meet Name</label>
                <input
                  className="cal-input"
                  value={newMeetName}
                  onChange={e => setNewMeetName(e.target.value)}
                  placeholder="e.g. SCS Junior Championships"
                  autoFocus
                />
              </div>
              <div className="cal-field">
                <label className="cal-label">Date</label>
                <input
                  className="cal-input"
                  type="date"
                  value={newMeetDate}
                  onChange={e => setNewMeetDate(e.target.value)}
                />
              </div>
              <div className="cal-meet-add-actions">
                <button className="cal-btn-cancel" onClick={() => setShowAddMeet(false)}>Cancel</button>
                <button className="cal-btn-save" onClick={addMeet} disabled={!newMeetName.trim() || !newMeetDate}>Save</button>
              </div>
            </div>
          )}

          {/* ── Month navigation ── */}
          <div className="cal-month-nav">
            <button className="cal-month-arrow" onClick={prevMonth}><ChevronLeft size={18} /></button>
            <span className="cal-month-label">{MONTH_NAMES[month]} {year}</span>
            <button className="cal-month-arrow" onClick={nextMonth}><ChevronRight size={18} /></button>
          </div>

          {/* ── Grid ── */}
          <div className="cal-grid">
            {DAY_LABELS.map(d => (
              <div key={d} className="cal-grid-head">{d}</div>
            ))}

            {/* Blank cells before first day */}
            {Array.from({ length: fday }, (_, i) => (
              <div key={`blank-${i}`} className="cal-cell cal-cell--empty" />
            ))}

            {/* Day cells */}
            {Array.from({ length: dim }, (_, i) => {
              const day     = i + 1
              const dateStr = isoDate(year, month, day)
              const dow     = new Date(year, month, day).getDay()
              const isPractice = schedule.days.includes(dow)
              const isDryland  = schedule.drylandDays.includes(dow)
              const meet       = meetsByDate.get(dateStr)
              const dayData    = attendance[dateStr]
              const isToday    = dateStr === todayStr

              return (
                <div
                  key={day}
                  className={[
                    'cal-cell',
                    isPractice  ? 'cal-cell--practice' : '',
                    meet        ? 'cal-cell--meet' : '',
                    isToday     ? 'cal-cell--today' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <div className="cal-cell-num">{day}</div>

                  {meet && (
                    <div className="cal-cell-meet-label">
                      {meet.name}
                      <button className="cal-cell-meet-del" onClick={() => deleteMeet(meet.id)} title="Remove meet">
                        <X size={9} />
                      </button>
                    </div>
                  )}

                  {isPractice && (
                    <div className="cal-cell-checks">
                      <button
                        className={`cal-check-btn${dayData?.attended ? ' active' : ''}`}
                        onClick={() => toggleAttended(dateStr)}
                        title="Mark attendance"
                      >
                        <Check size={11} />
                        <span>Here</span>
                      </button>
                      {isDryland && (
                        <button
                          className={`cal-check-btn cal-check-btn--dry${dayData?.hasDryland ? ' active' : ''}`}
                          onClick={() => toggleDryland(dateStr)}
                          title="Mark dryland"
                        >
                          <Check size={11} />
                          <span>Dry</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Report ── */}
          <div className="cal-report">
            <h2 className="cal-report-title">{MONTH_NAMES[month]} Report</h2>
            <div className="cal-report-stats">
              <div className="cal-report-stat">
                <div className="cal-report-val">{attended}/{totalPracticeDays}</div>
                <div className="cal-report-lbl">Practices Attended</div>
              </div>
              <div className="cal-report-stat">
                <div className="cal-report-val">{pct}%</div>
                <div className="cal-report-lbl">Attendance Rate</div>
              </div>
              <div className="cal-report-stat">
                <div className="cal-report-val">{meetsThisMonth}</div>
                <div className="cal-report-lbl">Meets This Month</div>
              </div>
            </div>
            {schedule.practiceNote && (
              <p className="cal-report-note">{schedule.practiceNote}</p>
            )}
          </div>

          {/* ── Meets list ── */}
          {meets.length > 0 && (
            <div className="cal-meets-list">
              <h2 className="cal-meets-title">All Meets</h2>
              {[...meets].sort((a, b) => a.date.localeCompare(b.date)).map(m => (
                <div key={m.id} className="cal-meet-row">
                  <span className="cal-meet-date">{m.date}</span>
                  <span className="cal-meet-name">{m.name}</span>
                  <button className="cal-meet-del" onClick={() => deleteMeet(m.id)}><X size={13} /></button>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
