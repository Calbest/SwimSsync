import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import '../App.css'
import './CreateAccount.css'

export default function CreateAccount() {
  const navigate = useNavigate()
  const [fullName,     setFullName]     = useState('')
  const [gender,       setGender]       = useState('')
  const [dob,          setDob]          = useState('')
  const [clubTeam,     setClubTeam]     = useState('')
  const [highSchool,   setHighSchool]   = useState('')
  const [username,     setUsername]     = useState('')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [confirm,      setConfirm]      = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!fullName.trim()) {
      setError('Please enter your full name.')
      return
    }
    if (!gender) {
      setError('Please select your gender.')
      return
    }
    if (!dob) {
      setError('Please enter your birthday.')
      return
    }
    if (!username.trim()) {
      setError('Please choose a username.')
      return
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
      setError('Username must be 3–20 characters: letters, numbers, or underscores only.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    // Check username uniqueness
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.trim().toLowerCase())
      .maybeSingle()
    if (existing) {
      setError('That username is already taken. Please choose another.')
      setLoading(false)
      return
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username.trim().toLowerCase(),
          full_name: fullName.trim(),
          gender,
          dob,
          club_team: clubTeam.trim(),
          high_school: highSchool.trim(),
        },
      },
    })
    setLoading(false)

    if (signUpError) {
      console.error('Supabase signUp error:', signUpError)
      setError(signUpError.message || JSON.stringify(signUpError))
    } else {
      localStorage.setItem('sw_new_account', '1')
      navigate('/dashboard')
    }
  }

  const LANE_COLORS  = ['#00b4d8','#0096c7','#00b4d8','#48cae4','#90e0ef','#0096c7','#00b4d8']
  const FLOAT_COLORS = ['#ff6b6b','#ffd166','#06d6a0','#ff6b6b','#ffd166','#06d6a0','#ff6b6b']

  return (
    <div className="auth-page">
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
        ] as { left: string; size: number; delay: number; dur: number; drift: string }[]).map((b, i) => (
          <span key={i} className="auth-bubble" style={{
            left: b.left, width: b.size, height: b.size,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.dur}s`,
            ['--drift' as string]: b.drift,
          }} />
        ))}
      </div>
      <header className="navbar">
        <Link to="/" className="nav-brand" style={{ textDecoration: 'none' }}>
          <img src="/logo.svg" alt="PaceBook logo" className="nav-logo-img" />
          <span className="nav-logo">PaceBook</span>
        </Link>
        <img src="/logos/scs.svg" alt="Southern California Swimming" className="scs-logo-corner" />
      </header>

      <main className="auth-main">
        <div className="auth-card">
          <img src="/logo.svg" alt="" className="auth-logo" />
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-sub">Start tracking your swim times today.</p>

          <form onSubmit={handleSubmit} className="auth-form">

            <div className="name-gender-row">
              <label className="auth-label">
                Full Name
                <input
                  className="auth-input"
                  type="text"
                  placeholder="e.g. Michael Phelps"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </label>
              <div className="auth-label gender-field">
                Gender
                <div className="gender-toggle">
                  <button
                    type="button"
                    className={`gender-btn${gender === 'male' ? ' active' : ''}`}
                    onClick={() => setGender('male')}
                  >♂ Male</button>
                  <button
                    type="button"
                    className={`gender-btn${gender === 'female' ? ' active' : ''}`}
                    onClick={() => setGender('female')}
                  >♀ Female</button>
                </div>
              </div>
            </div>

            <label className="auth-label">
              Your Birthday
              <input
                className="auth-input"
                type="date"
                value={dob}
                onChange={e => setDob(e.target.value)}
                required
                max={new Date().toISOString().split('T')[0]}
              />
            </label>

            <div className="auth-team-row">
              <label className="auth-label">
                Club Team <span className="auth-optional">(optional)</span>
                <input
                  className="auth-input"
                  type="text"
                  placeholder="e.g. Irvine Novaquatics"
                  value={clubTeam}
                  onChange={e => setClubTeam(e.target.value)}
                  autoComplete="organization"
                />
              </label>
              <label className="auth-label">
                High School <span className="auth-optional">(optional)</span>
                <input
                  className="auth-input"
                  type="text"
                  placeholder="e.g. Newport Harbor HS"
                  value={highSchool}
                  onChange={e => setHighSchool(e.target.value)}
                />
              </label>
            </div>

            <label className="auth-label">
              Username
              <input
                className="auth-input"
                type="text"
                placeholder="e.g. swimfast99"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </label>

            <label className="auth-label">
              Email
              <input
                className="auth-input"
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>

            <label className="auth-label">
              Password
              <div className="auth-pw-wrap">
                <input
                  className="auth-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button type="button" className="auth-pw-toggle" onClick={() => setShowPassword(s => !s)} tabIndex={-1}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <label className="auth-label">
              Confirm password
              <div className="auth-pw-wrap">
                <input
                  className="auth-input"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button type="button" className="auth-pw-toggle" onClick={() => setShowConfirm(s => !s)} tabIndex={-1}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {error && <p className="auth-error">{error}</p>}

            <button className="btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account?{' '}
            <Link to="/sign-in" className="auth-link">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
