import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, ChevronDown, ArrowRightLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  SCS_STANDARDS, getAgeGroup, getCut,
  type StdLevel,
} from '../lib/scsStandards'
import TimeConverterPopup from '../components/TimeConverterPopup'
import './Compare.css'

type Course = 'SCY' | 'LCM' | 'SCM'

const SCY_GROUPS = [
  { stroke: 'Freestyle', events: [
    { id: '50-free',    label: '50y'   },
    { id: '100-free',   label: '100y'  },
    { id: '200-free',   label: '200y'  },
    { id: '500-free',   label: '500y'  },
    { id: '1000-free',  label: '1000y' },
    { id: '1650-free',  label: '1650y' },
  ]},
  { stroke: 'Backstroke', events: [
    { id: '50-back',  label: '50y'  },
    { id: '100-back', label: '100y' },
    { id: '200-back', label: '200y' },
  ]},
  { stroke: 'Breaststroke', events: [
    { id: '50-breast',  label: '50y'  },
    { id: '100-breast', label: '100y' },
    { id: '200-breast', label: '200y' },
  ]},
  { stroke: 'Butterfly', events: [
    { id: '50-fly',  label: '50y'  },
    { id: '100-fly', label: '100y' },
    { id: '200-fly', label: '200y' },
  ]},
  { stroke: 'Individual Medley', events: [
    { id: '100-im', label: '100y' },
    { id: '200-im', label: '200y' },
    { id: '400-im', label: '400y' },
  ]},
]

const LCM_GROUPS = [
  { stroke: 'Freestyle', events: [
    { id: '50-free',   label: '50m'   },
    { id: '100-free',  label: '100m'  },
    { id: '200-free',  label: '200m'  },
    { id: '400-free',  label: '400m'  },
    { id: '800-free',  label: '800m'  },
    { id: '1500-free', label: '1500m' },
  ]},
  { stroke: 'Backstroke', events: [
    { id: '50-back',  label: '50m'  },
    { id: '100-back', label: '100m' },
    { id: '200-back', label: '200m' },
  ]},
  { stroke: 'Breaststroke', events: [
    { id: '50-breast',  label: '50m'  },
    { id: '100-breast', label: '100m' },
    { id: '200-breast', label: '200m' },
  ]},
  { stroke: 'Butterfly', events: [
    { id: '50-fly',  label: '50m'  },
    { id: '100-fly', label: '100m' },
    { id: '200-fly', label: '200m' },
  ]},
  { stroke: 'Individual Medley', events: [
    { id: '200-im', label: '200m' },
    { id: '400-im', label: '400m' },
  ]},
]

const SCM_GROUPS = [
  { stroke: 'Freestyle', events: [
    { id: '50-free',   label: '50m'   },
    { id: '100-free',  label: '100m'  },
    { id: '200-free',  label: '200m'  },
    { id: '400-free',  label: '400m'  },
    { id: '800-free',  label: '800m'  },
    { id: '1500-free', label: '1500m' },
  ]},
  { stroke: 'Backstroke', events: [
    { id: '50-back',  label: '50m'  },
    { id: '100-back', label: '100m' },
    { id: '200-back', label: '200m' },
  ]},
  { stroke: 'Breaststroke', events: [
    { id: '50-breast',  label: '50m'  },
    { id: '100-breast', label: '100m' },
    { id: '200-breast', label: '200m' },
  ]},
  { stroke: 'Butterfly', events: [
    { id: '50-fly',  label: '50m'  },
    { id: '100-fly', label: '100m' },
    { id: '200-fly', label: '200m' },
  ]},
  { stroke: 'Individual Medley', events: [
    { id: '200-im', label: '200m' },
    { id: '400-im', label: '400m' },
  ]},
]

function calcAge(dob: string): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function toSeconds(t: string): number | null {
  if (!t || t === '—') return null
  const parts = t.split(':')
  if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1])
  return parseFloat(t)
}

type Proximity = 'met' | 'close' | 'near' | 'far' | 'very-far' | 'no-time' | 'no-cut'

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

function formatGap(userSec: number, cutSec: number): string {
  const g = userSec - cutSec
  if (g <= 0) return ''
  if (g < 60) return `+${g.toFixed(2)}s`
  const m = Math.floor(g / 60)
  const s = (g % 60).toFixed(2).padStart(5, '0')
  return `+${m}:${s}`
}

// Returns split-distance labels for a given event (every 50 units, starting at 50).
// 50-events get a single 25 mark; longer events generate one label per 50 increment.
function getSplitLabels(eventId: string, c: Course): string[] {
  const match = eventId.match(/^(\d+)/)
  if (!match) return []
  const dist = parseInt(match[1])
  const unit = c === 'SCY' ? 'y' : 'm'
  if (dist <= 50) return [`25${unit}`]
  const labels: string[] = []
  for (let d = 50; d <= dist; d += 50) labels.push(`${d}${unit}`)
  return labels
}

