import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Check, User, LogOut, Settings, Trophy, Target, Upload, TrendingUp, X, CalendarCheck, ArrowLeftRight, Bell, Star, Clock, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { playClick, playSave, playNavigate } from '../lib/sounds'
import './Dashboard.css'

type EventEntry = { id: string; label: string }
type StrokeGroup = { stroke: string; events: EventEntry[] }

const LCM_EVENTS: StrokeGroup[] = [
  {
    stroke: 'Freestyle',
    events: [
      { id: '50-free',  label: '50m' },
      { id: '100-free', label: '100m' },
      { id: '200-free', label: '200m' },
      { id: '400-free', label: '400m' },
      { id: '800-free', label: '800m' },
      { id: '1500-free',label: '1500m' },
    ],
  },
  {
    stroke: 'Backstroke',
    events: [
      { id: '50-back',  label: '50m' },
      { id: '100-back', label: '100m' },
      { id: '200-back', label: '200m' },
    ],
  },
  {
    stroke: 'Breaststroke',
    events: [
      { id: '50-breast',  label: '50m' },
      { id: '100-breast', label: '100m' },
      { id: '200-breast', label: '200m' },
    ],
  },
  {
    stroke: 'Butterfly',
    events: [
      { id: '50-fly',  label: '50m' },
      { id: '100-fly', label: '100m' },
      { id: '200-fly', label: '200m' },
    ],
  },
  {
    stroke: 'Individual Medley',
    events: [
      { id: '200-im', label: '200m' },
      { id: '400-im', label: '400m' },
    ],
  },
  {
    stroke: 'Relays',
    events: [
      { id: 'relay-4x50-free',    label: '4×50 Free' },
      { id: 'relay-4x100-free',   label: '4×100 Free' },
      { id: 'relay-4x200-free',   label: '4×200 Free' },
      { id: 'relay-4x100-medley', label: '4×100 Medley' },
      { id: 'relay-4x200-medley', label: '4×200 Medley' },
    ],
  },
]

const SCY_EVENTS: StrokeGroup[] = [
  {
    stroke: 'Freestyle',
    events: [
      { id: '50-free',   label: '50y' },
      { id: '100-free',  label: '100y' },
      { id: '200-free',  label: '200y' },
      { id: '500-free',  label: '500y' },
      { id: '1000-free', label: '1000y' },
      { id: '1650-free', label: '1650y' },
    ],
  },
  {
    stroke: 'Backstroke',
    events: [
      { id: '50-back',  label: '50y' },
      { id: '100-back', label: '100y' },
      { id: '200-back', label: '200y' },
    ],
  },
  {
    stroke: 'Breaststroke',
    events: [
      { id: '50-breast',  label: '50y' },
      { id: '100-breast', label: '100y' },
      { id: '200-breast', label: '200y' },
    ],
  },
  {
    stroke: 'Butterfly',
    events: [
      { id: '50-fly',  label: '50y' },
      { id: '100-fly', label: '100y' },
      { id: '200-fly', label: '200y' },
    ],
  },
  {
    stroke: 'Individual Medley',
    events: [
      { id: '100-im', label: '100y' },
      { id: '200-im', label: '200y' },
      { id: '400-im', label: '400y' },
    ],
  },
  {
    stroke: 'Relays',
    events: [
      { id: 'relay-4x50-free',    label: '4×50 Free' },
      { id: 'relay-4x100-free',   label: '4×100 Free' },
      { id: 'relay-4x200-free',   label: '4×200 Free' },
      { id: 'relay-4x100-medley', label: '4×100 Medley' },
    ],
  },
]

type Course = 'SCY' | 'LCM' | 'SCM'
type Times = Record<string, string>
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface AppNotif {
  id: string
  type: 'pb' | 'standard' | 'stale' | 'tip' | 'goal' | 'motivational'
  title: string
  message: string
}

const MOTIVATIONAL_QUOTES = [
  { title: 'Keep pushing', message: '"The water doesn\'t care how tired you are. Get in and swim." — Unknown' },
  { title: 'One stroke at a time', message: '"The race is long, but so is the lane. Trust your training." — Unknown' },
  { title: 'Champions are made at practice', message: '"You don\'t rise to the level of competition, you fall to the level of your training." — Unknown' },
  { title: 'Motivation for the week', message: '"Pain is temporary. Glory lasts forever. And PRs last until you drop another one." — Unknown' },
  { title: 'Believe in yourself', message: '"The only swimmer you need to beat is the one you were yesterday." — Unknown' },
  { title: 'Stay consistent', message: '"Showing up to practice on the days you don\'t want to is what separates good from great." — Unknown' },
  { title: 'Race to your potential', message: '"Swim fast, rest later. You\'ve got a lifetime for sleep — only a few years to race your best." — Unknown' },
  { title: 'Trust the process', message: '"Every lap, every rep, every early morning is a deposit in the bank of race day." — Unknown' },
]

