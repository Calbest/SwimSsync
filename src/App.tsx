import './App.css'

function App() {
  return (
    <div className="page">
      {/* ── Navbar ── */}
      <header className="navbar">
        <span className="nav-logo">SwimSCPlan</span>
        <div className="nav-actions">
          <button className="btn-secondary">Sign In</button>
          <button className="btn-primary">Create Account</button>
        </div>
      </header>

      {/* ── Hero / Inspiration ── */}
      <section className="hero">
        <div className="hero-text">
          <h1>Train Smarter.<br />Swim Faster.</h1>
          <p className="hero-sub">
            {/* TODO: Replace with your one-line inspiration / tagline */}
            The planning tool built for swimmers who are serious about the sport.
          </p>
        </div>
        <div className="hero-img-placeholder">
          {/* TODO: Replace with <img src="..." alt="..." /> */}
          <span>Hero Image</span>
        </div>
      </section>

      {/* ── Purpose Section ── */}
      <section className="purpose">
        <h2>What is SwimSCPlan?</h2>
        <ul className="purpose-list">
          <li>Compare all your swim event times against upcoming meet cut times at a glance</li>
          <li>Track your progress over time and watch yourself improve as you grow</li>
          <li>Built-in calendar to organize and keep up with all your upcoming meets</li>
          <li>Highlights the events where your times are closest to qualifying cuts so you know exactly where to focus</li>
        </ul>
      </section>

      {/* ── Photo Gallery ── */}
      <section className="gallery">
        <h2>Built for the Pool</h2>
        <div className="gallery-grid">
          {[1, 2, 3].map((n) => (
            <div key={n} className="gallery-slot">
              {/* TODO: Replace with <img src="..." alt="..." /> */}
              <span>Photo {n}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Call to Action ── */}
      <section className="cta">
        <h2>Ready to get started?</h2>
        <p>Create a free account and take control of your training.</p>
        <button className="btn-primary btn-large">Create Account</button>
      </section>

      <footer className="footer">
        <span>© 2026 SwimSCPlan</span>
      </footer>
    </div>
  )
}

export default App
