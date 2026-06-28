import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, TrendingUp, Trash2, AlertTriangle, ChevronDown, ArrowRightLeft, ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import TimeConverterPopup from '../components/TimeConverterPopup'
import './Progress.css'

// ─── Types & Data ───────────────────────────────────────────────────────────

type Course = 'SCY' | 'LCM' | 'SCM'
type TimeEntry  = { date: string; time: string; meet?: string }
type TimeHistory = Record<string, TimeEntry[]>
type HistoryView = 'fastest' | 'by-meets' | 'by-events'

const SCY_GROUPS = [
  { stroke: 'Freestyle',         events: [{ id: '50-free',   label: '50y'   }, { id: '100-free',  label: '100y'  }, { id: '200-free',  label: '200y'  }, { id: '500-free',  label: '500y'  }, { id: '1000-free', label: '1000y' }, { id: '1650-free', label: '1650y' }] },
  { stroke: 'Backstroke',        events: [{ id: '50-back',   label: '50y'   }, { id: '100-back',  label: '100y'  }, { id: '200-back',  label: '200y'  }] },
  { stroke: 'Breaststroke',      events: [{ id: '50-breast', label: '50y'   }, { id: '100-breast',label: '100y'  }, { id: '200-breast',label: '200y'  }] },
  { stroke: 'Butterfly',         events: [{ id: '50-fly',    label: '50y'   }, { id: '100-fly',   label: '100y'  }, { id: '200-fly',   label: '200y'  }] },
  { stroke: 'Individual Medley', events: [{ id: '100-im',    label: '100y'  }, { id: '200-im',    label: '200y'  }, { id: '400-im',    label: '400y'  }] },
]

const LCM_GROUPS = [
  { stroke: 'Freestyle',         events: [{ id: '50-free',   label: '50m'   }, { id: '100-free',  label: '100m'  }, { id: '200-free',  label: '200m'  }, { id: '400-free',  label: '400m'  }, { id: '800-free',  label: '800m'  }, { id: '1500-free', label: '1500m' }] },
  { stroke: 'Backstroke',        events: [{ id: '50-back',   label: '50m'   }, { id: '100-back',  label: '100m'  }, { id: '200-back',  label: '200m'  }] },
  { stroke: 'Breaststroke',      events: [{ id: '50-breast', label: '50m'   }, { id: '100-breast',label: '100m'  }, { id: '200-breast',label: '200m'  }] },
  { stroke: 'Butterfly',         events: [{ id: '50-fly',    label: '50m'   }, { id: '100-fly',   label: '100m'  }, { id: '200-fly',   label: '200m'  }] },
  { stroke: 'Individual Medley', events: [{ id: '200-im',    label: '200m'  }, { id: '400-im',    label: '400m'  }] },
]

const SCM_GROUPS = LCM_GROUPS

// ─── Helpers ────────────────────────────────────────────────────────────────

function toSec(t: string): number | null {
  if (!t) return null
  const p = t.split(':')
  return p.length === 2 ? parseFloat(p[0]) * 60 + parseFloat(p[1]) : parseFloat(t)
}