// Same auto-format logic as Dashboard so split inputs feel identical.
function formatTimeDigits(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 6)
  switch (d.length) {
    case 0: return ''
    case 1: case 2: return d
    case 3: return `${d[0]}.${d.slice(1)}`
    case 4: return `${d.slice(0, 2)}.${d.slice(2)}`
    case 5: return `${d[0]}:${d.slice(1, 3)}.${d.slice(3)}`
    case 6: return `${d.slice(0, 2)}:${d.slice(2, 4)}.${d.slice(4)}`
    default: return d
  }
}

export default function Compare() {
  const navigate = useNavigate()
  const [showTC,           setShowTC]           = useState(false)
  const [course,           setCourse]           = useState<Course>('SCY')
  const [times,            setTimes]            = useState<Record<string, string>>({})
  const [dob,              setDob]              = useState('')
  const [gender,           setGender]           = useState('')
  const [selectedStandard, setSelectedStandard] = useState<StdLevel>('a')
  const [splits,           setSplits]           = useState<Record<string, string[]>>({})
  const [expandedKey,      setExpandedKey]      = useState<string | null>(null)
  const splitsSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      if (!user) { navigate('/'); return }
      const m = user.user_metadata ?? {}
      setTimes(m.times ?? {})
      setSplits(m.splits ?? {})
      setDob(m.dob ?? '')
      setGender(m.gender ?? '')
    })
  }, [navigate])

  const age      = calcAge(dob)
  const ageGroup = getAgeGroup(age)
  const agData   = SCS_STANDARDS[ageGroup]
  const allLevels = agData?.levels ?? (['a', 'b'] as StdLevel[])
  const labels    = agData?.labels ?? { a: 'A Standard', b: 'B Standard' }

  const SCS_MEET_KEYS: StdLevel[] = ['wag', 'sprAG', 'jag', 'eliteCh', 'sag']
  const levels = allLevels.filter(l => !SCS_MEET_KEYS.includes(l))

  // Keep selected standard in sync when age group changes
  const safeStandard: StdLevel = levels.includes(selectedStandard) ? selectedStandard : levels[0] ?? 'a'

  const groups = course === 'SCY' ? SCY_GROUPS : course === 'LCM' ? LCM_GROUPS : SCM_GROUPS

  function timeKey(eventId: string) {
    return `${course}-${eventId}`
  }

  function toggleExpand(key: string) {
    setExpandedKey(prev => prev === key ? null : key)
  }

  function updateSplit(key: string, idx: number, raw: string) {
    const val = formatTimeDigits(raw)
    setSplits(prev => {
      const arr = [...(prev[key] ?? [])]
      arr[idx] = val
      const next = { ...prev, [key]: arr }
      if (splitsSaveRef.current) clearTimeout(splitsSaveRef.current)
      splitsSaveRef.current = setTimeout(async () => {
        await supabase.auth.updateUser({ data: { splits: next } })
      }, 800)
      return next
    })
  }

  const ageGroupLabel =
    ageGroup === '8u'  ? '8 & Under' :
    ageGroup === '10u' ? '10 & Under' :
    ageGroup === '1112' ? '11-12' :
    ageGroup === '1314' ? '13-14' :
    ageGroup === '1516' ? '15-16' :
    ageGroup === '1718' ? '17-18' : ''

  return (
    <div className="compare-layout">

      <TimeConverterPopup isOpen={showTC} onClose={() => setShowTC(false)} />

      {/* ── Sidebar ── */}
      <aside className="compare-sidebar">
        <div className="compare-sidebar-brand">Compare Times</div>
        <nav className="compare-sidebar-nav">
          <button className="compare-nav-btn" onClick={() => navigate('/dashboard')}>
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </button>
          <button className="compare-nav-btn" onClick={() => setShowTC(true)}>
            <ArrowRightLeft size={16} />
            <span>Time Converter</span>
          </button>
        </nav>

        {/* ── Inline color scale ── */}
        <div className="compare-sidebar-scale">
          <p className="compare-sidebar-scale-title">Color Scale</p>
          {([
            { sym: '✓',  bg: '#1d4ed8', border: '#1e3a8a', label: 'Meets standard' },
            { sym: '≈',  bg: '#0891b2', border: '#0e7490', label: 'Within 3%' },
            { sym: '!',  bg: '#d97706', border: '#92400e', label: 'Within 7%' },
            { sym: '!!', bg: '#ea580c', border: '#9a3412', label: 'Within 15%' },
            { sym: '✗',  bg: '#b91c1c', border: '#7f1d1d', label: 'Over 15%' },
          ] as const).map(({ sym, bg, border, label }) => (
            <div key={sym} className="compare-sidebar-scale-row">
              <span
                className="compare-sidebar-scale-swatch"
                style={{ background: bg, boxShadow: `0 0 0 1.5px ${border}` }}
              >{sym}</span>
              <span className="compare-sidebar-scale-label">{label}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="compare-page">
        <div className="compare-header">
          <div className="compare-header-info">
            <h1 className="compare-title">Compare Times</h1>
            <p className="compare-subtitle">
              Southern California Swimming
              {ageGroupLabel && <span> · {ageGroupLabel}</span>}
              {gender && (
                <span className="compare-gender-tag">
                  {gender === 'male' ? 'Male' : 'Female'}
                </span>
              )}
            </p>
          </div>
          <img src="/logos/scs.svg" alt="Southern California Swimming" className="scs-logo-corner" />
        </div>

        <div className="compare-body">
          <div className="compare-controls">
            <div className="compare-tabs">
              <button
                className={`compare-tab${course === 'SCY' ? ' active' : ''}`}
                onClick={() => setCourse('SCY')}
              >SCY</button>
              <button
                className={`compare-tab${course === 'LCM' ? ' active' : ''}`}
                onClick={() => setCourse('LCM')}
              >LCM</button>
              <button
                className={`compare-tab${course === 'SCM' ? ' active' : ''}`}
                onClick={() => setCourse('SCM')}
              >SCM</button>
            </div>

            <div className="compare-standard-picker">
              <label className="compare-standard-label">Standard</label>
              <select
                className="compare-standard-select"
                value={safeStandard}
                onChange={e => setSelectedStandard(e.target.value as StdLevel)}
              >
                {levels.map(lvl => (
                  <option key={lvl} value={lvl}>{labels[lvl] ?? lvl}</option>
                ))}
              </select>
            </div>

            {!ageGroup && (
              <p className="compare-note">
                Add your birthday in Settings to see age-group cut times.
              </p>
            )}
          </div>

          {groups.map(({ stroke, events }) => (
            <div key={stroke} className="compare-group">
              <h2 className="compare-group-title">{stroke}</h2>
              <div className="compare-table">
                <div className="compare-table-head">
                  <span>Event</span>
                  <span>Your Time</span>
                  <span>Standard Cut</span>
                  <span>Status</span>
                </div>
                {events.map(({ id, label }) => {
                  const key       = timeKey(id)
                  const isOpen    = expandedKey === key
                  const userTime  = times[key] || ''
                  const cutTime   = getCut(ageGroup, gender, course, id, safeStandard)
                  const userSec   = toSeconds(userTime)
                  const cutSec    = toSeconds(cutTime)
                  const proximity = getProximity(userSec, cutSec, userTime)
                  const gap       = userSec && cutSec ? formatGap(userSec, cutSec) : ''
                  const splitLbls = getSplitLabels(id, course)

                  return (
                    <div key={id} className="compare-row-wrapper">
                      <div className={`compare-row${isOpen ? ' compare-row--open' : ''}`}>
                        <button
                          className="compare-event-btn"
                          onClick={() => toggleExpand(key)}
                          title="Click to add splits"
                        >
                          {label}
                          <ChevronDown
                            size={11}
                            className={`compare-chevron${isOpen ? ' compare-chevron--open' : ''}`}
                          />
                        </button>
                        <span className={`compare-time compare-time--${proximity}`}>
                          {proximity === 'met'      && <span className="compare-tier-sym">✓</span>}
                          {proximity === 'close'    && <span className="compare-tier-sym">≈</span>}
                          {proximity === 'near'     && <span className="compare-tier-sym">!</span>}
                          {proximity === 'far'      && <span className="compare-tier-sym">!!</span>}
                          {proximity === 'very-far' && <span className="compare-tier-sym">✗</span>}
                          {userTime || '—'}
                        </span>
                        <span className="compare-cut">{cutTime || '—'}</span>
                        <span className={`compare-status compare-status--${proximity}`}>
                          {proximity === 'met'                            && '✓ Meets cut'}
                          {proximity === 'no-time'                        && 'No time entered'}
                          {proximity === 'no-cut'                         && '—'}
                          {['close','near','far','very-far'].includes(proximity) && `✗ ${gap} behind`}
                        </span>
                        {['close','near','far'].includes(proximity) && cutTime && (
                          <button
                            className="compare-goal-btn"
                            title="Create a goal to hit this standard"
                            onClick={() => {
                              const params = new URLSearchParams({
                                course,
                                event:  id,
                                cut:    cutTime,
                                stroke,
                              })
                              navigate(`/goals/create?${params.toString()}`)
                            }}
                          >
                            + Goal
                          </button>
                        )}
                      </div>

                      {isOpen && (
                        <div className="compare-splits">
                          <div className="compare-splits-header">
                            <span className="compare-splits-title">Splits</span>
                            <span className="compare-splits-hint">
                              Numbers only — colons &amp; decimals placed automatically
                            </span>
                          </div>
                          <div className="compare-splits-grid">
                            {splitLbls.map((lbl, idx) => (
                              <div key={lbl} className="compare-split-cell">
                                <label className="compare-split-label">{lbl}</label>
                                <input
                                  className="compare-split-input"
                                  value={splits[key]?.[idx] ?? ''}
                                  onChange={e => updateSplit(key, idx, e.target.value)}
                                  placeholder="—"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
