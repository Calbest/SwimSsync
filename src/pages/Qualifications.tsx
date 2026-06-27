import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, BookOpen } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SCS_STANDARDS, getAgeGroup, getCut, type StdLevel } from '../lib/scsStandards'
import ColorLegend from '../components/ColorLegend'
import TimeConverterPopup from '../components/TimeConverterPopup'
import './Qualifications.css'

type Course = 'SCY' | 'LCM' | 'SCM'

const MEET_QUALIFIERS: { key: StdLevel; label: string; short: string }[] = [
  { key: 'wag',     label: '2025 WAG',       short: 'WAG'     },
  { key: 'sprAG',   label: '2026 Spring AG',  short: 'Spr AG'  },
  { key: 'jag',     label: '2026 JAG',        short: 'JAG'     },
  { key: 'eliteCh', label: '2026 Elite Ch',   short: 'Elite'   },
  { key: 'sag',     label: '2026 SAG',        short: 'SAG'     },
]

const SCY_GROUPS = [
  { stroke: 'Freestyle', events: [
    { id: '50-free',   label: '50y'   },
    { id: '100-free',  label: '100y'  },
    { id: '200-free',  label: '200y'  },
    { id: '500-free',  label: '500y'  },
    { id: '1000-free', label: '1000y' },
    { id: '1650-free', label: '1650y' },
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
  if (!t) return null
  const parts = t.split(':')
  if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1])
  return parseFloat(t)
}

function getProximityClass(userSec: number | null, cutSec: number | null): string {
  if (userSec === null || cutSec === null) return 'no-time'
  const pct = (userSec - cutSec) / cutSec * 100
  if (pct <= 0)  return 'met'
  if (pct <= 3)  return 'close'
  if (pct <= 7)  return 'near'
  if (pct <= 15) return 'far'
  return 'very-far'
}