function fmtSec(s: number): string {
  if (s < 60) return s.toFixed(2)
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toFixed(2).padStart(5, '0')}`
}

function fmtDate(iso: string): string {
  if (iso === 'unknown') return 'Date unknown'
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtDateShort(iso: string): string {
  if (iso === 'unknown') return '?'
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  })
}

function fmtDateMonth(iso: string): string {
  if (iso === 'unknown') return '?'
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', year: 'numeric',
  })
}

// ─── SVG Chart ──────────────────────────────────────────────────────────────

const VW = 640, VH = 280
const MG = { t: 24, r: 24, b: 52, l: 72 }
const CW = VW - MG.l - MG.r
const CH = VH - MG.t - MG.b

function calcAgeAtDate(dob: string, dateStr: string): number | null {
  if (!dob || !dateStr || dateStr === 'unknown') return null
  const birth  = new Date(dob  + 'T12:00:00')
  const swimDt = new Date(dateStr + 'T12:00:00')
  let age = swimDt.getFullYear() - birth.getFullYear()
  const m = swimDt.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && swimDt.getDate() < birth.getDate())) age--
  return age >= 0 ? age : null
}

function LineChart({ entries, dob, fastest }: { entries: TimeEntry[]; dob: string; fastest: TimeEntry | null }) {
  const [hovIdx, setHovIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  if (entries.length === 0) {
    return (
      <div className="prog-empty">
        <TrendingUp size={44} className="prog-empty-icon" />
        <p>Add entries below to start tracking your progression.</p>
      </div>
    )
  }

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const secs   = sorted.map(e => toSec(e.time) ?? 0)
  const dms    = sorted.map(e => new Date(e.date + 'T12:00:00').getTime())

  const minS = Math.min(...secs)
  const maxS = Math.max(...secs)
  const pad  = (maxS - minS) * 0.18 || 1.5
  const yLo  = Math.max(0, minS - pad)
  const yHi  = maxS + pad

  const dLo  = dms[0]
  const dHi  = dms[dms.length - 1]
  const dRng = dHi - dLo || 1

  const xOf = (d: number) => MG.l + ((d - dLo) / dRng) * CW
  // Invert: fast (low seconds) → top (low SVG y)
  const yOf = (s: number) => MG.t + (1 - (s - yLo) / (yHi - yLo)) * CH

  // Y ticks — 5, from fast (top) to slow (bottom) so we display inverted axis
  const yTicks = Array.from({ length: 5 }, (_, i) => yHi - (yHi - yLo) * (i / 4))

  let xTicks = sorted.map((e, i) => ({ ms: dms[i], label: e.date }))
  if (xTicks.length > 6) {
    const step = Math.ceil(xTicks.length / 5)
    xTicks = xTicks.filter((_, i) => i % step === 0 || i === xTicks.length - 1)
  }

  const ptStr   = sorted.map((_, i) => `${xOf(dms[i]).toFixed(1)},${yOf(secs[i]).toFixed(1)}`).join(' ')
  const areaStr = `${xOf(dms[0]).toFixed(1)},${(MG.t + CH).toFixed(1)} ${ptStr} ${xOf(dms[dms.length-1]).toFixed(1)},${(MG.t + CH).toFixed(1)}`

  // Tooltip for hovered point
  const hov = hovIdx !== null ? sorted[hovIdx] : null
  const hovX = hovIdx !== null ? xOf(dms[hovIdx]) : 0
  const hovY = hovIdx !== null ? yOf(secs[hovIdx]) : 0
  const hovAge = hov ? calcAgeAtDate(dob, hov.date) : null

  // Tooltip box dimensions
  const TW = 150, TH = hovAge !== null ? 70 : 56, TR = 6
  // Clamp tooltip so it stays inside SVG
  const txRaw = hovX - TW / 2
  const tx = Math.max(MG.l, Math.min(txRaw, VW - MG.r - TW))
  const ty = hovY - TH - 14 < MG.t ? hovY + 14 : hovY - TH - 14

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VW} ${VH}`}
      className="prog-chart-svg"
      role="img"
      aria-label="Time progression chart"
      onMouseLeave={() => setHovIdx(null)}
    >
      <defs>
        <linearGradient id="prog-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#00b4d8" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#00b4d8" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Horizontal grid lines */}
      {yTicks.map((s, i) => (
        <line key={i}
          x1={MG.l} y1={yOf(s).toFixed(1)}
          x2={MG.l + CW} y2={yOf(s).toFixed(1)}
          stroke="#e2e8f0" strokeWidth="1"
          strokeDasharray={i === 0 || i === 4 ? undefined : '4 3'}
        />
      ))}

      {/* Y labels (times, top = fast) */}
      {yTicks.map((s, i) => (
        <text key={i}
          x={MG.l - 8} y={(yOf(s) + 4).toFixed(1)}
          textAnchor="end" fontSize="11" fill="#64748b" fontFamily="inherit"
        >
          {fmtSec(s)}
        </text>
      ))}

      {/* X labels */}
      {xTicks.map(({ ms, label }) => (
        <text key={label}
          x={xOf(ms).toFixed(1)} y={(MG.t + CH + 18).toFixed(1)}
          textAnchor="middle" fontSize="11" fill="#64748b" fontFamily="inherit"
        >
          {fmtDateShort(label)}
        </text>
      ))}

      {/* Area fill */}
      {sorted.length > 1 && <polygon points={areaStr} fill="url(#prog-area-grad)" />}

      {/* Line */}
      {sorted.length > 1 && (
        <polyline points={ptStr} fill="none"
          stroke="#00b4d8" strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round"
        />
      )}

      {/* Data points with hover */}
      {sorted.map((e, i) => {
        const isPB = fastest !== null && toSec(e.time) === toSec(fastest.time)
        const cx = xOf(dms[i]).toFixed(1)
        const cy = yOf(secs[i]).toFixed(1)
        return (
          <g key={`${e.date}|${e.time}|${i}`}
            onMouseEnter={() => setHovIdx(i)}
            style={{ cursor: 'pointer' }}
          >
            <circle cx={cx} cy={cy} r="12" fill="transparent" />
            {isPB ? (
              <>
                <circle cx={cx} cy={cy} r={hovIdx === i ? 9 : 8} fill="#f59e0b" opacity="0.25" />
                <circle cx={cx} cy={cy} r={hovIdx === i ? 6 : 5} fill="#f59e0b" stroke="#d97706" strokeWidth="2" />
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="7" fill="#fff" fontWeight="800">★</text>
              </>
            ) : (
              <circle
                cx={cx} cy={cy}
                r={hovIdx === i ? 6 : 5}
                fill={hovIdx === i ? '#00b4d8' : '#ffffff'}
                stroke="#00b4d8" strokeWidth="2.5"
              />
            )}
          </g>
        )
      })}

      {/* Axes */}
      <line x1={MG.l} y1={MG.t} x2={MG.l} y2={MG.t + CH + 1} stroke="#cbd5e1" strokeWidth="1.5" />
      <line x1={MG.l - 1} y1={MG.t + CH} x2={MG.l + CW} y2={MG.t + CH} stroke="#cbd5e1" strokeWidth="1.5" />

      {/* Hover tooltip */}
      {hov && (
        <g>
          {/* Vertical guide line */}
          <line
            x1={hovX.toFixed(1)} y1={MG.t.toFixed(1)}
            x2={hovX.toFixed(1)} y2={(MG.t + CH).toFixed(1)}
            stroke="#00b4d8" strokeWidth="1" strokeDasharray="4 3" opacity="0.6"
          />
          {/* Tooltip box */}
          <rect x={tx} y={ty} width={TW} height={TH} rx={TR} ry={TR}
            fill="#1e293b" opacity="0.93"
          />
          <text x={tx + 10} y={ty + 16} fontSize="11" fontWeight="700" fill="#94a3b8" fontFamily="inherit">
            {fmtDate(hov.date)}
          </text>
          <text x={tx + 10} y={ty + 32} fontSize="13" fontWeight="800" fill="#ffffff" fontFamily="inherit">
            {hov.time}
          </text>
          {hovAge !== null && (
            <text x={tx + 10} y={ty + 50} fontSize="11" fill="#94a3b8" fontFamily="inherit">
              Age {hovAge}
            </text>
          )}
        </g>
      )}
    </svg>
  )
}

