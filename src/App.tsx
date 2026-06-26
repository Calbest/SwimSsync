import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import './App.css'

function StarRating({ onDone }: { onDone?: () => void }) {
  const [hovered,  setHovered]  = useState(0)
  const [selected, setSelected] = useState(0)
  const [comment,  setComment]  = useState('')
  const [status,   setStatus]   = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  async function submit() {
    if (!selected) return
    setStatus('sending')
    const { error } = await supabase
      .from('ratings')
      .insert({ stars: selected, comment: comment.trim() || null })
    setStatus(error ? 'error' : 'done')
    if (!error) onDone?.()
  }

  if (status === 'done') {
    return (
      <section className="rating-section">
        <div className="rating-card">
          <div className="rating-thanks-icon">★</div>
          <h3 className="rating-thanks-title">Thanks for the feedback!</h3>
          <p className="rating-thanks-sub">Your rating helps us improve SwimSCPlan.</p>
        </div>
      </section>
    )
  }

  const display = hovered || selected

  return (
    <section className="rating-section">
      <div className="rating-card">
        <h2 className="rating-heading">Rate SwimSCPlan</h2>
        <p className="rating-sub">How useful has this app been for your swimming?</p>

        <div className="rating-stars" onMouseLeave={() => setHovered(0)}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              className={`rating-star${n <= display ? ' filled' : ''}`}
              onMouseEnter={() => setHovered(n)}
              onClick={() => setSelected(n)}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
            >
              ★
            </button>
          ))}
        </div>

        {selected > 0 && (
          <p className="rating-label">
            {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][selected]}
          </p>
        )}

        {selected > 0 && (
          <textarea
            className="rating-comment"
            placeholder="Any comments? (optional)"
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            maxLength={500}
          />
        )}

        <button
          className="rating-submit"
          onClick={submit}
          disabled={!selected || status === 'sending'}
        >
          {status === 'sending' ? 'Submitting…' : 'Submit Rating'}
        </button>

        {status === 'error' && (
          <p className="rating-error">Something went wrong — please try again.</p>
        )}
      </div>
    </section>
  )
}

interface Review { id: number; comment: string; created_at: string }

