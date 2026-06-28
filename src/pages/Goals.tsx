import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, Plus, Target, Trash2, ArrowRightLeft, Archive, ChevronDown, ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import TimeConverterPopup from '../components/TimeConverterPopup'
import './Goals.css'

type Course = 'SCY' | 'LCM' | 'SCM'

export interface Goal {
  id: string
  course: Course
  eventId: string
  eventLabel: string
  stroke: string
  currentTime: string
  targetTime: string
  deadline: string
  createdAt: string
}

function toSeconds(t: string): number | null {
  if (!t) return null
  const parts = t.split(':')
  if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1])
  const n = parseFloat(t)
  return isNaN(n) ? null : n
}

function fmtSec(s: number): string {
  if (s < 60) return s.toFixed(2)
  const m = Math.floor(s / 60)
  return `${m}:${(s - m * 60).toFixed(2).padStart(5, '0')}`
}

function GoalSlider({ startSec, currentSec, targetSec, achieved }: {
  startSec: number; currentSec: number; targetSec: number; achieved: boolean
}) {
  // Faster = lower seconds. Slider: left=slow (start), right=fast (target)
  // We clamp so currentSec never goes past the target (visually)
  const range = Math.max(startSec - targetSec, 0.01)
  const progress = achieved ? 100 : Math.min(100, Math.max(0, ((startSec - currentSec) / range) * 100))

  return (
    <div className="goal-slider-wrap">
      <div className="goal-slider-track">
        <div className="goal-slider-fill" style={{ width: `${progress}%` }} />
        <div className="goal-slider-marker" style={{ left: `${progress}%` }} />
      </div>
      <div className="goal-slider-labels">
        <span className="goal-slider-lbl goal-slider-lbl--start" title="Starting time">{fmtSec(startSec)}</span>
        <span className="goal-slider-pct">{Math.round(progress)}% there</span>
        <span className="goal-slider-lbl goal-slider-lbl--target" title="Goal time">{fmtSec(targetSec)}</span>
      </div>
    </div>
  )
}