// ─── Specialty Radar Chart ──────────────────────────────────────────────────

type Times = Record<string, string>

function parseSecs(t: string): number {
  if (!t) return 0
  const p = t.split(':')
  return p.length === 2 ? parseFloat(p[0]) * 60 + parseFloat(p[1]) : parseFloat(t)
}

const STROKE_REF: Record<string, { label: string; fast: number; slow: number; events: string[] }> = {
  free:   { label: 'Free',   fast: 50,  slow: 90,  events: ['100-free',  '200-free',  '50-free']   },
  back:   { label: 'Back',   fast: 58,  slow: 98,  events: ['100-back',  '200-back',  '50-back']   },
  breast: { label: 'Breast', fast: 66,  slow: 110, events: ['100-breast','200-breast', '50-breast'] },
  fly:    { label: 'Fly',    fast: 57,  slow: 98,  events: ['100-fly',   '200-fly',   '50-fly']    },
  im:     { label: 'IM',     fast: 130, slow: 210, events: ['200-im',    '400-im']                  },
}
const STROKE_ORDER = ['free', 'back', 'breast', 'fly', 'im']

function sprintDistScore(times: Times, course: Course): number | null {
  const DIST_SCALE: Record<string, number> = {
    '50': 0.0, '100': 0.15, '200': 0.35, '400': 0.5, '500': 0.6,
    '800': 0.75, '1000': 0.85, '1500': 0.95, '1650': 1.0,
  }
  let total = 0, count = 0
  for (const [key, time] of Object.entries(times)) {
    if (!time || !key.startsWith(`${course}-`)) continue
    const parts = key.split('-')
    const dist = parts[1], stroke = parts[2]
    if (!dist || !stroke || stroke === 'relay') continue
    const score = DIST_SCALE[dist]
    if (score === undefined) continue
    total += score; count++
  }
  return count > 0 ? total / count : null
}

