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
        {/* TODO: Fill in the purpose of the website below */}
        <p className="purpose-body">
          [Replace this paragraph with a description of what SwimSCPlan does,
          who it's for, and the core problem it solves.]
        </p>
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
