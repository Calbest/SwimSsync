import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
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
    if (error) {
      console.error('Rating submit error:', error.message, error.code, error.details)
    }
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

  useEffect(() => {
    supabase
      .from('ratings')
      .select('id, comment, created_at')
      .eq('stars', 5)
      .not('comment', 'is', null)
      .neq('comment', '')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          const filtered = (data as Review[]).filter(r => r.comment && r.comment.length > 25)
          setReviews(filtered)
        }
      })
  }, [refresh])

  if (reviews.length === 0) return null

  return (
    <div className="reviews-section">
      <h3 className="reviews-title">What People Are Saying</h3>
      <div className="reviews-scroll">
        {reviews.map(r => (
          <div key={r.id} className="reviews-card">
            <div className="reviews-card-stars">★★★★★</div>
            <p className="reviews-comment">"{r.comment}"</p>
            <span className="reviews-date">
              {new Date(r.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
          </div>
        ))}
      </div>
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
    <motion.section
      className="quotes-section"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: easeOut }}
    >
      <h2 className="quotes-heading">Fuel for the Pool</h2>
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
    </motion.section>
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

const NAV_SECTIONS = [
  { label: 'Home', id: 'hero' },
  { label: 'What', id: 'what' },
  { label: 'Features', id: 'features' },
  { label: 'Our Story', id: 'about' },
  { label: 'Team', id: 'creators' },
]

const scrollTo = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

const easeOut = [0.22, 1, 0.36, 1] as const

// Reusable motion variants
const fadeUp = {
  initial: { opacity: 0, y: 36 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' as const },
  transition: { duration: 0.7, ease: easeOut },
}

const fadeUpDelayed = (delay: number) => ({
  initial: { opacity: 0, y: 36 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' as const },
  transition: { duration: 0.7, ease: easeOut, delay },
})

const fadeLeft = {
  initial: { opacity: 0, x: -40 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: '-80px' as const },
  transition: { duration: 0.7, ease: easeOut },
}

const fadeRight = {
  initial: { opacity: 0, x: 40 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, margin: '-80px' as const },
  transition: { duration: 0.7, ease: easeOut },
}

const staggerContainer = {
  initial: {},
  whileInView: {},
  viewport: { once: true, margin: '-60px' as const },
}

const staggerItem = (delay: number) => ({
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' as const },
  transition: { duration: 0.6, ease: easeOut, delay },
})

function App() {
  const navigate = useNavigate()
  const [creatorTab, setCreatorTab] = useState<'caleb' | 'mason'>('caleb')

  return (
    <div className="page">
      {/* ── Navbar ── */}
      <header className="navbar">
        <div className="nav-left">
          <div className="nav-brand">
            <img src="/logo.svg" alt="SwimSCPlan brand mark with a stylized wave and the text SwimSCPlan" className="nav-logo-img" />
            <span className="nav-logo">SwimSCPlan</span>
          </div>
          <nav className="nav-links">
            {NAV_SECTIONS.map(s => (
              <button key={s.id} className="nav-link" onClick={() => scrollTo(s.id)}>
                {s.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="nav-actions">
          <button className="btn-secondary" onClick={() => navigate('/sign-in')}>Sign In</button>
          <button className="btn-primary" onClick={() => navigate('/create-account')}>Create Account</button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section id="hero" className="hero">
        <div className="hero-text">
          <h1 className="hero-heading">
            Train Smarter.<br />
            <span className="hero-heading-highlight">Swim Faster.</span>
          </h1>
          <p className="hero-sub">
            The planning tool built for swimmers who are serious about the sport.
            Track your times, compare against qualifying cuts, and know exactly where you stand.
          </p>
          <div className="hero-cta-row">
            <button className="btn-primary" onClick={() => navigate('/create-account')}>Get Started Free</button>
            <button className="btn-secondary" onClick={() => scrollTo('features')}>See How It Works</button>
          </div>
        </div>
        <div className="hero-visual">
          <img src="/Hero.jpg" alt="Swimmer in pool" className="hero-img" />
        </div>
      </section>
      <WaveDivider fill="#f0f7ff" />

      {/* ── Purpose Section ── */}
      <section id="what" className="purpose">
        <motion.h2 {...fadeUp}>What is SwimSCPlan?</motion.h2>
        <motion.ul className="purpose-list" {...staggerContainer}>
          {[
            'Compare every event time against SCS national and championship qualifying cuts — color-coded so you know exactly how close you are',
            'Import your times directly from USA Swimming or Swimcloud and have them populate your dashboard, progress history, and event analysis automatically',
            'Plan which events to enter at any meet — paste the schedule, see a ranked recommendation for each event based on your times and how recently they were swum',
            'Track goals, log splits, visualize progress over time, and keep everything in one place instead of scattered across spreadsheets and PDF cut sheets',
          ].map((text, i) => (
            <motion.li key={i} {...staggerItem(i * 0.1)}>{text}</motion.li>
          ))}
        </motion.ul>
      </section>
      <WaveDivider flip fill="#0f172a" />

      {/* ── Features ── */}
      <section id="features" className="features">
        <motion.h2 {...fadeUp}>Everything you need in one place</motion.h2>
        <motion.div className="features-grid" {...staggerContainer}>
          {[
            { title: 'Compare Times', blurb: 'Line up your personal bests against SCS qualifying standards for every event and course. Five color tiers show exactly how close you are — from "Meets Cut" to "Needs Work" — plus inline split logging for each event.', svg: '/swimmer.svg' },
            { title: 'Qualifications View', blurb: 'See which SCS championship meets (WAG, JAG, Elite Ch, SAG) you currently qualify for across every event side by side. Summary cards count how many cuts you\'ve hit per meet.' },
            { title: 'Progress Tracker', blurb: 'Watch your times drop with an SVG line chart for each event. Add entries manually or import from USA Swimming to auto-populate history. See your best time, total improvement, and number of swims logged.' },
            { title: 'Import Times', blurb: 'Copy your times from USA Swimming or Swimcloud and paste them in. The parser pulls out events, courses, and times automatically — no formatting needed. Saves to your dashboard and progress history in one click.' },
            { title: 'Event Planning', blurb: 'Paste a meet schedule and instantly see which events to enter. Each event gets an Enter / Consider / Skip recommendation based on your proximity to the standard and how recently the time was swum. Includes entry deadline countdown.' },
            { title: 'Goals', blurb: 'Set target times for specific events and courses with optional deadlines. Goals appear alongside your best times across the app so you always know what you\'re chasing and how close you are.' },
            { title: 'Mobile Friendly', blurb: 'Built to work on any device. The dashboard, time tables, qualifications view, and event planner all adapt to your phone screen — with a bottom navigation bar so everything is one tap away at a meet.' },
          ].map((card, i) => (
            <motion.div key={card.title} className="feature-card" {...staggerItem(i * 0.08)}>
              <div className="feature-img-placeholder">
                {card.svg ? (
                  <img src={card.svg} alt="" className="feature-svg" />
                ) : (
                  <svg viewBox="0 0 80 56" className="feature-svg-inline"><rect x="4" y="4" width="72" height="48" rx="4" fill="none" stroke="#00b4d8" strokeWidth="3"/><line x1="4" y1="20" x2="76" y2="20" stroke="#1e3a8a" strokeWidth="1.5" strokeDasharray="4 3"/><line x1="4" y1="36" x2="76" y2="36" stroke="#1e3a8a" strokeWidth="1.5" strokeDasharray="4 3"/><path d="M4 48 Q20 42 36 48 Q52 54 68 48 Q72 46 76 48" stroke="#00b4d8" strokeWidth="2.5" fill="none"/><circle cx="22" cy="14" r="5" fill="#1e3a8a"/><path d="M26 14 C32 8 48 6 56 12" stroke="#1e3a8a" strokeWidth="3.5" fill="none" strokeLinecap="round"/></svg>
                )}
              </div>
              <h3 className="feature-title">{card.title}</h3>
              <p className="feature-blurb">{card.blurb}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <WaveDivider fill="#f0f7ff" />

      {/* ── About / Inspiration ── */}
      <section id="about" className="about">
        <div className="about-inner">
          <motion.div className="about-text" {...fadeLeft}>
            <span className="about-badge">Our Story</span>
            <h2>Built by a swimmer,<br />for swimmers.</h2>
            <p className="about-body">
              SwimSCPlan was created out of frustration with scattered spreadsheets and PDF
              standards sheets. I wanted one place that knew my times, knew the SCS cuts, and
              told me exactly where I stood — without digging through documents before every meet.
            </p>
            <p className="about-inspiration">
              The inspiration? Every swimmer deserves a clear goal to chase and real data to
              back it up — not just a gut feeling. Whether you're chasing your first WAG cut or
              shaving tenths off your 50 fly, you should always know how close you are.
            </p>
          </motion.div>
          <motion.div className="about-quote-col" {...fadeRight}>
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
          </motion.div>
        </div>
      </section>

      <WaveDivider flip fill="#0f172a" />

      {/* ── Quotes Carousel ── */}
      <QuotesCarousel />

      {/* ── Meet the Creators ── */}
      <section id="creators" className="creators">
        <motion.h2 className="creators-heading" {...fadeUp}>Meet the People Behind SwimSCPlan</motion.h2>

        <motion.div className="creators-tabs" {...fadeUpDelayed(0.1)}>
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
        </motion.div>

        <motion.div className="creators-card" {...fadeUpDelayed(0.2)}>
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
        </motion.div>
      </section>

      {/* ── Star Rating + Reviews ── */}
      <RatingSection />

      {/* ── Connect / Socials ── */}
      <section className="connect">
        <div className="connect-inner">
          <motion.h2 {...fadeUp}>Connect</motion.h2>
          <motion.p className="connect-sub" {...fadeUpDelayed(0.1)}>
            Follow the journey and share your swimming progress.
          </motion.p>
          <motion.div className="connect-grid" {...staggerContainer}>
            {[
              { icon: <InstagramIcon />, platform: 'Instagram', handle: '@your_handle' },
              { icon: <XIcon />, platform: 'X (Twitter)', handle: '@your_handle' },
              { icon: <TikTokIcon />, platform: 'TikTok', handle: '@your_handle' },
              { icon: <YoutubeIcon />, platform: 'YouTube', handle: 'your channel' },
            ].map((link, i) => (
              <motion.a key={link.platform} href="#" className="connect-card" {...staggerItem(i * 0.1)}>
                <span className="connect-icon">{link.icon}</span>
                <span className="connect-platform">{link.platform}</span>
                <span className="connect-handle">{link.handle}</span>
              </motion.a>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Call to Action ── */}
      <section id="cta" className="cta">
        <motion.img src="/logo.svg" alt="SwimSCPlan brand mark with stylized wave and the text SwimSCPlan" className="cta-logo" {...fadeUp} />
        <motion.h2 {...fadeUpDelayed(0.1)}>Ready to get started?</motion.h2>
        <motion.p {...fadeUpDelayed(0.2)}>Create a free account and take control of your training.</motion.p>
        <motion.button
          className="btn-primary btn-large cta-pulse"
          {...fadeUpDelayed(0.3)}
          onClick={() => navigate('/create-account')}
        >
          Create Account
        </motion.button>
        <motion.p className="cta-trust" {...fadeUpDelayed(0.4)}>No credit card required. Free forever.</motion.p>
      </section>

      <footer className="footer">
        <img src="/logo.svg" alt="SwimSCPlan brand mark with stylized wave and the text SwimSCPlan" className="footer-logo" />
        <span>© 2026 SwimSCPlan</span>
      </footer>
    </div>
  )
}

export default App