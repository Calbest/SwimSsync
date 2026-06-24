import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import '../App.css'
import './CreateAccount.css'

export default function CreateAccount() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })
    setLoading(false)

    if (signUpError) {
      setError(signUpError.message)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="auth-page">
      <header className="navbar">
        <Link to="/" className="nav-brand" style={{ textDecoration: 'none' }}>
          <img src="/logo.svg" alt="SwimSCPlan logo" className="nav-logo-img" />
          <span className="nav-logo">SwimSCPlan</span>
        </Link>
      </header>

      <main className="auth-main">
        <div className="auth-card">
          <img src="/logo.svg" alt="" className="auth-logo" />
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-sub">Start tracking your swim times today.</p>

          <form onSubmit={handleSubmit} className="auth-form">
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
              <input
                className="auth-input"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </label>

            <label className="auth-label">
              Confirm password
              <input
                className="auth-input"
                type="password"
                placeholder="Re-enter your password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
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