const MOTIVATIONAL_KEY = 'sw_last_motivational'

function getMotivationalQuote(): AppNotif | null {
  try {
    const stored = JSON.parse(localStorage.getItem(MOTIVATIONAL_KEY) ?? '{}') as { lastShown?: string; idx?: number }
    const now = Date.now()
    const last = stored.lastShown ? new Date(stored.lastShown).getTime() : 0
    const daysSince = (now - last) / 86400000
    if (daysSince < 3.5) return null
    const idx = ((stored.idx ?? 0) + 1) % MOTIVATIONAL_QUOTES.length
    localStorage.setItem(MOTIVATIONAL_KEY, JSON.stringify({ lastShown: new Date().toISOString(), idx }))
    return { id: 'motivational', type: 'motivational', ...MOTIVATIONAL_QUOTES[idx] }
  } catch {
    return null
  }
}

function parseSeconds(t: string): number {
  const parts = t.split(':')
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseFloat(parts[1])
  return parseFloat(t)
}

function generateNotifications(
  times: Times,
  timeHistory: Record<string, { date: string; time: string }[]>,
  notifPrefs: Record<string, boolean>,
): AppNotif[] {
  const notifs: AppNotif[] = []
  const today = new Date()

  // Stale time warnings
  Object.entries(timeHistory).forEach(([key, entries]) => {
    if (!entries || entries.length === 0) return
    const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const days = Math.floor((today.getTime() - new Date(sorted[0].date).getTime()) / 86400000)
    if (days >= 180) {
      const parts = key.split('-')
      const label = parts.slice(2).join(' ')
      notifs.push({
        id: `stale-${key}`,
        type: 'stale',
        title: 'Stale time detected',
        message: `Your ${label} time hasn't been updated in ${days} days. Consider racing this event soon.`,
      })
    }
  })

  // PB detection — most recent vs second-most-recent
  Object.entries(timeHistory).forEach(([key, entries]) => {
    if (!entries || entries.length < 2) return
    const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const latest = parseSeconds(sorted[0].time)
    const prev   = parseSeconds(sorted[1].time)
    if (latest < prev - 0.05) {
      const parts = key.split('-')
      const label = parts.slice(2).join(' ')
      const drop  = (prev - latest).toFixed(2)
      notifs.push({
        id: `pb-${key}`,
        type: 'pb',
        title: `New personal best — ${label}`,
        message: `You dropped ${drop}s on your ${label}. Great swim!`,
      })
    }
  })

  // Tip if no times entered at all
  const hasAny = Object.values(times).some(v => v)
  if (!hasAny) {
    notifs.push({
      id: 'tip-no-times',
      type: 'tip',
      title: 'Get started',
      message: 'Enter your times or import from USA Swimming to unlock comparisons, qualifications, and event planning.',
    })
  }

  // Tip if times exist but no goals set
  if (hasAny && notifs.filter(n => n.type === 'goal').length === 0) {
    notifs.push({
      id: 'tip-set-goals',
      type: 'tip',
      title: 'Set your season goals',
      message: 'Head to Goals and set target times for your key events so SwimSCPlan can track your progress.',
    })
  }

  // Motivational quote (every 3-4 days if enabled)
  if (notifPrefs.motivationalQuotes !== false) {
    const quote = getMotivationalQuote()
    if (quote) notifs.unshift(quote)
  }

  return notifs.slice(0, 15)
}

const NOTIF_ICONS: Record<AppNotif['type'], typeof Bell> = {
  pb:           Zap,
  standard:     Star,
  stale:        Clock,
  tip:          Bell,
  goal:         Target,
  motivational: Star,
}

const NOTIF_COLORS: Record<AppNotif['type'], string> = {
  pb:           '#059669',
  standard:     '#d97706',
  stale:        '#ea580c',
  tip:          '#0891b2',
  goal:         '#7c3aed',
  motivational: '#0369a1',
}

function calcAge(dob: string): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
  return age
}

