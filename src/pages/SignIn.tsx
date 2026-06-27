import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import '../App.css'
import './CreateAccount.css'

// ── Client-side rate limiting ──────────────────────────────────────────────
const RATE_KEY  = 'sw_login_attempts'
const MAX_TRIES = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

interface AttemptRecord { count: number; firstAttempt: number; lockedUntil?: number }

function getRateState() {
  try {
    const raw = localStorage.getItem(RATE_KEY)
    if (!raw) return { blocked: false, remainingMs: 0, triesLeft: MAX_TRIES }
    const r: AttemptRecord = JSON.parse(raw)
    const now = Date.now()
    if (r.lockedUntil && now < r.lockedUntil)
      return { blocked: true, remainingMs: r.lockedUntil - now, triesLeft: 0 }
    if (now - r.firstAttempt > WINDOW_MS) {
      localStorage.removeItem(RATE_KEY)
      return { blocked: false, remainingMs: 0, triesLeft: MAX_TRIES }
    }
    return { blocked: r.count >= MAX_TRIES, remainingMs: 0, triesLeft: Math.max(0, MAX_TRIES - r.count) }
  } catch { return { blocked: false, remainingMs: 0, triesLeft: MAX_TRIES } }
}

function recordFail() {
  try {
    const raw = localStorage.getItem(RATE_KEY)
    const now = Date.now()
    if (!raw || now - (JSON.parse(raw) as AttemptRecord).firstAttempt > WINDOW_MS) {
      localStorage.setItem(RATE_KEY, JSON.stringify({ count: 1, firstAttempt: now }))
      return
    }
    const r: AttemptRecord = JSON.parse(raw)
    const next: AttemptRecord = { ...r, count: r.count + 1 }
    if (next.count >= MAX_TRIES) next.lockedUntil = r.firstAttempt + WINDOW_MS
    localStorage.setItem(RATE_KEY, JSON.stringify(next))
  } catch { /* storage unavailable */ }
}

function fmtMs(ms: number) {
  const m = Math.ceil(ms / 60000)
  return `${m} minute${m !== 1 ? 's' : ''}`
}
// ──────────────────────────────────────────────────────────────────────────

export default function SignIn() {
  const navigate = useNavigate()
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [rate,      setRate]      = useState(getRateState)

  // Tick countdown every second while locked
  useEffect(() => {
    if (!rate.blocked) return
    const id = setInterval(() => { const s = getRateState(); setRate(s); if (!s.blocked) clearInterval(id) }, 1000)
    return () => clearInterval(id)
  }, [rate.blocked])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const cur = getRateState()
    setRate(cur)
    if (cur.blocked) return

    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (signInError) {
      recordFail()
      setRate(getRateState())
      // Generic message — never reveal which field was wrong
      setError('Invalid email or password.')
    } else {
      localStorage.removeItem(RATE_KEY)
      navigate('/dashboard')
    }
  }

  const LANE_COLORS   = ['#00b4d8','#0096c7','#00b4d8','#48cae4','#90e0ef','#0096c7','#00b4d8']
  const FLOAT_COLORS  = ['#ff6b6b','#ffd166','#06d6a0','#ff6b6b','#ffd166','#06d6a0','#ff6b6b']

  return (
    <div className="auth-page">
      {/* Pool lane ropes */}
      <div className="auth-pool-lanes" aria-hidden="true">
        {[76, 152, 228, 304, 380, 456, 532].map((left, i) => (
          <div key={i} className="auth-pool-lane-rope" style={{ left }}>
            {Array.from({ length: 28 }).map((_, j) => (
              <span key={j} className="auth-lane-float"
                style={{ background: j % 3 === 0 ? FLOAT_COLORS[i] : LANE_COLORS[i], opacity: 0.55 + (j % 2) * 0.15 }} />
            ))}
          </div>
        ))}
      </div>
      {/* Rising bubbles */}
      <div className="auth-bubbles" aria-hidden="true">
        {([
          { left: '8%',  size: 8,  delay: 0,   dur: 9,  drift: '18px'  },
          { left: '18%', size: 5,  delay: 2.5, dur: 11, drift: '-14px' },
          { left: '31%', size: 11, delay: 1,   dur: 8,  drift: '22px'  },
          { left: '44%', size: 6,  delay: 4,   dur: 13, drift: '-8px'  },
          { left: '57%', size: 9,  delay: 0.5, dur: 10, drift: '16px'  },
          { left: '68%', size: 4,  delay: 3,   dur: 12, drift: '-20px' },
          { left: '79%', size: 7,  delay: 1.8, dur: 9,  drift: '12px'  },
          { left: '89%', size: 5,  delay: 5,   dur: 11, drift: '-10px' },
          { left: '24%', size: 3,  delay: 6,   dur: 14, drift: '8px'   },
          { left: '62%', size: 6,  delay: 7,   dur: 10, drift: '-16px' },
          { left: '93%', size: 4,  delay: 2,   dur: 13, drift: '20px'  },
          { left: '5%',  size: 7,  delay: 8,   dur: 11, drift: '-6px'  },
        ] as { left: string; size: number; delay: number; dur: number; drift: string }[]).map((b, i) => (
          <span key={i} className="auth-bubble" style={{
            left: b.left,
            width: b.size,
            height: b.size,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.dur}s`,
            ['--drift' as string]: b.drift,
          }} />
        ))}
      </div>
      <header className="navbar">
        <Link to="/" className="nav-brand" style={{ textDecoration: 'none' }}>
          <img src="/logo.svg" alt="SwimSCPlan logo" className="nav-logo-img" />
          <span className="nav-logo">SwimSCPlan</span>
        </Link>
      </header>

      <main className="auth-main">
        <div className="auth-card">
          <img src="/logo.svg" alt="" className="auth-logo" />
          <h1 className="auth-title">Sign in</h1>
          <p className="auth-sub">Welcome back. Let's check your times.</p>

          {rate.blocked ? (
            <div className="auth-locked">
              <p className="auth-locked-title">Too many failed attempts</p>
              <p className="auth-locked-sub">Try again in <strong>{fmtMs(rate.remainingMs)}</strong>.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              <label className="auth-label">
                Email
                <input className="auth-input" type="email" placeholder="you@email.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  required autoComplete="email" maxLength={254} />
              </label>
              <label className="auth-label">
                Password
                <input className="auth-input" type="password" placeholder="Your password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete="current-password" maxLength={128} />
              </label>

              {error && <p className="auth-error">{error}</p>}

              {rate.triesLeft > 0 && rate.triesLeft <= 2 && (
                <p className="auth-warn">
                  {rate.triesLeft} attempt{rate.triesLeft !== 1 ? 's' : ''} remaining before temporary lockout.
                </p>
              )}

              <button className="btn-primary btn-block" type="submit" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          )}

          <p className="auth-switch">
            Don't have an account?{' '}
            <Link to="/create-account" className="auth-link">Create one</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
