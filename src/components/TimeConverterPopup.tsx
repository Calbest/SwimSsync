import { useState, useEffect, useRef } from 'react'
import { ArrowRightLeft, History, Maximize2, Minimize2 } from 'lucide-react'
import './TimeConverterPopup.css'

type Course = 'SCY' | 'SCM' | 'LCM'
type WinState = 'normal' | 'expanded' | 'minimized'

const POOL_FACTORS: Record<Course, number> = { SCY: 1.0, SCM: 1.11, LCM: 1.145 }
const STROKE_MULT: Record<string, number> = {
  freestyle: 1.0, backstroke: 1.01, breaststroke: 1.015, butterfly: 1.01, im: 1.01,
}
const DIST_BIAS: Record<string, number> = {
  '50':1,'100':1,'200':0.998,'400':0.996,'500':0.995,
  '800':0.994,'1000':0.993,'1500':0.992,'1650':0.991,
}

function parseTime(s: string): number | null {
  s = s.trim()
  if (!s) return null
  const parts = s.split(':')
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10), sec = parseFloat(parts[1])
    if (isNaN(m) || isNaN(sec)) return null
    return m * 60 + sec
  }
  const sec = parseFloat(s)
  return isNaN(sec) ? null : sec
}

function fmt(sec: number): string {
  if (sec < 60) return sec.toFixed(2)
  const m = Math.floor(sec / 60)
  return `${m}:${(sec - m * 60).toFixed(2).padStart(5, '0')}`
}

function convert(t: number, from: Course, to: Course, stroke: string, dist: string): number {
  if (from === to) return t
  return t * (POOL_FACTORS[to] / POOL_FACTORS[from])
    * (1 + (STROKE_MULT[stroke] - 1) * 0.5)
    * (DIST_BIAS[dist] ?? 1)
}

const COURSES: Course[] = ['SCY', 'SCM', 'LCM']
const STROKES = [
  { value: 'freestyle',   label: 'Freestyle'   },
  { value: 'backstroke',  label: 'Backstroke'  },
  { value: 'breaststroke',label: 'Breaststroke'},
  { value: 'butterfly',   label: 'Butterfly'   },
  { value: 'im',          label: 'IM'          },
]
const DISTS = ['50','100','200','400','500','800','1000','1500','1650']

const TC_HISTORY_KEY = 'sw_tc_history'
const MAX_HISTORY = 8