function sprintDistColor(score: number): { fill: string; stroke: string } {
  const r = Math.round(239 + (59  - 239) * score)
  const g = Math.round(68  + (130 - 68)  * score)
  const b = Math.round(68  + (246 - 68)  * score)
  return { fill: `rgba(${r},${g},${b},0.28)`, stroke: `rgb(${r},${g},${b})` }
}

function SpecialtyChart({ times, course }: { times: Times; course: Course }) {
  const CX = 100, CY = 100, R = 78, N = 5

  function vertex(i: number, r: number) {
    const a = (i * 2 * Math.PI) / N - Math.PI / 2
    return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }
  }
  function ring(r: number) {
    return Array.from({ length: N }, (_, i) => vertex(i, r)).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  }

  const scores = STROKE_ORDER.map(key => {
    const ref = STROKE_REF[key]
    const best = ref.events.map(ev => parseSecs(times[`${course}-${ev}`] || '')).filter(s => s > 0)
    if (!best.length) return 0
    return Math.max(0, Math.min(1, (ref.slow - Math.min(...best)) / (ref.slow - ref.fast)))
  })

  const dataPoly  = scores.map((s, i) => { const p = vertex(i, s * R); return `${p.x.toFixed(1)},${p.y.toFixed(1)}` }).join(' ')
  const hasAny    = scores.some(s => s > 0)
  const sdScore   = sprintDistScore(times, course)
  const polyColor = sdScore !== null ? sprintDistColor(sdScore) : { fill: 'rgba(0,100,200,0.22)', stroke: '#1d4ed8' }

  return (
    <div className="specialty-card">
      <h3 className="specialty-title">Specialty</h3>
      <svg viewBox="0 0 200 200" width={200} height={200}>
        {[0.25, 0.5, 0.75, 1].map(f => (
          <polygon key={f} points={ring(R * f)} fill="none" stroke="rgba(0,40,85,0.12)" strokeWidth="1" />
        ))}
        {STROKE_ORDER.map((_, i) => { const p = vertex(i, R); return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="rgba(0,40,85,0.12)" strokeWidth="1" /> })}
        {hasAny && <polygon points={dataPoly} fill={polyColor.fill} stroke={polyColor.stroke} strokeWidth="2" />}
        {STROKE_ORDER.map((key, i) => { const p = vertex(i, R + 16); return <text key={key} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="600" fill="#334155">{STROKE_REF[key].label}</text> })}
      </svg>
      {!hasAny && <p className="specialty-empty">Add times on the Dashboard to see your specialty.</p>}
      {hasAny && sdScore !== null && (
        <div className="specialty-scale">
          <div className="specialty-scale-bar">
            <div className="specialty-scale-indicator" style={{ left: `${sdScore * 100}%` }} />
          </div>
          <div className="specialty-scale-labels">
            <span style={{ color: '#ef4444' }}>Sprint</span>
            <span style={{ color: '#3b82f6' }}>Distance</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function Progress() {
  const navigate = useNavigate()
  const [course,       setCourse]       = useState<Course>('SCY')
  const [eventId,      setEventId]      = useState('100-free')
  const [history,      setHistory]      = useState<TimeHistory>({})
  const [dashTimes,    setDashTimes]    = useState<Times>({})
  const [dob,          setDob]          = useState('')
  const [showUnknown,  setShowUnknown]  = useState(false)
  const [showTC,       setShowTC]       = useState(false)
  const [histView,     setHistView]     = useState<HistoryView>('fastest')
  const [, setDataLoading]  = useState(true)

  useEffect(() => {
    setDataLoading(true)
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user
      if (!user) { navigate('/'); return }
      setHistory(user.user_metadata?.timeHistory ?? {})
      setDashTimes(user.user_metadata?.times ?? {})
      setDob(user.user_metadata?.dob ?? '')
      setDataLoading(false)
    })
  }, [navigate])

  const groups  = course === 'SCY' ? SCY_GROUPS : course === 'LCM' ? LCM_GROUPS : SCM_GROUPS
  const key     = `${course}-${eventId}`
  const entries = [...(history[key] ?? [])].sort((a, b) => a.date.localeCompare(b.date))

  // Find display label for the selected event
  const flat = groups.flatMap(g => g.events.map(e => ({ ...e, stroke: g.stroke })))
  const evMeta = flat.find(e => e.id === eventId)
  const displayLabel = evMeta
    ? `${evMeta.label} ${evMeta.stroke === 'Individual Medley' ? 'IM' : evMeta.stroke}`
    : eventId

  // Collect all entries with unknown date for the warning panel
  const unknownEntries: { key: string; time: string }[] = Object.entries(history).flatMap(
    ([k, arr]) => arr.filter(e => e.date === 'unknown').map(e => ({ key: k, time: e.time }))
  )

  const datedEntries = entries.filter(e => e.date !== 'unknown')

  // Stats
  const fastest = entries.reduce<TimeEntry | null>((b, e) => {
    if (!b) return e
    return (toSec(e.time) ?? Infinity) < (toSec(b.time) ?? Infinity) ? e : b
  }, null)
  const delta = entries.length >= 2
    ? (toSec(entries[entries.length - 1].time) ?? 0) - (toSec(entries[0].time) ?? 0)
    : null

  async function deleteEntry(sortedIdx: number) {
    const { data } = await supabase.auth.getUser()
    const freshHistory: TimeHistory = data?.user?.user_metadata?.timeHistory ?? {}
    const arr = [...(freshHistory[key] ?? [])].sort((a, b) => a.date.localeCompare(b.date))
    arr.splice(sortedIdx, 1)
    const next = { ...freshHistory, [key]: arr }
    setHistory(next)
    await supabase.auth.updateUser({ data: { timeHistory: next } })
  }

  return (
    <div className="prog-layout">
      <aside className="prog-sidebar">
        <div className="prog-sidebar-brand">Progress</div>
        <nav className="prog-sidebar-nav">
          <button className="prog-nav-btn" onClick={() => navigate('/dashboard')}>
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </button>
          <button className="prog-nav-btn" onClick={() => setShowTC(true)}>
            <ArrowRightLeft size={16} />
            <span>Time Converter</span>
          </button>
        </nav>
      </aside>
      <TimeConverterPopup isOpen={showTC} onClose={() => setShowTC(false)} />

      <div className="prog-page">
        <div className="prog-header">
          <button className="page-mob-back" onClick={() => navigate('/dashboard')}>
            <ChevronLeft size={15} /> Dashboard
          </button>
          <div className="prog-header-info">
            <h1 className="prog-title">Time Progression</h1>
            <p className="prog-subtitle">Track how your times improve over the season</p>
          </div>
          <img src="/logos/scs.svg" alt="Southern California Swimming" className="scs-logo-corner" />
        </div>

        <div className="prog-body">

          {/* ── No history notice ── */}
          {Object.keys(history).length === 0 && (
            <div className="prog-import-notice">
              <strong>No swim history imported yet</strong>
              <p>
                This page needs your full career history to show charts and trends.
                Sign into <strong>Swimcloud</strong> or <strong>USA Swimming</strong>, copy your full times history,
                and use <strong>Import Times</strong> — it will automatically fill in this page.
              </p>
              <button className="prog-import-btn" onClick={() => navigate('/import')}>
                Go to Import Times →
              </button>
            </div>
          )}

          {/* ── View tabs ── */}
          {Object.keys(history).length > 0 && (
            <div className="prog-view-tabs">
              {([
                { id: 'fastest',   label: 'Fastest'   },
                { id: 'by-meets',  label: 'By Meets'  },
                { id: 'by-events', label: 'By Events' },
              ] as { id: HistoryView; label: string }[]).map(tab => (
                <button
                  key={tab.id}
                  className={`prog-view-tab${histView === tab.id ? ' active' : ''}`}
                  onClick={() => setHistView(tab.id as HistoryView)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* ── By Meets view ── */}
          {histView === 'by-meets' && (() => {
            type MeetGroup = { meetKey: string; meetName: string; date: string; rows: { eventKey: string; label: string; time: string; isPB: boolean }[] }
            const meetMap = new Map<string, MeetGroup>()
            const allGroups = [...SCY_GROUPS.map(g => ({ ...g, course: 'SCY' as Course })), ...LCM_GROUPS.map(g => ({ ...g, course: 'LCM' as Course })), ...SCM_GROUPS.map(g => ({ ...g, course: 'SCM' as Course }))]
            const labelMap: Record<string, string> = {}
            allGroups.forEach(g => g.events.forEach(ev => {
              const key = `${g.course}-${ev.id}`
              const strokeShort = g.stroke === 'Individual Medley' ? 'IM' : g.stroke
              labelMap[key] = `${g.course} ${ev.label} ${strokeShort}`
            }))

            Object.entries(history).forEach(([evKey, entries]) => {
              const bestSec = entries.reduce<number | null>((b, e) => {
                const s = toSec(e.time); return s !== null && (b === null || s < b) ? s : b
              }, null)
              entries.forEach(entry => {
                const mk = `${entry.meet ?? ''}||${entry.date}`
                if (!meetMap.has(mk)) meetMap.set(mk, { meetKey: mk, meetName: entry.meet ?? '', date: entry.date, rows: [] })
                const s = toSec(entry.time)
                meetMap.get(mk)!.rows.push({ eventKey: evKey, label: labelMap[evKey] ?? evKey, time: entry.time, isPB: s !== null && s === bestSec })
              })
            })

            const meetList = [...meetMap.values()].sort((a, b) => b.date.localeCompare(a.date))
            if (meetList.length === 0) return <div className="prog-empty-state">No meet data yet. Import times with meet names to see this view.</div>

            return (
              <div className="prog-meets-view">
                {meetList.map(meet => (
                  <div key={meet.meetKey} className="prog-meet-block">
                    <div className="prog-meet-header">
                      <span className="prog-meet-name">{meet.meetName || '—'}</span>
                      <span className="prog-meet-date">{fmtDate(meet.date)}</span>
                    </div>
                    <div className="prog-meet-rows">
                      {meet.rows.map((row, i) => (
                        <div key={i} className={`prog-meet-row${row.isPB ? ' prog-meet-row--pb' : ''}`}>
                          <span className="prog-meet-row-event">{row.label}</span>
                          <span className="prog-meet-row-time">{row.time}{row.isPB && <span className="prog-best-tag">★ PB</span>}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* ── By Events view ── */}
          {histView === 'by-events' && (() => {
            const allGroups = [...SCY_GROUPS.map(g => ({ ...g, course: 'SCY' as Course })), ...LCM_GROUPS.map(g => ({ ...g, course: 'LCM' as Course })), ...SCM_GROUPS.map(g => ({ ...g, course: 'SCM' as Course }))]
            const orderedKeys: string[] = []
            allGroups.forEach(g => g.events.forEach(ev => orderedKeys.push(`${g.course}-${ev.id}`)))

            const labelMap: Record<string, string> = {}
            allGroups.forEach(g => g.events.forEach(ev => {
              const key = `${g.course}-${ev.id}`
              const strokeShort = g.stroke === 'Individual Medley' ? 'IM' : g.stroke
              labelMap[key] = `${g.course} ${ev.label} ${strokeShort}`
            }))

            const evKeys = orderedKeys.filter(k => (history[k]?.length ?? 0) > 0)
            if (evKeys.length === 0) return <div className="prog-empty-state">No event history yet.</div>

            return (
              <div className="prog-events-view">
                {evKeys.map(evKey => {
                  const evEntries = [...(history[evKey] ?? [])].sort((a, b) => b.date.localeCompare(a.date))
                  const bestSec = evEntries.reduce<number | null>((b, e) => {
                    const s = toSec(e.time); return s !== null && (b === null || s < b) ? s : b
                  }, null)
                  return (
                    <div key={evKey} className="prog-event-block">
                      <div className="prog-event-block-header">
                        <span className="prog-event-block-label">{labelMap[evKey] ?? evKey}</span>
                        <span className="prog-event-block-count">{evEntries.length} swim{evEntries.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="prog-event-block-rows">
                        {evEntries.map((e, i) => {
                          const s = toSec(e.time)
                          const isPB = s !== null && s === bestSec
                          return (
                            <div key={i} className={`prog-meet-row${isPB ? ' prog-meet-row--pb' : ''}`}>
                              <span className="prog-meet-row-event" style={{ color: '#64748b', fontSize: 12 }}>{fmtDate(e.date)}{e.meet ? ` · ${e.meet}` : ''}</span>
                              <span className="prog-meet-row-time">{e.time}{isPB && <span className="prog-best-tag">★ PB</span>}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* ── Two-column split layout (Fastest view) ── */}
          {histView === 'fastest' && <div className="prog-split">
            <div className="prog-split-main">

              {/* ── Selectors ── */}
              <div className="prog-controls">
                <div className="prog-course-tabs">
                  {(['SCY', 'LCM', 'SCM'] as Course[]).map(c => (
                    <button
                      key={c}
                      className={`prog-course-tab${course === c ? ' active' : ''}`}
                      onClick={() => { setCourse(c); setEventId('100-free') }}
                    >{c}</button>
                  ))}
                </div>

                <div className="prog-event-picker">
                  <label className="prog-picker-label">Event</label>
                  <select
                    className="prog-event-select"
                    value={eventId}
                    onChange={e => setEventId(e.target.value)}
                  >
                    {groups.map(({ stroke, events }) => (
                      <optgroup label={stroke} key={stroke}>
                        {events.map(({ id, label }) => (
                          <option key={id} value={id}>{label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Unknown-date warning ── */}
              {unknownEntries.length > 0 && (
                <div className="prog-unknown-banner">
                  <button
                    className="prog-unknown-header"
                    onClick={() => setShowUnknown(v => !v)}
                  >
                    <AlertTriangle size={16} className="prog-unknown-icon" />
                    <span>{unknownEntries.length} entr{unknownEntries.length === 1 ? 'y' : 'ies'} missing a date — these won't appear on the chart</span>
                    <ChevronDown size={14} className={`prog-unknown-chevron${showUnknown ? ' open' : ''}`} />
                  </button>
                  {showUnknown && (
                    <div className="prog-unknown-list">
                      <p className="prog-unknown-hint">Find when you swam these times and update them using the entry list below after selecting the correct event.</p>
                      {unknownEntries.map((e, i) => (
                        <div key={i} className="prog-unknown-row">
                          <span className="prog-unknown-key">{e.key}</span>
                          <span className="prog-unknown-time">{e.time}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Chart ── */}
              <div className="prog-chart-card">
                <div className="prog-chart-head">{displayLabel} · {course}</div>
                <LineChart entries={entries.filter(e => e.date !== 'unknown')} dob={dob} fastest={fastest} />
                {entries.length > 0 && (
                  <div className="prog-chart-legend">
                    <span className="prog-legend-item">
                      <span className="prog-legend-dot prog-legend-dot--regular" />
                      Entry
                    </span>
                    <span className="prog-legend-item">
                      <span className="prog-legend-dot prog-legend-dot--pb">★</span>
                      Personal Best
                    </span>
                  </div>
                )}
              </div>

              {/* ── Entry list ── */}
              {entries.length > 0 && (
                <div className="prog-list-card">
                  <div className="prog-list-head">All Entries</div>
                  <div className="prog-list">
                    {[...entries].reverse().map((e, revIdx) => {
                      const origIdx = entries.length - 1 - revIdx
                      const s = toSec(e.time)
                      const fastSec = fastest ? toSec(fastest.time) : null
                      const isBest = s !== null && fastSec !== null && s === fastSec
                      return (
                        <div key={`${e.date}|${e.time}|${origIdx}`} className={`prog-entry${isBest ? ' prog-entry--pb' : ''}`}>
                          <span className="prog-entry-date">{fmtDate(e.date)}</span>
                          <span className={`prog-entry-time${isBest ? ' prog-entry-time--best' : ''}`}>
                            {e.time}
                            {isBest && <span className="prog-best-tag">★ PB</span>}
                          </span>
                          <button
                            className="prog-entry-del"
                            onClick={() => deleteEntry(origIdx)}
                            title="Delete entry"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

            </div>{/* end prog-split-main */}

            <div className="prog-split-side">
              <SpecialtyChart times={dashTimes} course={course} />
              {entries.length >= 1 && (
                <div className="prog-stats">
                  <div className="prog-stat">
                    <span className="prog-stat-label">Swims logged</span>
                    <span className="prog-stat-value">{entries.length}</span>
                  </div>
                  <div className="prog-stat">
                    <span className="prog-stat-label">Best time</span>
                    <span className="prog-stat-value prog-stat-value--blue">{fastest?.time ?? '—'}</span>
                  </div>
                  {datedEntries.length >= 2 && (
                    <div className="prog-stat">
                      <span className="prog-stat-label">Overall change</span>
                      <span className={`prog-stat-value${delta !== null && delta < 0 ? ' prog-stat-value--green' : delta !== null && delta > 0 ? ' prog-stat-value--red' : ''}`}>
                        {delta !== null
                          ? `${delta < 0 ? '−' : '+'}${fmtSec(Math.abs(delta))}`
                          : '—'}
                      </span>
                    </div>
                  )}
                  {datedEntries.length >= 2 && (
                    <div className="prog-stat">
                      <span className="prog-stat-label">Period</span>
                      <span className="prog-stat-value prog-stat-value--sm">
                        {fmtDateMonth(datedEntries[0].date)} – {fmtDateMonth(datedEntries[datedEntries.length - 1].date)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>{/* end prog-split-side */}
          </div>}{/* end prog-split / fastest conditional */}

        </div>
      </div>
    </div>
  )
}
