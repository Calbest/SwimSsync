import { useState } from 'react'
import compareTimesImg from '../Assets/CompareTimes.png'
import './OnboardingModal.css'

interface Props {
  name: string
  onDone: () => void
}

const SLIDES = [
  {
    title: (name: string) => `Welcome, ${name || 'swimmer'}!`,
    body: "PaceBook is your all-in-one swim planning tool. Let's take a quick tour so you know where everything lives.",
    visual: 'welcome',
  },
  {
    title: () => 'The sidebar is your home base',
    body: 'Every feature lives in the sidebar on the left. Click any icon to jump between Compare, Goals, Progress, Calendar, and more.',
    visual: 'sidebar',
  },
  {
    title: () => 'Step 1: Import your times',
    body: 'This is the most important first step. Sign into USA Swimming or Swimcloud, copy your full times history, and paste it into Import Times. Everything else builds on this.',
    visual: 'import',
  },
  {
    title: () => 'Compare to qualifying standards',
    body: "See instantly how your times stack up against USA Swimming cuts — JOs, Sectionals, Nationals, and more. Your imported times fill in automatically.",
    visual: 'compare',
  },
  {
    title: () => 'Plan your competitions',
    body: 'Browse upcoming meets, see which events you qualify for, and build your competition schedule for the season.',
    visual: 'competitions',
  },
  {
    title: () => 'Set season goals',
    body: "Pick any event, set a target time, and PaceBook tracks your progress automatically. Hit the goal and you'll get a notification.",
    visual: 'goals',
  },
  {
    title: () => 'Track your progress over time',
    body: "The Progress tab charts your time history for every event so you can see exactly how fast you're improving — and which events need work.",
    visual: 'progress',
  },
  {
    title: () => 'Log your training',
    body: 'Use the Calendar to mark practices, track attendance, and add session notes. Stay consistent and see your training volume at a glance.',
    visual: 'calendar',
  },
  {
    title: () => 'Your race library',
    body: 'Save race videos, split sheets, and training clips in the Media Library. Build your own archive of every important swim.',
    visual: 'media',
  },
  {
    title: () => 'Make it yours in Settings',
    body: 'Update your profile, choose a banner, set notification preferences, and manage your account — all in Settings.',
    visual: 'settings',
  },
  {
    title: () => "You're all set!",
    body: "Start by importing your times — it takes about 2 minutes and unlocks everything. You can replay this tour any time from Settings → Tutorial.",
    visual: 'done',
  },
]

const NAV_ITEMS = [
  { icon: '⇌', label: 'Compare' },
  { icon: '🏆', label: 'Quals'   },
  { icon: '🎯', label: 'Goals'   },
  { icon: '📈', label: 'Progress'},
  { icon: '📅', label: 'Calendar'},
  { icon: '📚', label: 'Media'   },
  { icon: '👥', label: 'Friends' },
]