interface HistoryEntry {
  input: string
  from: Course
  stroke: string
  dist: string
  results: { course: Course; time: string }[]
}

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(TC_HISTORY_KEY) || '[]') } catch { return [] }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(TC_HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)))
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function TimeConverterPopup({ isOpen, onClose }: Props) {
  const [input,     setInput]     = useState('')
  const [from,      setFrom]      = useState<Course>('SCY')
  const [stroke,    setStroke]    = useState('freestyle')
  const [dist,      setDist]      = useState('100')
  const [winState,  setWinState]  = useState<WinState>('normal')
  const [showHist,  setShowHist]  = useState(false)
  const [history,   setHistory]   = useState<HistoryEntry[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setHistory(loadHistory()) }, [isOpen])

  // Save to history when result is valid
  useEffect(() => {
    if (!input.trim()) return
    const parsed = parseTime(input)
    if (parsed === null) return
    const others = COURSES.filter(c => c !== from)
    const results = others.map(c => ({ course: c, time: fmt(convert(parsed, from, c, stroke, dist)) }))
    const entry: HistoryEntry = { input, from, stroke, dist, results }
    const timer = setTimeout(() => {
      setHistory(prev => {
        const deduped = prev.filter(e => !(e.input === input && e.from === from && e.stroke === stroke && e.dist === dist))
        const next = [entry, ...deduped].slice(0, MAX_HISTORY)
        saveHistory(next)
        return next
      })
    }, 800)
    return () => clearTimeout(timer)
  }, [input, from, stroke, dist])

  useEffect(() => {
    if (!isOpen || winState === 'minimized') return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
  }, [isOpen, onClose, winState])

  if (!isOpen) return null

  const parsed = parseTime(input)
  const others = COURSES.filter(c => c !== from)

  function restoreHistory(entry: HistoryEntry) {
    setInput(entry.input)
    setFrom(entry.from)
    setStroke(entry.stroke)
    setDist(entry.dist)
    setShowHist(false)
  }

  function labelFor(e: HistoryEntry) {
    const strokeLabel = STROKES.find(s => s.value === e.stroke)?.label ?? e.stroke
    return `${e.dist} ${strokeLabel} (${e.from}) — ${e.input}`
  }

  return (
    <div className={`tcp-overlay tcp-overlay--${winState}`}>
      <div className={`tcp-panel tcp-panel--${winState}`} ref={ref}>

        {/* ── Title bar with window controls ── */}
        <div className={`tcp-header${winState === 'minimized' ? ' tcp-header--clickable' : ''}`}
          onClick={winState === 'minimized' ? () => setWinState('normal') : undefined}
        >
          <div className="tcp-win-controls">
            <button className="tcp-win-btn tcp-win-btn--close"  onClick={onClose}              title="Close"    aria-label="Close" />
            <button className="tcp-win-btn tcp-win-btn--min"    onClick={() => setWinState(s => s === 'minimized' ? 'normal' : 'minimized')} title="Minimize" aria-label="Minimize" />
            <button className="tcp-win-btn tcp-win-btn--expand" onClick={() => setWinState(s => s === 'expanded'  ? 'normal' : 'expanded')}  title="Expand"   aria-label="Expand" />
          </div>
          <span className="tcp-title">Time Converter</span>
          <div className="tcp-header-actions">
            {winState !== 'minimized' && (
              <button
                className={`tcp-hist-btn${showHist ? ' active' : ''}`}
                onClick={() => setShowHist(v => !v)}
                title="Conversion history"
              >
                <History size={13} />
              </button>
            )}
            {winState === 'minimized' ? (
              <Maximize2 size={12} className="tcp-min-hint" />
            ) : winState === 'expanded' ? (
              <Minimize2 size={12} className="tcp-win-hint" />
            ) : null}
          </div>
        </div>

        {/* ── Body (hidden when minimized) ── */}
        {winState !== 'minimized' && (
          <>
            {/* History panel */}
            {showHist && (
              <div className="tcp-history">
                {history.length === 0 ? (
                  <p className="tcp-history-empty">No conversions yet — results appear here as you type.</p>
                ) : (
                  history.map((e, i) => (
                    <button key={i} className="tcp-history-row" onClick={() => restoreHistory(e)}>
                      <span className="tcp-history-label">{labelFor(e)}</span>
                      <span className="tcp-history-results">
                        {e.results.map(r => `${r.course}: ${r.time}`).join(' · ')}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            <div className="tcp-controls">
              <select className="tcp-select" value={dist} onChange={e => setDist(e.target.value)}>
                {DISTS.map(d => <option key={d} value={d}>{d}m / {d}y</option>)}
              </select>
              <select className="tcp-select" value={stroke} onChange={e => setStroke(e.target.value)}>
                {STROKES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            <div className="tcp-input-row">
              <select className="tcp-course-select" value={from} onChange={e => setFrom(e.target.value as Course)}>
                {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                className="tcp-input"
                placeholder="52.45 or 1:52.45"
                value={input}
                onChange={e => setInput(e.target.value)}
                spellCheck={false}
                autoFocus
              />
              <button className="tcp-cycle" onClick={() => setFrom(c => COURSES[(COURSES.indexOf(c)+1)%3])} title="Cycle course">
                <ArrowRightLeft size={13} />
              </button>
            </div>

            <div className="tcp-results">
              {others.map(c => {
                const val = parsed !== null ? fmt(convert(parsed, from, c, stroke, dist)) : '—'
                return (
                  <div key={c} className="tcp-result">
                    <span className="tcp-result-course">{c}</span>
                    <span className="tcp-result-time">{val}</span>
                  </div>
                )
              })}
            </div>

            {winState === 'expanded' && parsed !== null && (
              <div className="tcp-all-results">
                <div className="tcp-all-label">All courses</div>
                {COURSES.map(c => (
                  <div key={c} className={`tcp-all-row${c === from ? ' tcp-all-row--source' : ''}`}>
                    <span className="tcp-all-course">{c}</span>
                    <span className="tcp-all-time">
                      {c === from ? input : fmt(convert(parsed, from, c, stroke, dist))}
                    </span>
                    {c === from && <span className="tcp-all-badge">input</span>}
                  </div>
                ))}
              </div>
            )}

            <p className="tcp-note">Estimates only — FINA approximation model</p>
          </>
        )}
      </div>
    </div>
  )
}