export default function Qualifications() {
  const navigate = useNavigate()
  const [showLegend, setShowLegend] = useState(false)
  const [showTC,     setShowTC]     = useState(false)
  const [course,  setCourse]  = useState<Course>('SCY')
  const [times,   setTimes]   = useState<Record<string, string>>({})
  const [dob,     setDob]     = useState('')
  const [gender,  setGender]  = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      if (!user) { navigate('/'); return }
      const m = user.user_metadata ?? {}
      setTimes(m.times ?? {})
      setDob(m.dob ?? '')
      setGender(m.gender ?? '')
    })
  }, [navigate])

  const age      = calcAge(dob)
  const ageGroup = getAgeGroup(age)
  const agData   = SCS_STANDARDS[ageGroup]
  const levels   = agData?.levels ?? []

  const meets = MEET_QUALIFIERS.filter(m => levels.includes(m.key))
  const groups = course === 'SCY' ? SCY_GROUPS : course === 'LCM' ? LCM_GROUPS : SCM_GROUPS

  function timeKey(eventId: string) {
    return `${course}-${eventId}`
  }

  const ageGroupLabel =
    ageGroup === '8u'   ? '8 & Under' :
    ageGroup === '10u'  ? '10 & Under' :
    ageGroup === '1112' ? '11-12' :
    ageGroup === '1314' ? '13-14' :
    ageGroup === '1516' ? '15-16' :
    ageGroup === '1718' ? '17-18' : ''

  // Summary counts per meet
  const summaryCounts = meets.map(m => {
    let qualified = 0, total = 0
    for (const { events } of groups) {
      for (const { id } of events) {
        const cut = getCut(ageGroup, gender, course, id, m.key)
        if (!cut) continue
        total++
        const userTime = times[timeKey(id)] || ''
        const uSec = toSeconds(userTime)
        const cSec = toSeconds(cut)
        if (uSec !== null && cSec !== null && uSec <= cSec) qualified++
      }
    }
    return { ...m, qualified, total }
  })

  return (
    <div className="quals-layout">

      {showLegend && <ColorLegend onClose={() => setShowLegend(false)} />}
      <TimeConverterPopup isOpen={showTC} onClose={() => setShowTC(false)} />

      {/* ── Sidebar ── */}
      <aside className="quals-sidebar">
        <div className="quals-sidebar-brand">Competitions</div>
        <nav className="quals-sidebar-nav">
          <button className="quals-nav-btn" onClick={() => navigate('/dashboard')}>
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </button>
          <button className="quals-nav-btn" onClick={() => setShowLegend(true)}>
            <BookOpen size={16} />
            <span>Color Legend</span>
          </button>
        </nav>
      </aside>

      {/* ── Main ── */}
      <div className="quals-page">
        <div className="quals-header">
          <div className="quals-header-info">
            <h1 className="quals-title">Meet Qualifications</h1>
            <p className="quals-subtitle">
              Southern California Swimming
              {ageGroupLabel && <span> · {ageGroupLabel}</span>}
              {gender && (
                <span className="quals-gender-tag">
                  {gender === 'male' ? 'Male' : 'Female'}
                </span>
              )}
            </p>
          </div>
          <img src="/logos/scs.svg" alt="Southern California Swimming" className="scs-logo-corner" />
        </div>

        <div className="quals-body">

          {meets.length === 0 ? (
            <div className="quals-empty">
              {!ageGroup
                ? 'Add your birthday in Settings to see meet qualifications.'
                : 'SCS meet qualifier standards are available for 10 & Under and older.'}
            </div>
          ) : (
            <>
              {/* ── Summary cards ── */}
              <div className="quals-summary">
                {summaryCounts.map(m => (
                  <div key={m.key} className="quals-card">
                    <span className="quals-card-label">{m.label}</span>
                    <span className="quals-card-count">
                      {m.qualified}<span className="quals-card-total">/{m.total}</span>
                    </span>
                    <span className="quals-card-sub">events qualified</span>
                  </div>
                ))}
              </div>

              {/* ── Course tabs ── */}
              <div className="quals-tabs">
                <button
                  className={`quals-tab${course === 'SCY' ? ' active' : ''}`}
                  onClick={() => setCourse('SCY')}
                >SCY</button>
                <button
                  className={`quals-tab${course === 'LCM' ? ' active' : ''}`}
                  onClick={() => setCourse('LCM')}
                >LCM</button>
                <button
                  className={`quals-tab${course === 'SCM' ? ' active' : ''}`}
                  onClick={() => setCourse('SCM')}
                >SCM</button>
              </div>

              {/* ── Qualification grid ── */}
              {groups.map(({ stroke, events }) => (
                <div key={stroke} className="quals-group">
                  <h2 className="quals-group-title">{stroke}</h2>
                  <div className="quals-table" style={{ '--meet-cols': meets.length } as React.CSSProperties}>
                    <div className="quals-head">
                      <span>Event</span>
                      <span>Your Time</span>
                      {meets.map(m => (
                        <span key={m.key} className="quals-meet-header">{m.short}</span>
                      ))}
                    </div>
                    {events.map(({ id, label }) => {
                      const userTime = times[timeKey(id)] || ''
                      const uSec = toSeconds(userTime)

                      return (
                        <div key={id} className="quals-row">
                          <span className="quals-event">{label}</span>
                          <span className="quals-time">{userTime || '—'}</span>
                          {meets.map(m => {
                            const cut  = getCut(ageGroup, gender, course, id, m.key)
                            const cSec = toSeconds(cut)

                            if (!cut) {
                              return <span key={m.key} className="quals-cell quals-cell--none">—</span>
                            }
                            if (!userTime) {
                              return <span key={m.key} className="quals-cell quals-cell--no-time">{cut}</span>
                            }
                            const pClass = getProximityClass(uSec, cSec)
                            return <span key={m.key} className={`quals-cell quals-cell--${pClass}`}>{cut}</span>
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