function SlideVisual({ type, activeNav }: { type: string; activeNav: number }) {
  if (type === 'welcome') {
    return (
      <div className="ob-visual ob-visual--welcome">
        <div className="ob-pool-lane"><span /><span /><span /><span /><span /></div>
        <div className="ob-welcome-badge">🏊 PaceBook</div>
        <div className="ob-welcome-rings">
          <div className="ob-ring ob-ring--1" />
          <div className="ob-ring ob-ring--2" />
          <div className="ob-ring ob-ring--3" />
        </div>
      </div>
    )
  }

  if (type === 'sidebar') {
    return (
      <div className="ob-visual ob-visual--sidebar">
        <div className="ob-mock-app">
          <div className="ob-mock-rail">
            <div className="ob-mock-rail-logo" />
            {NAV_ITEMS.map((item, i) => (
              <div key={i} className={`ob-mock-rail-btn${i === activeNav ? ' ob-mock-rail-btn--active' : ''}`}>
                <span className="ob-mock-rail-icon">{item.icon}</span>
                <span className="ob-mock-rail-label">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="ob-mock-content">
            <div className="ob-mock-bar ob-mock-bar--lg" />
            <div className="ob-mock-bar ob-mock-bar--md" />
            <div className="ob-mock-bar ob-mock-bar--sm" />
            <div className="ob-mock-cards">
              <div className="ob-mock-card" />
              <div className="ob-mock-card" />
              <div className="ob-mock-card" />
            </div>
          </div>
        </div>
        <div className="ob-sidebar-arrow">← tap any icon to navigate</div>
      </div>
    )
  }

  if (type === 'import') {
    return (
      <div className="ob-visual ob-visual--import">
        <img src={compareTimesImg} alt="Compare Times" className="ob-import-img" />
        <div className="ob-import-badge">⚡ Do this first</div>
      </div>
    )
  }

  if (type === 'compare') {
    return (
      <div className="ob-visual ob-visual--compare">
        <div className="ob-compare-card">
          <div className="ob-compare-header">Qualifying Standards</div>
          {[
            { event: '100 Free', cut: 'JOs',        time: '48.39', color: '#7c3aed', bg: '#7c3aed18' },
            { event: '200 Free', cut: 'Sectionals',  time: '1:50.2', color: '#059669', bg: '#05966918' },
            { event: '100 Back', cut: 'Nationals',   time: '52.01', color: '#dc2626', bg: '#dc262618' },
          ].map(({ event, cut, time, color, bg }) => (
            <div key={event} className="ob-compare-row">
              <span className="ob-compare-event">{event}</span>
              <span className="ob-compare-cut" style={{ background: bg, color }}>{cut}</span>
              <span className="ob-compare-time">{time}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'competitions') {
    return (
      <div className="ob-visual ob-visual--competitions">
        <div className="ob-comp-card">
          <div className="ob-comp-header">
            <span className="ob-comp-badge">📍 Upcoming</span>
          </div>
          <div className="ob-comp-meet">SCS JAG Championships</div>
          <div className="ob-comp-date">July 18 – 20, 2026 · Riverside</div>
          <div className="ob-comp-events">
            {['100 Free ✓', '200 Free ✓', '100 Back'].map((e, i) => (
              <span key={i} className={`ob-comp-event${e.includes('✓') ? ' ob-comp-event--qual' : ''}`}>{e}</span>
            ))}
          </div>
          <div className="ob-comp-footer">2 events qualified</div>
        </div>
      </div>
    )
  }

  if (type === 'goals') {
    return (
      <div className="ob-visual ob-visual--goals">
        <div className="ob-goal-card">
          <div className="ob-goal-header">Season Goals</div>
          {[
            { event: '100 Free', current: '49.84', target: '48.5', pct: 72 },
            { event: '200 IM',   current: '2:05.3', target: '2:01', pct: 45 },
          ].map(({ event, current, target, pct }) => (
            <div key={event} className="ob-goal-row">
              <div className="ob-goal-row-top">
                <span className="ob-goal-event">{event}</span>
                <span className="ob-goal-times">{current} → {target}</span>
              </div>
              <div className="ob-goal-bar-bg">
                <div className="ob-goal-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'progress') {
    return (
      <div className="ob-visual ob-visual--progress">
        <div className="ob-prog-card">
          <div className="ob-prog-header">100 Free — SCY</div>
          <div className="ob-prog-chart">
            {[52.1, 51.3, 50.8, 49.9, 49.2, 48.6].map((val, i, arr) => {
              const min = Math.min(...arr), max = Math.max(...arr)
              const h = ((max - val) / (max - min)) * 60 + 10
              return (
                <div key={i} className="ob-prog-col">
                  <div className="ob-prog-bar" style={{ height: `${h}px` }} />
                  <div className="ob-prog-dot" />
                </div>
              )
            })}
          </div>
          <div className="ob-prog-labels">
            {['Jan','Mar','May','Jul','Sep','Nov'].map(m => (
              <span key={m} className="ob-prog-label">{m}</span>
            ))}
          </div>
          <div className="ob-prog-improvement">↓ 3.5s improvement</div>
        </div>
      </div>
    )
  }

  if (type === 'calendar') {
    return (
      <div className="ob-visual ob-visual--calendar">
        <div className="ob-cal-card">
          <div className="ob-cal-header">
            <span>◀</span>
            <span className="ob-cal-month">June 2026</span>
            <span>▶</span>
          </div>
          <div className="ob-cal-grid">
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <div key={i} className="ob-cal-dow">{d}</div>
            ))}
            {Array.from({ length: 30 }, (_, i) => {
              const isPrac = [1,2,3,4,7,8,9,10,11,14,15,16,17,18,21,22,23,24,25].includes(i + 2)
              const isToday = i === 24
              return (
                <div key={i} className={`ob-cal-day${isPrac ? ' ob-cal-day--prac' : ''}${isToday ? ' ob-cal-day--today' : ''}`}>
                  {i + 2}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  if (type === 'media') {
    return (
      <div className="ob-visual ob-visual--media">
        <div className="ob-media-card">
          <div className="ob-media-header">Race Library</div>
          {[
            { icon: '🎬', label: 'SCS JAG 100 Free Final', sub: 'Jul 19, 2026' },
            { icon: '📄', label: '200 IM Split Sheet', sub: 'Jun 5, 2026' },
            { icon: '🎬', label: '50 Back Relay Leg', sub: 'May 30, 2026' },
          ].map(({ icon, label, sub }) => (
            <div key={label} className="ob-media-row">
              <span className="ob-media-icon">{icon}</span>
              <div className="ob-media-info">
                <span className="ob-media-name">{label}</span>
                <span className="ob-media-sub">{sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'settings') {
    return (
      <div className="ob-visual ob-visual--settings">
        <div className="ob-settings-card">
          <div className="ob-settings-header">Settings</div>
          {[
            { label: 'Profile & info', icon: '👤' },
            { label: 'Banner & appearance', icon: '🎨' },
            { label: 'Notifications', icon: '🔔' },
            { label: 'Account & security', icon: '🔒' },
          ].map(({ label, icon }) => (
            <div key={label} className="ob-settings-row">
              <span className="ob-settings-icon">{icon}</span>
              <span className="ob-settings-label">{label}</span>
              <span className="ob-settings-arrow">›</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'done') {
    return (
      <div className="ob-visual ob-visual--done">
        <div className="ob-done-circle">
          <span className="ob-done-check">✓</span>
        </div>
        <div className="ob-done-sparkles">
          {['✦','✦','✦','✦','✦','✦'].map((s, i) => (
            <span key={i} className="ob-done-sparkle" style={{ '--i': i } as React.CSSProperties}>{s}</span>
          ))}
        </div>
      </div>
    )
  }

  return null
}

export default function OnboardingModal({ name, onDone }: Props) {
  const [slide, setSlide] = useState(0)
  const [activeNav, setActiveNav] = useState(0)

  const total = SLIDES.length
  const s = SLIDES[slide]
  const isLast = slide === total - 1

  const next = () => {
    if (isLast) { onDone(); return }
    setSlide(n => n + 1)
    if (slide === 1) setActiveNav(n => (n + 1) % NAV_ITEMS.length)
  }

  return (
    <div className="ob-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains('ob-overlay')) onDone() }}>
      <div className="ob-modal">

        <button className="ob-skip" onClick={onDone}>Skip</button>

        <SlideVisual type={s.visual} activeNav={activeNav} />

        <div className="ob-text">
          <h2 className="ob-title">{s.title(name)}</h2>
          <p className="ob-body">{s.body}</p>
        </div>

        <div className="ob-dots">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={`ob-dot${slide === i ? ' active' : ''}`}
              onClick={() => setSlide(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>

        <button className="ob-next" onClick={next}>
          {isLast ? "Let's go 🏊" : 'Next →'}
        </button>

      </div>
    </div>
  )
}
