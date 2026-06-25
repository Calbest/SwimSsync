import { X, Clock } from 'lucide-react'
import './ColorLegend.css'

interface Props {
  onClose: () => void
}

export default function ColorLegend({ onClose }: Props) {
  return (
    <div className="cl-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cl-panel">
        <div className="cl-header">
          <h2 className="cl-title">Color &amp; Symbol Legend</h2>
          <button className="cl-close" onClick={onClose} aria-label="Close legend">
            <X size={18} />
          </button>
        </div>

        <div className="cl-body">

          {/* ── 1. Time Standard Proximity ── */}
          <section className="cl-section">
            <h3 className="cl-section-title">Time Standard Proximity</h3>
            <p className="cl-section-note">Used on: Compare Times · Qualifications · Event Planning</p>
            <p className="cl-section-desc">
              Shows how close your best time is to the qualifying standard cut.
              Calculated as: <em>(your time − cut time) ÷ cut time × 100%</em>
            </p>
            <div className="cl-rows">
              <div className="cl-row">
                <span className="cl-swatch" style={{ background: '#1d4ed8', boxShadow: '0 0 0 2px #1e3a8a' }}>✓</span>
                <div>
                  <span className="cl-row-label">Meets Standard</span>
                  <span className="cl-row-desc">Your time is at or faster than the cut — you qualify</span>
                </div>
              </div>
              <div className="cl-row">
                <span className="cl-swatch" style={{ background: '#0891b2', boxShadow: '0 0 0 2px #0e7490' }}>≈</span>
                <div>
                  <span className="cl-row-label">Within 3%</span>
                  <span className="cl-row-desc">Very close — achievable with a strong race</span>
                </div>
              </div>
              <div className="cl-row">
                <span className="cl-swatch" style={{ background: '#d97706', boxShadow: '0 0 0 2px #92400e' }}>!</span>
                <div>
                  <span className="cl-row-label">Within 7%</span>
                  <span className="cl-row-desc">On the edge — requires focused improvement</span>
                </div>
              </div>
              <div className="cl-row">
                <span className="cl-swatch" style={{ background: '#ea580c', boxShadow: '0 0 0 2px #9a3412' }}>!!</span>
                <div>
                  <span className="cl-row-label">Within 15%</span>
                  <span className="cl-row-desc">Noticeable gap — needs significant work</span>
                </div>
              </div>
              <div className="cl-row">
                <span className="cl-swatch" style={{ background: '#b91c1c', boxShadow: '0 0 0 2px #7f1d1d' }}>✗</span>
                <div>
                  <span className="cl-row-label">More than 15%</span>
                  <span className="cl-row-desc">Large gap — consider focusing on stronger events</span>
                </div>
              </div>
            </div>
          </section>

          {/* ── 2. Event Planning Recommendations ── */}
          <section className="cl-section">
            <h3 className="cl-section-title">Event Planning Recommendations</h3>
            <p className="cl-section-note">Used on: Event Planning</p>
            <p className="cl-section-desc">
              Each event gets a recommendation based on your proximity to the standard
              and how recently the time was swum.
            </p>
            <div className="cl-rows">
              <div className="cl-row">
                <span className="cl-badge" style={{ background: '#1d4ed8', color: '#fff' }}>Enter</span>
                <div>
                  <span className="cl-row-label">Enter</span>
                  <span className="cl-row-desc">Time meets or is very close to standard, and is recent — strong event to enter</span>
                </div>
              </div>
              <div className="cl-row">
                <span className="cl-badge" style={{ background: '#d97706', color: '#fff' }}>Consider</span>
                <div>
                  <span className="cl-row-label">Consider</span>
                  <span className="cl-row-desc">Within range but factors like a stale time or a moderate gap should be weighed</span>
                </div>
              </div>
              <div className="cl-row">
                <span className="cl-badge" style={{ background: '#e2e8f0', color: '#64748b' }}>Skip</span>
                <div>
                  <span className="cl-row-label">Skip</span>
                  <span className="cl-row-desc">Gap is too large or time is too old — may not be the best use of an entry</span>
                </div>
              </div>
              <div className="cl-row">
                <span className="cl-badge" style={{ background: '#f1f5f9', color: '#94a3b8' }}>No Time</span>
                <div>
                  <span className="cl-row-label">No Time</span>
                  <span className="cl-row-desc">No best time recorded for this event — enter one on the Dashboard first</span>
                </div>
              </div>
            </div>
          </section>

          {/* ── 3. Staleness Indicators ── */}
          <section className="cl-section">
            <h3 className="cl-section-title">Time Staleness</h3>
            <p className="cl-section-note">Used on: Event Planning</p>
            <p className="cl-section-desc">
              A clock icon appears next to times that may not reflect your current fitness.
              Hover over the icon to see the exact date and advice.
            </p>
            <div className="cl-rows">
              <div className="cl-row">
                <span className="cl-icon-demo" style={{ color: '#94a3b8' }}><Clock size={16} /></span>
                <div>
                  <span className="cl-row-label">Gray clock — No date on file</span>
                  <span className="cl-row-desc">Time was entered manually without a race date attached</span>
                </div>
              </div>
              <div className="cl-row">
                <span className="cl-icon-demo" style={{ color: '#d97706' }}><Clock size={16} /></span>
                <div>
                  <span className="cl-row-label">Amber clock — 3 to 6 months old</span>
                  <span className="cl-row-desc">Time is getting older — consider how your fitness may have changed</span>
                </div>
              </div>
              <div className="cl-row">
                <span className="cl-icon-demo" style={{ color: '#ea580c' }}><Clock size={16} /></span>
                <div>
                  <span className="cl-row-label">Orange clock — 6+ months old</span>
                  <span className="cl-row-desc">Time may be significantly outdated — weigh this heavily when selecting events</span>
                </div>
              </div>
              <div className="cl-row">
                <span className="cl-icon-demo" style={{ color: '#94a3b8', opacity: 0 }}><Clock size={16} /></span>
                <div>
                  <span className="cl-row-label">No clock — Recent time</span>
                  <span className="cl-row-desc">Time was swum within the last 90 days — considered current and accurate</span>
                </div>
              </div>
            </div>
          </section>

          {/* ── 4. Entry Deadline Countdown ── */}
          <section className="cl-section">
            <h3 className="cl-section-title">Entry Deadline Countdown</h3>
            <p className="cl-section-note">Used on: Event Planning</p>
            <div className="cl-rows">
              <div className="cl-row">
                <span className="cl-chip" style={{ background: '#dcfce7', color: '#15803d' }}>14 days left</span>
                <div>
                  <span className="cl-row-label">Green — Plenty of time</span>
                  <span className="cl-row-desc">More than 14 days before the entry deadline</span>
                </div>
              </div>
              <div className="cl-row">
                <span className="cl-chip" style={{ background: '#fef9c3', color: '#854d0e' }}>8 days left</span>
                <div>
                  <span className="cl-row-label">Amber — Closing soon</span>
                  <span className="cl-row-desc">7–14 days remaining — plan to submit entries soon</span>
                </div>
              </div>
              <div className="cl-row">
                <span className="cl-chip" style={{ background: '#fee2e2', color: '#991b1b' }}>3 days left</span>
                <div>
                  <span className="cl-row-label">Red — Submit now</span>
                  <span className="cl-row-desc">Under 7 days — entries are closing very soon</span>
                </div>
              </div>
              <div className="cl-row">
                <span className="cl-chip" style={{ background: '#f1f5f9', color: '#64748b' }}>Deadline passed</span>
                <div>
                  <span className="cl-row-label">Gray — Window closed</span>
                  <span className="cl-row-desc">The entry deadline has already passed</span>
                </div>
              </div>
            </div>
          </section>

          {/* ── 5. Progress Chart Stats ── */}
          <section className="cl-section">
            <h3 className="cl-section-title">Progress Chart — Stat Chips</h3>
            <p className="cl-section-note">Used on: Progress</p>
            <div className="cl-rows">
              <div className="cl-row">
                <span className="cl-chip" style={{ background: '#e0f2fe', color: '#0369a1', fontVariantNumeric: 'tabular-nums' }}>52.34</span>
                <div>
                  <span className="cl-row-label">Blue — Best time</span>
                  <span className="cl-row-desc">Your fastest recorded time for this event</span>
                </div>
              </div>
              <div className="cl-row">
                <span className="cl-chip" style={{ background: '#dcfce7', color: '#15803d' }}>−1.23s</span>
                <div>
                  <span className="cl-row-label">Green — Improved</span>
                  <span className="cl-row-desc">You've gotten faster over the recorded period</span>
                </div>
              </div>
              <div className="cl-row">
                <span className="cl-chip" style={{ background: '#fee2e2', color: '#991b1b' }}>+0.45s</span>
                <div>
                  <span className="cl-row-label">Red — Slower</span>
                  <span className="cl-row-desc">Times have gotten slower over the recorded period</span>
                </div>
              </div>
            </div>
          </section>

          {/* ── 6. Import Tags ── */}
          <section className="cl-section">
            <h3 className="cl-section-title">Import Times — Tags</h3>
            <p className="cl-section-note">Used on: Import Times</p>
            <div className="cl-rows">
              <div className="cl-row">
                <span className="cl-chip" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 800 }}>↑ PR</span>
                <div>
                  <span className="cl-row-label">Green "↑ PR" — Personal Record</span>
                  <span className="cl-row-desc">This imported time is faster than your current best — it will set a new PR</span>
                </div>
              </div>
              <div className="cl-row">
                <span className="cl-chip" style={{ background: '#fef2f2', color: '#991b1b', fontWeight: 800 }}>↓ slower</span>
                <div>
                  <span className="cl-row-label">Red "↓ slower" — Not a PR</span>
                  <span className="cl-row-desc">This imported time is slower than your current best — uncheck if you only want PRs</span>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