// Formats raw digits into MM:SS.ss / M:SS.ss / SS.ss as the user types.
// Works right-to-left: last 2 digits are always hundredths, next 2 are seconds, rest is minutes.
function formatTimeDigits(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 6)
  switch (d.length) {
    case 0: return ''
    case 1:
    case 2: return d
    case 3: return `${d[0]}.${d.slice(1)}`
    case 4: return `${d.slice(0, 2)}.${d.slice(2)}`
    case 5: return `${d[0]}:${d.slice(1, 3)}.${d.slice(3)}`
    case 6: return `${d.slice(0, 2)}:${d.slice(2, 4)}.${d.slice(4)}`
    default: return d
  }
}

// Returns true if the seconds portion of a formatted time is 00–59.
function isValidTime(value: string): boolean {
  if (value.length <= 2) return true // still typing
  const match = value.match(/(?:^|:)(\d{2})\./)
  if (!match) return true
  return parseInt(match[1], 10) <= 59
}


export default function Dashboard() {
  const navigate = useNavigate()
  const [username,    setUsername]    = useState('')
  const [fullName,    setFullName]    = useState('')
  const [gender,      setGender]      = useState('')
  const [age,         setAge]         = useState<number | null>(null)
  const [avatarUrl,   setAvatarUrl]   = useState('')
  const [bannerType,  setBannerType]  = useState('default')
  const [bannerValue, setBannerValue] = useState('')
  const [course,      setCourse]      = useState<Course>('SCY')
  const [editing,     setEditing]     = useState(false)
  const [times,       setTimes]       = useState<Times>({})
  const [saveStatus,  setSaveStatus]  = useState<SaveStatus>('idle')
  const [showNotifs,  setShowNotifs]  = useState(false)
  const [timeHistory, setTimeHistory] = useState<Record<string, { date: string; time: string }[]>>({})
  const [timeDate,    setTimeDate]    = useState(new Date().toISOString().slice(0, 10))
  const [notifPrefs,  setNotifPrefs]  = useState<Record<string, boolean>>({ motivationalQuotes: true })
  const [readIds,     setReadIds]     = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('sw_read_notifs') ?? '[]')) }
    catch { return new Set() }
  })

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      if (!user) { navigate('/'); return }
      setUsername(user.user_metadata?.username || user.email || 'Swimmer')
      setFullName(user.user_metadata?.full_name || '')
      setGender(user.user_metadata?.gender || '')
      setAge(calcAge(user.user_metadata?.dob || ''))
      setAvatarUrl(user.user_metadata?.avatar_url || '')
      setBannerType(user.user_metadata?.bannerType || 'default')
      setBannerValue(user.user_metadata?.bannerValue || '')
      setTimes(user.user_metadata?.times || {})
      setTimeHistory(user.user_metadata?.timeHistory || {})
      if (user.user_metadata?.notifPrefs) setNotifPrefs(user.user_metadata.notifPrefs)
    })
  }, [navigate])

  const notifications = generateNotifications(times, timeHistory, notifPrefs)
  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length

  function markAllRead() {
    const next = new Set([...readIds, ...notifications.map(n => n.id)])
    setReadIds(next)
    localStorage.setItem('sw_read_notifs', JSON.stringify([...next]))
  }

  function dismissNotif(id: string) {
    const next = new Set([...readIds, id])
    setReadIds(next)
    localStorage.setItem('sw_read_notifs', JSON.stringify([...next]))
  }

  const persistTimes = useCallback((nextTimes: Times) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSaveStatus('saving')
    debounceRef.current = setTimeout(async () => {
      const { error } = await supabase.auth.updateUser({ data: { times: nextTimes } })
      if (error) { setSaveStatus('error'); return }
      setSaveStatus('saved')
      playSave()
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 700)
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  const groups = course === 'SCY' ? SCY_EVENTS : LCM_EVENTS

  function timeKey(c: Course, eventId: string) {
    return `${c}-${eventId}`
  }

  function handleTimeChange(eventId: string, raw: string) {
    const formatted = formatTimeDigits(raw)
    const key = timeKey(course, eventId)
    setTimes(prev => {
      const next = { ...prev, [key]: formatted }
      persistTimes(next)
      return next
    })
    if (formatted) {
      setTimeHistory(prev => {
        const arr = [...(prev[key] ?? [])]
        const date = timeDate || 'unknown'
        const idx = arr.findIndex(e => e.date === date)
        if (idx >= 0) arr[idx] = { date, time: formatted }
        else arr.push({ date, time: formatted })
        const next = { ...prev, [key]: arr }
        supabase.auth.updateUser({ data: { timeHistory: next } })
        return next
      })
    }
  }

  return (
    <div className="dash-layout">

      {/* ── Sidebar ── */}
      <aside className="dash-sidebar">
        <div className="dash-profile">
          <div className="dash-avatar">
            {avatarUrl
              ? <img src={avatarUrl} alt="Profile" className="dash-avatar-img" />
              : <User size={30} />
            }
          </div>
          <span className="dash-username">{fullName || username || '—'}</span>
          <div className="dash-badges">
            {age !== null && <span className="dash-age">Age {age}</span>}
            {gender && <span className={`dash-gender dash-gender--${gender}`}>{gender === 'male' ? 'Male' : 'Female'}</span>}
          </div>
        </div>

        {/* TODO: Add nav links here (Calendar, Meet Comparison, etc.) */}
        <div className="dash-nav-placeholder" />

        <button className="dash-compare" onClick={() => { playNavigate(); navigate('/compare') }}>
          <span className="dash-compare-icon">⇌</span>
          <span>Compare Standards</span>
        </button>

        <button className="dash-competitions" onClick={() => { playNavigate(); navigate('/qualifications') }}>
          <Trophy size={16} />
          <span>Competitions</span>
        </button>

        <button className="dash-goals" onClick={() => { playNavigate(); navigate('/goals') }}>
          <Target size={16} />
          <span>Goals</span>
        </button>

        <button className="dash-progress" onClick={() => { playNavigate(); navigate('/progress') }}>
          <TrendingUp size={16} />
          <span>Progress</span>
        </button>

        <button className="dash-event-planning" onClick={() => { playNavigate(); navigate('/event-planning') }}>
          <CalendarCheck size={16} />
          <span>Event Planning</span>
        </button>

        <button className="dash-calendar" onClick={() => { playNavigate(); navigate('/calendar') }}>
          <CalendarCheck size={16} />
          <span>Calendar</span>
        </button>

        <button className="dash-time-converter" onClick={() => { playNavigate(); navigate('/time-converter') }}>
          <ArrowLeftRight size={16} />
          <span>Time Converter</span>
        </button>

        <button className="dash-import" onClick={() => { playNavigate(); navigate('/import') }}>
          <Upload size={16} />
          <span>Import Times</span>
        </button>

        <button className="dash-settings" onClick={() => { playNavigate(); navigate('/settings') }}>
          <Settings size={16} />
          <span>Settings</span>
        </button>



        <button className="dash-signout" onClick={() => { playClick(); handleSignOut() }}>
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </aside>

      {/* ── Main ── */}
      <main className="dash-main">

        {/* ── Profile header (SwimCloud style) ── */}
        <div className="dash-profile-header">

          {/* Banner strip */}
          <div className="dash-banner-strip" style={
            bannerType === 'canvas' && bannerValue
              ? { backgroundImage: `url(${bannerValue})`, backgroundSize: 'cover', backgroundPosition: 'center top' }
              : (bannerType === 'gradient' || bannerType === 'color') && bannerValue
              ? { background: bannerValue }
              : undefined
          }>
            <div className="dash-banner-actions">
              <button
                className="dash-bell-btn"
                onClick={() => { setShowNotifs(s => !s); if (!showNotifs) markAllRead() }}
                aria-label="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="dash-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>
              <img src="/logos/scs.svg" alt="Southern California Swimming" className="scs-logo-corner" />
            </div>
          </div>

          {/* Profile bar */}
          <div className="dash-profile-bar">
            <div className="dash-banner-avatar-wrap">
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" className="dash-banner-avatar-img" />
                : <span className="dash-banner-avatar-initials">
                    {(fullName || username || 'S').charAt(0).toUpperCase()}
                  </span>
              }
            </div>
            <div className="dash-profile-meta">
              <h1 className="dash-welcome">{fullName || username || '…'}</h1>
              <p className="dash-profile-sub">
                {[
                  age !== null ? `Age ${age}` : null,
                  gender ? (gender === 'male' ? 'Male' : 'Female') : null,
                  course,
                  'Southern California Swimming',
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
            <button
              className="dash-profile-signout"
              onClick={() => { playClick(); handleSignOut() }}
              title="Sign out"
            >
              <LogOut size={15} />
              <span>Sign out</span>
            </button>
          </div>
        </div>

        {/* ── Notifications panel ── */}
        {showNotifs && (
          <div className="notifs-panel">
            <div className="notifs-header">
              <span className="notifs-title">Notifications</span>
              <button className="notifs-close" onClick={() => setShowNotifs(false)}>
                <X size={16} />
              </button>
            </div>
            {notifications.length === 0 ? (
              <p className="notifs-empty">You're all caught up!</p>
            ) : (
              <ul className="notifs-list">
                {notifications.map(n => {
                  const Icon = NOTIF_ICONS[n.type]
                  const color = NOTIF_COLORS[n.type]
                  const isRead = readIds.has(n.id)
                  return (
                    <li key={n.id} className={`notif-item${isRead ? ' read' : ''}`}>
                      <span className="notif-icon" style={{ color, background: `${color}18` }}>
                        <Icon size={15} />
                      </span>
                      <div className="notif-body">
                        <p className="notif-title">{n.title}</p>
                        <p className="notif-msg">{n.message}</p>
                      </div>
                      <button
                        className="notif-dismiss"
                        onClick={() => dismissNotif(n.id)}
                        aria-label="Dismiss"
                      >
                        <X size={13} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {/* ── Times Panel ── */}
        <section className="times-panel">
          <div className="times-toolbar">
            <div className="times-toolbar-left">
              <span className="times-panel-title">Personal Bests</span>
            </div>
            <div className="times-tabs">
              <button
                className={`times-tab${course === 'SCY' ? ' active' : ''}`}
                onClick={() => setCourse('SCY')}
              >
                SCY
              </button>
              <button
                className={`times-tab${course === 'LCM' ? ' active' : ''}`}
                onClick={() => setCourse('LCM')}
              >
                LCM
              </button>
              <button
                className={`times-tab${course === 'SCM' ? ' active' : ''}`}
                onClick={() => setCourse('SCM')}
              >
                SCM
              </button>
            </div>

            <div className="toolbar-right">
              {editing && (
                <span className={`save-status save-status--${saveStatus}`}>
                  {saveStatus === 'saving' && 'Saving…'}
                  {saveStatus === 'saved'  && '✓ Saved'}
                  {saveStatus === 'error'  && 'Error saving'}
                </span>
              )}
              <button
                className={`edit-btn${editing ? ' active' : ''}`}
                onClick={() => setEditing(e => !e)}
              >
                {editing ? <Check size={15} /> : <Pencil size={15} />}
                {editing ? 'Done' : 'Edit'}
              </button>
            </div>
          </div>

          {editing && (
            <div className="times-format-hint">
              Type <strong>numbers only</strong> — the <strong>:</strong> and <strong>.</strong> are placed automatically.
              &thinsp; Example: type <code>10234</code> to get <strong>1:02.34</strong>.
              &thinsp; Seconds must be 00–59.
            </div>
          )}

          {editing && (
            <div className="times-date-row">
              <label className="times-date-label">Date of these times</label>
              <input
                type="date"
                className="times-date-input"
                value={timeDate}
                onChange={e => setTimeDate(e.target.value)}
              />
              <span className="times-date-hint">Used to log entries in Progress Tracker</span>
            </div>
          )}

          <div className="times-grid">
            {groups.map(({ stroke, events }) => (
              <div
                key={stroke}
                className={`stroke-group${stroke === 'Relays' ? ' stroke-group--relay' : ''}`}
              >
                <h3 className="stroke-heading">{stroke}</h3>
                {events.map(({ id, label }) => (
                  <div key={id} className="event-row">
                    <span className="event-label">{label}</span>
                    {editing ? (
                      <input
                        className={`time-input${isValidTime(times[timeKey(course, id)] ?? '') ? '' : ' time-input--error'}`}
                        placeholder="e.g. 10234"
                        value={times[timeKey(course, id)] ?? ''}
                        onChange={e => handleTimeChange(id, e.target.value)}
                      />
                    ) : (
                      <span className="time-value">
                        {times[timeKey(course, id)] || '—'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* TODO: Add Calendar, Meet Comparison, Progress Chart sections here */}

      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="dash-mobile-nav">
        <button className="dash-mobile-nav-btn" onClick={() => { playNavigate(); navigate('/compare') }}>
          <Trophy size={20} />
          Compare
        </button>
        <button className="dash-mobile-nav-btn" onClick={() => { playNavigate(); navigate('/qualifications') }}>
          <Star size={20} />
          Quals
        </button>
        <button className="dash-mobile-nav-btn" onClick={() => { playNavigate(); navigate('/event-planning') }}>
          <CalendarCheck size={20} />
          Events
        </button>
        <button className="dash-mobile-nav-btn" onClick={() => { playNavigate(); navigate('/goals') }}>
          <Target size={20} />
          Goals
        </button>
        <button className="dash-mobile-nav-btn" onClick={() => { playNavigate(); navigate('/settings') }}>
          <Settings size={20} />
          Settings
        </button>
        <button className="dash-mobile-nav-btn" onClick={() => { playNavigate(); navigate('/calendar') }}>
          <CalendarCheck size={20} />
          Calendar
        </button>
      </nav>
    </div>
  )
}