function ReviewsCarousel({ refresh }: { refresh: number }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [idx,     setIdx]     = useState(0)

  useEffect(() => {
    supabase
      .from('ratings')
      .select('id, comment, created_at')
      .eq('stars', 5)
      .not('comment', 'is', null)
      .neq('comment', '')
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setReviews(data as Review[]) })
  }, [refresh])

  if (reviews.length === 0) return null

  const prev = () => setIdx(i => (i - 1 + reviews.length) % reviews.length)
  const next = () => setIdx(i => (i + 1) % reviews.length)
  const r = reviews[idx]

  return (
    <div className="reviews-carousel">
      <h3 className="reviews-title">★★★★★ What People Are Saying</h3>
      <div className="reviews-track">
        <button className="reviews-arrow" onClick={prev} aria-label="Previous">&#8592;</button>
        <div className="reviews-bubble">
          <p className="reviews-comment">"{r.comment}"</p>
          <span className="reviews-date">
            {new Date(r.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
        </div>
        <button className="reviews-arrow" onClick={next} aria-label="Next">&#8594;</button>
      </div>
      {reviews.length > 1 && (
        <div className="reviews-dots">
          {reviews.map((_, i) => (
            <button
              key={i}
              className={`reviews-dot${i === idx ? ' active' : ''}`}
              onClick={() => setIdx(i)}
              aria-label={`Review ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RatingSection() {
  const [refreshKey, setRefreshKey] = useState(0)
  return (
    <>
      <StarRating onDone={() => setRefreshKey(k => k + 1)} />
      <ReviewsCarousel refresh={refreshKey} />
    </>
  )
}

function InstagramIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.75l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.71a8.18 8.18 0 0 0 4.78 1.52V6.78a4.85 4.85 0 0 1-1.01-.09z"/>
    </svg>
  )
}

function YoutubeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.54C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
      <polygon fill="white" points="9.75,15.02 15.5,12 9.75,8.98 9.75,15.02"/>
    </svg>
  )
}

const QUOTES = [
  { text: "The water is your friend. You don't have to fight with water, just share the same spirit as the water, and it will help you move.", author: "Aleksandr Popov" },
  { text: "I don't do it for the medals. I do it because I love it.", author: "Katie Ledecky" },
  { text: "You can't put a limit on anything. The more you dream, the farther you get.", author: "Michael Phelps" },
  { text: "Gold medals aren't really made of gold. They're made of sweat, determination, and a hard-to-find alloy called guts.", author: "Dan Gable" },
  { text: "Swimming is normal for me. I'm relaxed. I'm comfortable, and I know my surroundings.", author: "Michael Phelps" },
  { text: "The more I practice, the luckier I get.", author: "Gary Player" },
  { text: "You have to expect things of yourself before you can do them.", author: "Michael Jordan" },
  { text: "I try to beat myself every time I get in the water. Whatever I did in my last race, I try to do better.", author: "Katie Ledecky" },
  { text: "There may be people that have more talent than you, but there's no excuse for anyone to work harder than you do.", author: "Derek Jeter" },
  { text: "Champions keep playing until they get it right.", author: "Billie Jean King" },
  { text: "Persistence can change failure into extraordinary achievement.", author: "Matt Biondi" },
  { text: "The secret to success is to start before you are ready.", author: "Marie Forleo" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "You can't win unless you learn how to lose.", author: "Kareem Abdul-Jabbar" },
  { text: "Every morning in Africa, a gazelle wakes up, and it knows it must run faster than the fastest lion or it will be killed. Every morning a lion wakes up and it knows it must run faster than the slowest gazelle or it will starve to death. It doesn't matter whether you are a lion or a gazelle. When the sun comes up, you better be running.", author: "Unknown" },
  { text: "Do you know what my favorite part of the game is? The opportunity to play.", author: "Mike Singletary" },
  { text: "I've failed over and over again in my life, and that is why I succeed.", author: "Michael Jordan" },
  { text: "Believe me, the reward is not so great without the struggle.", author: "Wilma Rudolph" },
  { text: "It's not the will to win that matters — everyone has that. It's the will to prepare to win that matters.", author: "Paul 'Bear' Bryant" },
  { text: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
]

function QuotesCarousel() {
  const [idx, setIdx] = useState(0)
  const prev = () => setIdx(i => (i - 1 + QUOTES.length) % QUOTES.length)
  const next = () => setIdx(i => (i + 1) % QUOTES.length)
  const q = QUOTES[idx]
  return (
    <section className="quotes-section">
      <h2 className="quotes-heading" data-reveal>Fuel for the Pool</h2>
      <div className="quotes-carousel">
        <button className="quotes-arrow" onClick={prev} aria-label="Previous quote">&#8592;</button>
        <div className="quotes-card">
          <span className="quotes-mark">&ldquo;</span>
          <p className="quotes-text">{q.text}</p>
          <p className="quotes-author">— {q.author}</p>
          <div className="quotes-dots">
            {QUOTES.map((_, i) => (
              <button
                key={i}
                className={`quotes-dot${i === idx ? ' active' : ''}`}
                onClick={() => setIdx(i)}
                aria-label={`Go to quote ${i + 1}`}
              />
            ))}
          </div>
        </div>
        <button className="quotes-arrow" onClick={next} aria-label="Next quote">&#8594;</button>
      </div>
    </section>
  )
}

function WaveDivider({ flip = false, fill = '#ffffff' }: { flip?: boolean; fill?: string }) {
  return (
    <div className="wave-divider" style={{ transform: flip ? 'scaleY(-1)' : undefined }}>
      <svg viewBox="0 0 1440 72" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 32 C240 72 480 0 720 36 C960 72 1200 8 1440 40 L1440 72 L0 72 Z" fill={fill}/>
      </svg>
    </div>
  )
}

function App() {
  const navigate = useNavigate()
  const [creatorTab, setCreatorTab] = useState<'caleb' | 'mason'>('caleb')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12 },
    )
    document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="page">
      {/* ── Navbar ── */}
      <header className="navbar">
        <div className="nav-brand">
          <img src="/logo.svg" alt="SwimSCPlan brand mark with a stylized wave and the text SwimSCPlan" className="nav-logo-img" />
          <span className="nav-logo">SwimSCPlan</span>
        </div>
        <div className="nav-actions">
          <button className="btn-secondary" onClick={() => navigate('/sign-in')}>Sign In</button>
          <button className="btn-primary" onClick={() => navigate('/create-account')}>Create Account</button>
        </div>
      </header>

      {/* ── Hero / Inspiration ── */}
      <section className="hero">
        <div className="hero-text">
          <h1>Train Smarter.<br />Swim Faster.</h1>
          <p className="hero-sub">
            The planning tool built for swimmers who are serious about the sport.
          </p>
        </div>
        <div className="hero-visual">
          <img src="/Hero.jpg" alt="Swimmer in pool" className="hero-img" />
        </div>
      </section>
      <WaveDivider fill="#f0f7ff" />

      {/* ── Purpose Section ── */}
      <section className="purpose">
        <h2 data-reveal>What is SwimSCPlan?</h2>
        <ul className="purpose-list">
          <li data-reveal data-reveal-delay="1">Compare every event time against SCS national and championship qualifying cuts — color-coded so you know exactly how close you are</li>
          <li data-reveal data-reveal-delay="2">Import your times directly from USA Swimming or Swimcloud and have them populate your dashboard, progress history, and event analysis automatically</li>
          <li data-reveal data-reveal-delay="3">Plan which events to enter at any meet — paste the schedule, see a ranked recommendation for each event based on your times and how recently they were swum</li>
          <li data-reveal data-reveal-delay="4">Track goals, log splits, visualize progress over time, and keep everything in one place instead of scattered across spreadsheets and PDF cut sheets</li>
        </ul>
      </section>
      <WaveDivider flip fill="#0f172a" />

      {/* ── Features ── */}
      <section className="features">
        <h2 data-reveal>Everything you need in one place</h2>
        <div className="features-grid">
          <div className="feature-card" data-reveal data-reveal-delay="1">
            <div className="feature-img-placeholder">
              <img src="/swimmer.svg" alt="" className="feature-svg" />
            </div>
            <h3 className="feature-title">Compare Times</h3>
            <p className="feature-blurb">
              Line up your personal bests against SCS qualifying standards for every event and course.
              Five color tiers show exactly how close you are — from "Meets Cut" to "Needs Work" —
              plus inline split logging for each event.
            </p>
          </div>

          <div className="feature-card" data-reveal data-reveal-delay="2">
            <div className="feature-img-placeholder feature-img-placeholder--pool">
              <svg viewBox="0 0 80 56" className="feature-svg-inline"><rect x="4" y="4" width="72" height="48" rx="4" fill="none" stroke="#00b4d8" strokeWidth="3"/><line x1="4" y1="20" x2="76" y2="20" stroke="#1e3a8a" strokeWidth="1.5" strokeDasharray="4 3"/><line x1="4" y1="36" x2="76" y2="36" stroke="#1e3a8a" strokeWidth="1.5" strokeDasharray="4 3"/><path d="M4 48 Q20 42 36 48 Q52 54 68 48 Q72 46 76 48" stroke="#00b4d8" strokeWidth="2.5" fill="none"/><circle cx="22" cy="14" r="5" fill="#1e3a8a"/><path d="M26 14 C32 8 48 6 56 12" stroke="#1e3a8a" strokeWidth="3.5" fill="none" strokeLinecap="round"/></svg>
            </div>
            <h3 className="feature-title">Qualifications View</h3>
            <p className="feature-blurb">
              See which SCS championship meets (WAG, JAG, Elite Ch, SAG) you currently qualify for
              across every event side by side. Summary cards count how many cuts you've hit per meet.
            </p>
          </div>

          <div className="feature-card" data-reveal data-reveal-delay="3">
            <div className="feature-img-placeholder feature-img-placeholder--pool">
              <svg viewBox="0 0 80 56" className="feature-svg-inline"><polyline points="8,44 24,32 38,36 52,20 68,12" stroke="#00b4d8" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8" cy="44" r="3" fill="#1e3a8a"/><circle cx="24" cy="32" r="3" fill="#1e3a8a"/><circle cx="38" cy="36" r="3" fill="#1e3a8a"/><circle cx="52" cy="20" r="3" fill="#1e3a8a"/><circle cx="68" cy="12" r="3.5" fill="#00b4d8"/><line x1="8" y1="48" x2="72" y2="48" stroke="#334155" strokeWidth="1.5"/><line x1="8" y1="8" x2="8" y2="48" stroke="#334155" strokeWidth="1.5"/></svg>
            </div>
            <h3 className="feature-title">Progress Tracker</h3>
            <p className="feature-blurb">
              Watch your times drop with an SVG line chart for each event. Add entries manually or
              import from USA Swimming to auto-populate history. See your best time, total improvement,
              and number of swims logged.
            </p>
          </div>

          <div className="feature-card" data-reveal data-reveal-delay="1">
            <div className="feature-img-placeholder feature-img-placeholder--pool">
              <svg viewBox="0 0 80 56" className="feature-svg-inline"><rect x="18" y="6" width="44" height="34" rx="4" fill="none" stroke="#1e3a8a" strokeWidth="2.5"/><line x1="26" y1="16" x2="54" y2="16" stroke="#00b4d8" strokeWidth="2"/><line x1="26" y1="24" x2="54" y2="24" stroke="#00b4d8" strokeWidth="2"/><line x1="26" y1="32" x2="42" y2="32" stroke="#00b4d8" strokeWidth="2"/><line x1="40" y1="40" x2="40" y2="52" stroke="#1e3a8a" strokeWidth="2.5"/><polyline points="33,46 40,54 47,46" stroke="#1e3a8a" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h3 className="feature-title">Import Times</h3>
            <p className="feature-blurb">
              Copy your times from USA Swimming or Swimcloud and paste them in.
              The parser pulls out events, courses, and times automatically — no formatting needed.
              Saves to your dashboard and progress history in one click.
            </p>
          </div>

          <div className="feature-card" data-reveal data-reveal-delay="2">
            <div className="feature-img-placeholder feature-img-placeholder--pool">
              <svg viewBox="0 0 80 56" className="feature-svg-inline"><rect x="10" y="8" width="60" height="42" rx="5" fill="none" stroke="#1e3a8a" strokeWidth="2.5"/><line x1="10" y1="20" x2="70" y2="20" stroke="#1e3a8a" strokeWidth="2"/><line x1="26" y1="8" x2="26" y2="20" stroke="#1e3a8a" strokeWidth="2"/><line x1="54" y1="8" x2="54" y2="20" stroke="#1e3a8a" strokeWidth="2"/><circle cx="28" cy="34" r="4" fill="#00b4d8"/><circle cx="44" cy="34" r="4" fill="#1e3a8a" opacity="0.3"/><circle cx="60" cy="34" r="4" fill="#1e3a8a" opacity="0.3"/></svg>
            </div>
            <h3 className="feature-title">Event Planning</h3>
            <p className="feature-blurb">
              Paste a meet schedule and instantly see which events to enter. Each event gets
              an Enter / Consider / Skip recommendation based on your proximity to the standard
              and how recently the time was swum. Includes entry deadline countdown.
            </p>
          </div>

          <div className="feature-card" data-reveal data-reveal-delay="3">
            <div className="feature-img-placeholder feature-img-placeholder--pool">
              <svg viewBox="0 0 80 56" className="feature-svg-inline"><circle cx="40" cy="28" r="22" fill="none" stroke="#1e3a8a" strokeWidth="2.5"/><circle cx="40" cy="28" r="15" fill="none" stroke="#1e3a8a" strokeWidth="2"/><circle cx="40" cy="28" r="8" fill="none" stroke="#00b4d8" strokeWidth="2"/><circle cx="40" cy="28" r="3" fill="#00b4d8"/><line x1="40" y1="4" x2="40" y2="10" stroke="#1e3a8a" strokeWidth="2"/><line x1="40" y1="46" x2="40" y2="52" stroke="#1e3a8a" strokeWidth="2"/><line x1="16" y1="28" x2="22" y2="28" stroke="#1e3a8a" strokeWidth="2"/><line x1="58" y1="28" x2="64" y2="28" stroke="#1e3a8a" strokeWidth="2"/></svg>
            </div>
            <h3 className="feature-title">Goals</h3>
            <p className="feature-blurb">
              Set target times for specific events and courses with optional deadlines.
              Goals appear alongside your best times across the app so you always know
              what you're chasing and how close you are.
            </p>
          </div>

          <div className="feature-card" data-reveal data-reveal-delay="1">
            <div className="feature-img-placeholder feature-img-placeholder--pool">
              <svg viewBox="0 0 80 56" className="feature-svg-inline"><rect x="28" y="4" width="24" height="42" rx="4" fill="none" stroke="#1e3a8a" strokeWidth="2.5"/><line x1="28" y1="38" x2="52" y2="38" stroke="#1e3a8a" strokeWidth="2"/><circle cx="40" cy="43" r="2" fill="#00b4d8"/><line x1="33" y1="14" x2="47" y2="14" stroke="#00b4d8" strokeWidth="2" strokeLinecap="round"/><line x1="33" y1="20" x2="47" y2="20" stroke="#00b4d8" strokeWidth="2" strokeLinecap="round"/><line x1="33" y1="26" x2="42" y2="26" stroke="#00b4d8" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <h3 className="feature-title">Mobile Friendly</h3>
            <p className="feature-blurb">
              Built to work on any device. The dashboard, time tables, qualifications view,
              and event planner all adapt to your phone screen — with a bottom navigation bar
              so everything is one tap away at a meet.
            </p>
          </div>
        </div>
      </section>

      <WaveDivider fill="#f0f7ff" />

      {/* ── About / Inspiration ── */}
      <section className="about">
        <div className="about-inner">
          <div className="about-text">
            <span className="about-badge" data-reveal>Our Story</span>
            <h2 data-reveal data-reveal-delay="1">Built by a swimmer,<br />for swimmers.</h2>
            <p className="about-body" data-reveal data-reveal-delay="2">
              SwimSCPlan was created out of frustration with scattered spreadsheets and PDF
              standards sheets. I wanted one place that knew my times, knew the SCS cuts, and
              told me exactly where I stood — without digging through documents before every meet.
            </p>
            <p className="about-inspiration" data-reveal data-reveal-delay="3">
              The inspiration? Every swimmer deserves a clear goal to chase and real data to
              back it up — not just a gut feeling. Whether you're chasing your first WAG cut or
              shaving tenths off your 50 fly, you should always know how close you are.
            </p>
          </div>
          <div className="about-quote-col" data-reveal data-reveal-delay="2">
            <blockquote className="about-quote">
              "You can't improve what you don't measure. Start tracking, start dropping time."
            </blockquote>
            <div className="about-stats">
              <div className="about-stat">
                <span className="about-stat-num">5</span>
                <span className="about-stat-label">Age groups</span>
              </div>
              <div className="about-stat">
                <span className="about-stat-num">3</span>
                <span className="about-stat-label">Course types</span>
              </div>
              <div className="about-stat">
                <span className="about-stat-num">9+</span>
                <span className="about-stat-label">Standards tracked</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <WaveDivider flip fill="#0f172a" />

      {/* ── Quotes Carousel ── */}
      <QuotesCarousel />

      {/* ── Meet the Creators ── */}
      <section className="creators">
        <h2 className="creators-heading" data-reveal>Meet the People Behind SwimSCPlan</h2>

        <div className="creators-tabs" data-reveal data-reveal-delay="1">
          <button
            className={`creators-tab${creatorTab === 'caleb' ? ' active' : ''}`}
            onClick={() => setCreatorTab('caleb')}
          >
            Caleb Pang &mdash; Creator
          </button>
          <button
            className={`creators-tab${creatorTab === 'mason' ? ' active' : ''}`}
            onClick={() => setCreatorTab('mason')}
          >
            Mason Jung &mdash; Helper
          </button>
        </div>

        <div className="creators-card" data-reveal data-reveal-delay="2">
          <div className="creators-photo-wrap">
            <img
              src={creatorTab === 'caleb' ? '/photos/IMG_4189.jpeg' : '/photos/IMG_0942.jpeg'}
              alt={creatorTab === 'caleb' ? 'Caleb Pang' : 'Mason Jung'}
              className={`creators-photo${creatorTab === 'caleb' ? ' creators-photo--caleb' : ' creators-photo--mason'}`}
              onError={e => {
                const img = e.currentTarget as HTMLImageElement
                img.style.display = 'none'
                const fallback = img.nextElementSibling as HTMLElement
                if (fallback) fallback.style.display = 'flex'
              }}
            />
            <div className="creators-photo-placeholder" style={{ display: 'none' }}>
              {creatorTab === 'caleb' ? 'CP' : 'MJ'}
            </div>
          </div>
          <div className="creators-info">
            <h3 className="creators-name">
              {creatorTab === 'caleb' ? 'Caleb Pang' : 'Mason Jung'}
              <span className="creators-role">
                {creatorTab === 'caleb' ? 'Creator' : 'Helper'}
              </span>
            </h3>
            {creatorTab === 'caleb' ? (
              <p className="creators-bio">
                My name is Caleb Pang and I am 14 years old as a freshman in Troy High School.
                I swim for FAST which is a club based in Fullerton and I have been swimming for
                2–3 years at this point. I was born in Maryland but moved to Southern California
                when I was young. For those 2–3 years, I had loved the sport of swimming and even
                when I had to wake up early in the morning, I always ended up enjoying practice.
              </p>
            ) : (
              <p className="creators-bio">
                My name is Mason Jung and I helped create this website as my friend, Caleb, encouraged
                me to solve some problems he had faced while making this website. I am 15 as a freshman
                in Sunny Hills High School and even though I have never tried swimming as a sport,
                I still played tennis and love to bike.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Star Rating + Reviews ── */}
      <RatingSection />

      {/* ── Connect / Socials ── */}
      <section className="connect">
        <div className="connect-inner">
          <h2 data-reveal>Connect</h2>
          <p className="connect-sub" data-reveal data-reveal-delay="1">
            Follow the journey and share your swimming progress.
          </p>
          <div className="connect-grid">
            {/* Replace href="#" with your actual social links */}
            <a href="#" className="connect-card" data-reveal data-reveal-delay="1">
              <span className="connect-icon"><InstagramIcon /></span>
              <span className="connect-platform">Instagram</span>
              <span className="connect-handle">@your_handle</span>
            </a>
            <a href="#" className="connect-card" data-reveal data-reveal-delay="2">
              <span className="connect-icon"><XIcon /></span>
              <span className="connect-platform">X (Twitter)</span>
              <span className="connect-handle">@your_handle</span>
            </a>
            <a href="#" className="connect-card" data-reveal data-reveal-delay="3">
              <span className="connect-icon"><TikTokIcon /></span>
              <span className="connect-platform">TikTok</span>
              <span className="connect-handle">@your_handle</span>
            </a>
            <a href="#" className="connect-card" data-reveal data-reveal-delay="4">
              <span className="connect-icon"><YoutubeIcon /></span>
              <span className="connect-platform">YouTube</span>
              <span className="connect-handle">your channel</span>
            </a>
          </div>
        </div>
      </section>

      {/* ── Call to Action ── */}
      <section className="cta">
        <img src="/logo.svg" alt="SwimSCPlan brand mark with stylized wave and the text SwimSCPlan" className="cta-logo" data-reveal />
        <h2 data-reveal data-reveal-delay="1">Ready to get started?</h2>
        <p data-reveal data-reveal-delay="2">Create a free account and take control of your training.</p>
        <button className="btn-primary btn-large" data-reveal data-reveal-delay="3" onClick={() => navigate('/create-account')}>Create Account</button>
      </section>

      <footer className="footer">
        <img src="/logo.svg" alt="SwimSCPlan brand mark with stylized wave and the text SwimSCPlan" className="footer-logo" />
        <span>© 2026 SwimSCPlan</span>
      </footer>
    </div>
  )
}

export default App