function formatDeadline(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function daysLeft(iso: string): number {
  const end = new Date(iso + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export default function Goals() {
  const navigate = useNavigate()
  const [goals,        setGoals]        = useState<Goal[]>([])
  const [archive,      setArchive]      = useState<Goal[]>([])
  const [times,        setTimes]        = useState<Record<string, string>>({})
  const [showTC,       setShowTC]       = useState(false)
  const [showArchive,  setShowArchive]  = useState(false)
  const [showSMART,    setShowSMART]    = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user
      if (!user) { navigate('/'); return }
      setGoals(user.user_metadata?.goals ?? [])
      setArchive(user.user_metadata?.goalArchive ?? [])
      setTimes(user.user_metadata?.times ?? {})
    })
  }, [navigate])

  function isAchieved(goal: Goal): boolean {
    const liveTime = times[`${goal.course}-${goal.eventId}`] || ''
    const liveSec   = toSeconds(liveTime || goal.currentTime)
    const targetSec = toSeconds(goal.targetTime)
    return liveSec !== null && targetSec !== null && liveSec <= targetSec
  }

  async function deleteGoal(id: string) {
    const updated = goals.filter(g => g.id !== id)
    setGoals(updated)
    await supabase.auth.updateUser({ data: { goals: updated } })
  }

  async function archiveCompleted() {
    const achieved = goals.filter(g => isAchieved(g))
    if (achieved.length === 0) return
    const remaining = goals.filter(g => !isAchieved(g))
    const newArchive = [...archive, ...achieved]
    setGoals(remaining)
    setArchive(newArchive)
    await supabase.auth.updateUser({ data: { goals: remaining, goalArchive: newArchive } })
  }

  return (
    <div className="goals-layout">
      <aside className="goals-sidebar">
        <div className="goals-sidebar-brand">Goals</div>
        <nav className="goals-sidebar-nav">
          <button className="goals-nav-btn" onClick={() => navigate('/dashboard')}>
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </button>
          <button className="goals-nav-btn" onClick={() => setShowTC(true)}>
            <ArrowRightLeft size={16} />
            <span>Time Converter</span>
          </button>
          <button className="goals-nav-btn goals-smart-btn" onClick={() => setShowSMART(true)}>
            <Target size={16} />
            <span>Goal Help (SMART)</span>
          </button>
        </nav>
      </aside>

      {showSMART && (
        <div className="smart-overlay" onClick={() => setShowSMART(false)}>
          <div className="smart-panel" onClick={e => e.stopPropagation()}>
            <div className="smart-header">
              <span>SMART Goal Planning</span>
              <button className="smart-close" onClick={() => setShowSMART(false)}>✕</button>
            </div>
            <div className="smart-body">
              <p className="smart-intro">
                The SMART system turns vague wishes into concrete, achievable targets. Here's how to apply it to your swim goals:
              </p>
              <div className="smart-item">
                <div className="smart-letter">S</div>
                <div>
                  <div className="smart-name">Specific</div>
                  <p>Name the exact event, course, and time standard. Don't say "swim faster" — say "drop to 55.0 in the 100 Freestyle SCY."</p>
                </div>
              </div>
              <div className="smart-item">
                <div className="smart-letter">M</div>
                <div>
                  <div className="smart-name">Measurable</div>
                  <p>Your goal is already measured in seconds. Track every logged time in Progress so you can see how close you are at any point.</p>
                </div>
              </div>
              <div className="smart-item">
                <div className="smart-letter">A</div>
                <div>
                  <div className="smart-name">Achievable</div>
                  <p>Look at your Progress chart. Is your trend heading in the right direction? A 1–3% drop per season is realistic. 10% is too ambitious unless you're a new swimmer.</p>
                </div>
              </div>
              <div className="smart-item">
                <div className="smart-letter">R</div>
                <div>
                  <div className="smart-name">Relevant</div>
                  <p>Focus on your primary events first. If your main event is butterfly, don't spend goal-setting energy on backstroke. Pick events that align with your meets and coach's plan.</p>
                </div>
              </div>
              <div className="smart-item">
                <div className="smart-letter">T</div>
                <div>
                  <div className="smart-name">Time-Bound</div>
                  <p>Set a deadline tied to a real meet — not a vague "end of season." Add that meet to your Calendar and use the deadline field in the goal card.</p>
                </div>
              </div>
              <div className="smart-tip">
                <strong>Tip:</strong> Use the Qualifications page to see which USA Swimming cut is just above your current best — that's your next natural goal.
              </div>
            </div>
          </div>
        </div>
      )}
      <TimeConverterPopup isOpen={showTC} onClose={() => setShowTC(false)} />

      <div className="goals-page">
        <div className="goals-header">
          <button className="page-mob-back" onClick={() => navigate('/dashboard')}>
            <ChevronLeft size={15} /> Dashboard
          </button>
          <div className="goals-header-info">
            <h1 className="goals-title">My Goals</h1>
            <p className="goals-subtitle">Times you're working toward</p>
          </div>
          <img src="/logos/scs.svg" alt="Southern California Swimming" className="scs-logo-corner" />
        </div>

        <div className="goals-body">
          {/* ── Archive button ── */}
          {goals.some(g => isAchieved(g)) && (
            <button className="goals-archive-btn" onClick={archiveCompleted}>
              <Archive size={14} /> Archive Completed Goals
            </button>
          )}

          {goals.length === 0 ? (
            <div className="goals-empty">
              <Target size={52} className="goals-empty-icon" />
              <h2>No goals yet</h2>
              <p>Set a target time for any event and track your progress toward it.</p>
              <button className="goals-create-btn" onClick={() => navigate('/goals/create')}>
                <Plus size={18} />
                Create your first goal
              </button>
            </div>
          ) : (
            <div className="goals-list">
              {goals.map(goal => {
                const liveTime = times[`${goal.course}-${goal.eventId}`] || ''
                const liveSec   = toSeconds(liveTime || goal.currentTime)
                const targetSec = toSeconds(goal.targetTime)
                const achieved  = liveSec !== null && targetSec !== null && liveSec <= targetSec
                const days      = goal.deadline ? daysLeft(goal.deadline) : null
                const overdue   = days !== null && days < 0

                return (
                  <div
                    key={goal.id}
                    className={`goal-card${achieved ? ' goal-card--achieved' : overdue ? ' goal-card--overdue' : ''}`}
                  >
                    <div className="goal-card-top">
                      <div className="goal-event-row">
                        <span className="goal-event">{goal.eventLabel}</span>
                        <span className={`goal-course-badge goal-course-badge--${goal.course.toLowerCase()}`}>
                          {goal.course}
                        </span>
                      </div>
                      <button
                        className="goal-delete"
                        onClick={() => deleteGoal(goal.id)}
                        title="Delete goal"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="goal-times">
                      <div className="goal-time-block">
                        <span className="goal-time-label">Current</span>
                        <span className="goal-time-value">
                          {liveTime || goal.currentTime || '—'}
                        </span>
                      </div>
                      <div className="goal-arrow">→</div>
                      <div className="goal-time-block">
                        <span className="goal-time-label">Target</span>
                        <span className={`goal-time-value goal-time-target${achieved ? ' goal-time-target--met' : ''}`}>
                          {goal.targetTime}
                        </span>
                      </div>
                    </div>

                    {targetSec !== null && (liveSec !== null || toSeconds(goal.currentTime) !== null) && (
                      <GoalSlider
                        startSec={Math.max(toSeconds(goal.currentTime) ?? 0, liveSec ?? 0)}
                        currentSec={liveSec ?? toSeconds(goal.currentTime) ?? targetSec}
                        targetSec={targetSec}
                        achieved={achieved}
                      />
                    )}

                    <div className="goal-footer">
                      {goal.deadline ? (
                        <span className={`goal-deadline${overdue ? ' goal-deadline--overdue' : ''}`}>
                          {overdue
                            ? `Deadline passed — ${formatDeadline(goal.deadline)}`
                            : days === 0
                            ? `Due today — ${formatDeadline(goal.deadline)}`
                            : `${days} day${days === 1 ? '' : 's'} left — ${formatDeadline(goal.deadline)}`
                          }
                        </span>
                      ) : (
                        <span className="goal-deadline">No deadline set</span>
                      )}
                      {achieved && <span className="goal-achieved-badge">✓ Achieved!</span>}
                    </div>
                  </div>
                )
              })}

              <button className="goals-add-btn" onClick={() => navigate('/goals/create')}>
                <Plus size={18} />
                Add another goal
              </button>
            </div>
          )}
          {/* ── Goal Archive section ── */}
          {archive.length > 0 && (
            <div className="goals-archive-section">
              <button className="goals-archive-header" onClick={() => setShowArchive(v => !v)}>
                <Archive size={15} />
                <span>Goal Archive ({archive.length})</span>
                <ChevronDown size={14} className={`goals-archive-chevron${showArchive ? ' open' : ''}`} />
              </button>
              {showArchive && (
                <div className="goals-archive-list">
                  {archive.map(goal => (
                    <div key={goal.id} className="goals-archive-row">
                      <span className="goals-archive-event">{goal.eventLabel} · {goal.course}</span>
                      <span className="goals-archive-time">Target: {goal.targetTime}</span>
                      <span className="goals-archive-badge">✓ Achieved</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
