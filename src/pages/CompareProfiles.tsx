import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getProfile } from '../lib/friends'
import type { Profile } from '../lib/friends'
import './CompareProfiles.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseSec(t: string): number | null {
  if (!t) return null
  const parts = t.split(':')
  if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1])
  return parseFloat(parts[0])
}

function initials(name: string | null, username: string) {
  const src = name || username
  return src.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function avatarBg(id: string) {
  const p = ['#0077b6','#0096c7','#00b4d8','#023e8a','#0369a1','#0891b2','#005f73']
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return p[h % p.length]
}

// ── Event definitions ─────────────────────────────────────────────────────────

interface EventDef { key: string; label: string; stroke: string }

const SCY_EVENTS: EventDef[] = [
  { key: 'SCY-50-free',    label: '50 Free',    stroke: 'Freestyle' },
  { key: 'SCY-100-free',   label: '100 Free',   stroke: 'Freestyle' },
  { key: 'SCY-200-free',   label: '200 Free',   stroke: 'Freestyle' },
  { key: 'SCY-500-free',   label: '500 Free',   stroke: 'Freestyle' },
  { key: 'SCY-1000-free',  label: '1000 Free',  stroke: 'Freestyle' },
  { key: 'SCY-1650-free',  label: '1650 Free',  stroke: 'Freestyle' },
  { key: 'SCY-100-back',   label: '100 Back',   stroke: 'Backstroke' },
  { key: 'SCY-200-back',   label: '200 Back',   stroke: 'Backstroke' },
  { key: 'SCY-100-breast', label: '100 Breast', stroke: 'Breaststroke' },
  { key: 'SCY-200-breast', label: '200 Breast', stroke: 'Breaststroke' },
  { key: 'SCY-100-fly',    label: '100 Fly',    stroke: 'Butterfly' },
  { key: 'SCY-200-fly',    label: '200 Fly',    stroke: 'Butterfly' },
  { key: 'SCY-200-im',     label: '200 IM',     stroke: 'IM' },
  { key: 'SCY-400-im',     label: '400 IM',     stroke: 'IM' },
]

const LCM_EVENTS: EventDef[] = [
  { key: 'LCM-50-free',    label: '50 Free',    stroke: 'Freestyle' },
  { key: 'LCM-100-free',   label: '100 Free',   stroke: 'Freestyle' },
  { key: 'LCM-200-free',   label: '200 Free',   stroke: 'Freestyle' },
  { key: 'LCM-400-free',   label: '400 Free',   stroke: 'Freestyle' },
  { key: 'LCM-800-free',   label: '800 Free',   stroke: 'Freestyle' },
  { key: 'LCM-1500-free',  label: '1500 Free',  stroke: 'Freestyle' },
  { key: 'LCM-100-back',   label: '100 Back',   stroke: 'Backstroke' },
  { key: 'LCM-200-back',   label: '200 Back',   stroke: 'Backstroke' },
  { key: 'LCM-100-breast', label: '100 Breast', stroke: 'Breaststroke' },
  { key: 'LCM-200-breast', label: '200 Breast', stroke: 'Breaststroke' },
  { key: 'LCM-100-fly',    label: '100 Fly',    stroke: 'Butterfly' },
  { key: 'LCM-200-fly',    label: '200 Fly',    stroke: 'Butterfly' },
  { key: 'LCM-200-im',     label: '200 IM',     stroke: 'IM' },
  { key: 'LCM-400-im',     label: '400 IM',     stroke: 'IM' },
]

// ── Avatar component ──────────────────────────────────────────────────────────

function Avatar({ id, name, username, avatarUrl, size = 72, animate = false }:
  { id: string; name: string | null; username: string; avatarUrl: string | null; size?: number; animate?: boolean }) {
  return avatarUrl
    ? <img src={avatarUrl} className={`cp-avatar-img${animate ? ' cp-avatar-img--anim' : ''}`}
        style={{ width: size, height: size }} alt="" />
    : <div className={`cp-avatar-init${animate ? ' cp-avatar-init--anim' : ''}`}
        style={{ width: size, height: size, background: avatarBg(id), fontSize: size * 0.36 }}>
        {initials(name, username)}
      </div>
}

// ── Score counter (animated) ──────────────────────────────────────────────────

function ScoreCount({ target, delay = 0 }: { target: number; delay?: number }) {
  const [display, setDisplay] = useState(0)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    const start = performance.now() + delay * 1000
    function tick(now: number) {
      const elapsed = now - start
      if (elapsed < 0) { raf.current = requestAnimationFrame(tick); return }
      const progress = Math.min(elapsed / 800, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(target * ease))
      if (progress < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target, delay])
  return <>{display}</>
}

// ── Event row ─────────────────────────────────────────────────────────────────

interface RowProps {
  ev:       EventDef
  myTime:   string
  theirTime: string
  index:    number
  revealed: boolean
}

function EventRow({ ev, myTime, theirTime, index, revealed }: RowProps) {
  const mySec    = parseSec(myTime)
  const theirSec = parseSec(theirTime)

  let myWins = false, theyWin = false
  if (mySec !== null && theirSec !== null) {
    if (mySec < theirSec)    myWins = true
    else if (theirSec < mySec) theyWin = true
  }

  // Speed bar: proportion of advantage
  let myBar = 50, theirBar = 50
  if (mySec !== null && theirSec !== null && mySec !== theirSec) {
    const total = mySec + theirSec
    // Faster swimmer gets a bigger bar
    theirBar = Math.round((mySec   / total) * 100)
    myBar    = Math.round((theirSec / total) * 100)
  }

  const delay = 0.15 + index * 0.06

  return (
    <div
      className={`cp-row${revealed ? ' cp-row--in' : ''}`}
      style={{ animationDelay: `${delay}s` }}
    >
      {/* My time */}
      <div className={`cp-cell cp-cell--left${myWins ? ' cp-cell--win' : theyWin ? ' cp-cell--lose' : ''}`}>
        <span className="cp-time">{myTime || '—'}</span>
        {myWins && <span className="cp-win-badge">▲</span>}
      </div>

      {/* Event label + bar */}
      <div className="cp-cell cp-cell--mid">
        <span className="cp-ev-label">{ev.label}</span>
        {mySec !== null && theirSec !== null && (
          <div className="cp-bar-wrap">
            <div
              className={`cp-bar cp-bar--left${myWins ? ' cp-bar--green' : theyWin ? ' cp-bar--red' : ''}`}
              style={{ width: `${myBar}%` }}
            />
            <div
              className={`cp-bar cp-bar--right${theyWin ? ' cp-bar--green' : myWins ? ' cp-bar--red' : ''}`}
              style={{ width: `${theirBar}%` }}
            />
          </div>
        )}
      </div>

      {/* Their time */}
      <div className={`cp-cell cp-cell--right${theyWin ? ' cp-cell--win' : myWins ? ' cp-cell--lose' : ''}`}>
        {theyWin && <span className="cp-win-badge">▲</span>}
        <span className="cp-time">{theirTime || '—'}</span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CompareProfiles() {
  const { userId }  = useParams<{ userId: string }>()
  const navigate    = useNavigate()

  const [loading,      setLoading]      = useState(true)
  const [myId,         setMyId]         = useState('')
  const [myName,       setMyName]       = useState<string | null>(null)
  const [myUsername,   setMyUsername]   = useState('')
  const [myAvatar,     setMyAvatar]     = useState<string | null>(null)
  const [myTimes,      setMyTimes]      = useState<Record<string, string>>({})
  const [them,         setThem]         = useState<Profile | null>(null)
  const [revealed,     setRevealed]     = useState(false)
  const [showBanner,   setShowBanner]   = useState(false)
  const didInit = useRef(false)

  useEffect(() => {
    if (!userId || didInit.current) return
    didInit.current = true
    async function load() {
      const [{ data: { user } }, profileRes] = await Promise.all([
        supabase.auth.getUser(),
        getProfile(userId!),
      ])
      if (!user) { navigate('/sign-in'); return }
      const m = user.user_metadata ?? {}
      setMyId(user.id)
      setMyName(m.full_name ?? null)
      setMyUsername(m.username ?? '')
      setMyAvatar(m.avatar_url ?? null)
      setMyTimes(m.times ?? {})
      if (profileRes.data) setThem(profileRes.data as Profile)
      setLoading(false)
      // Stagger the entrance animations
      setTimeout(() => setShowBanner(true), 80)
      setTimeout(() => setRevealed(true), 600)
    }
    load()
  }, [userId, navigate])

  if (loading) {
    return (
      <div className="cp-page cp-page--loading">
        <div className="cp-spinner" />
      </div>
    )
  }

  if (!them) {
    return (
      <div className="cp-page cp-page--404">
        <button className="cp-back" onClick={() => navigate(-1)}>
          <ChevronLeft size={18} /> Back
        </button>
        <p>Swimmer not found.</p>
      </div>
    )
  }

  const theirTimes = them.times ?? {}

  // Build rows for each course (only events where at least one user has a time)
  function buildRows(events: EventDef[]) {
    return events.filter(ev => myTimes[ev.key] || theirTimes[ev.key])
  }

  const scyRows = buildRows(SCY_EVENTS)
  const lcmRows = buildRows(LCM_EVENTS)

  // Tally wins
  let myWins = 0, theirWins = 0, ties = 0
  ;[...SCY_EVENTS, ...LCM_EVENTS].forEach(ev => {
    const m = parseSec(myTimes[ev.key] ?? '')
    const t = parseSec(theirTimes[ev.key] ?? '')
    if (m === null || t === null) return
    if (m < t) myWins++
    else if (t < m) theirWins++
    else ties++
  })

  const iWin = myWins > theirWins

  // Stroke order for section headers
  const scyStrokes  = [...new Set(scyRows.map(e => e.stroke))]
  const lcmStrokes  = [...new Set(lcmRows.map(e => e.stroke))]

  let rowIndex = 0

  return (
    <div className="cp-page">

      {/* ── Back ── */}
      <button className="cp-back" onClick={() => navigate(`/profile/${userId}`)}>
        <ChevronLeft size={18} /> Back to Profile
      </button>

      {/* ── VS Banner ── */}
      <div className={`cp-banner${showBanner ? ' cp-banner--in' : ''}`}>

        {/* My side */}
        <div className="cp-side cp-side--left">
          <Avatar id={myId} name={myName} username={myUsername}
            avatarUrl={myAvatar} size={80} animate={showBanner} />
          <div className="cp-side-name">{myName || myUsername || 'Me'}</div>
          <div className={`cp-side-score${iWin ? ' cp-side-score--winner' : ''}`}>
            <span className="cp-score-num"><ScoreCount target={myWins} delay={0.7} /></span>
            <span className="cp-score-label">wins</span>
          </div>
        </div>

        {/* VS badge */}
        <div className={`cp-vs${showBanner ? ' cp-vs--in' : ''}`}>
          <span className="cp-vs-text">VS</span>
          {ties > 0 && <span className="cp-ties">{ties} tie{ties !== 1 ? 's' : ''}</span>}
        </div>

        {/* Their side */}
        <div className="cp-side cp-side--right">
          <Avatar id={them.id} name={them.full_name} username={them.username}
            avatarUrl={them.avatar_url} size={80} animate={showBanner} />
          <div className="cp-side-name">{them.full_name || them.username}</div>
          <div className={`cp-side-score${!iWin && myWins !== theirWins ? ' cp-side-score--winner' : ''}`}>
            <span className="cp-score-num"><ScoreCount target={theirWins} delay={0.7} /></span>
            <span className="cp-score-label">wins</span>
          </div>
        </div>

        {/* Win banner */}
        {myWins + theirWins > 0 && (
          <div className={`cp-verdict${revealed ? ' cp-verdict--in' : ''}`}>
            {myWins > theirWins
              ? '🏆 You\'re ahead!'
              : theirWins > myWins
              ? `${them.full_name || them.username} is ahead`
              : '🤝 Neck and neck'}
          </div>
        )}
      </div>

      {/* ── Column headers ── */}
      {(scyRows.length > 0 || lcmRows.length > 0) && (
        <div className={`cp-col-headers${revealed ? ' cp-col-headers--in' : ''}`}>
          <div className="cp-col-me">{myName || myUsername || 'Me'}</div>
          <div className="cp-col-ev">Event</div>
          <div className="cp-col-them">{them.full_name || them.username}</div>
        </div>
      )}

      {/* ── SCY ── */}
      {scyRows.length > 0 && (
        <div className="cp-section">
          <div className={`cp-section-head${revealed ? ' cp-section-head--in' : ''}`}>
            Short Course Yards
          </div>
          {scyStrokes.map(stroke => (
            <div key={stroke} className="cp-stroke-group">
              <div className={`cp-stroke-label${revealed ? ' cp-stroke-label--in' : ''}`}>{stroke}</div>
              {scyRows.filter(e => e.stroke === stroke).map(ev => (
                <EventRow
                  key={ev.key}
                  ev={ev}
                  myTime={myTimes[ev.key] ?? ''}
                  theirTime={theirTimes[ev.key] ?? ''}
                  index={rowIndex++}
                  revealed={revealed}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── LCM ── */}
      {lcmRows.length > 0 && (
        <div className="cp-section">
          <div className={`cp-section-head${revealed ? ' cp-section-head--in' : ''}`}>
            Long Course Meters
          </div>
          {lcmStrokes.map(stroke => (
            <div key={stroke} className="cp-stroke-group">
              <div className={`cp-stroke-label${revealed ? ' cp-stroke-label--in' : ''}`}>{stroke}</div>
              {lcmRows.filter(e => e.stroke === stroke).map(ev => (
                <EventRow
                  key={ev.key}
                  ev={ev}
                  myTime={myTimes[ev.key] ?? ''}
                  theirTime={theirTimes[ev.key] ?? ''}
                  index={rowIndex++}
                  revealed={revealed}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {scyRows.length === 0 && lcmRows.length === 0 && (
        <div className="cp-empty">
          <span>🏊</span>
          <p>Neither swimmer has recorded times for matching events yet.</p>
        </div>
      )}

      {/* bottom padding */}
      <div style={{ height: 60 }} />
    </div>
  )
}
