import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { Search, Loader } from 'lucide-react'
import { supabase } from './lib/supabase'
import { searchProfiles } from './lib/friends'
import type { Profile as SwimmerProfile } from './lib/friends'
import compareTimesImg from './Assets/CompareTimes.png'
import trackProgressImg from './Assets/TrackProgress.png'
import planEventsImg from './Assets/PlanEvents.png'
import bentoCompareImg from './Assets/CompareTimes.png'
import bentoQualImg from './Assets/Qualifications.png'
import bentoGoalsImg from './Assets/Goals.png'
import bentoImprovImg from './Assets/See your improvement.png'
import bentoEventImg from './Assets/Event Planning.png'
import './App.css'

// ── Star Rating ───────────────────────────────────────────────────────────────

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
    if (error) console.error('Rating submit error:', error.message)
    setStatus(error ? 'error' : 'done')
    if (!error) onDone?.()
  }

  if (status === 'done') {
    return (
      <section className="rating-section">
        <div className="rating-card">
          <div className="rating-thanks-icon">★</div>
          <h3 className="rating-thanks-title">Thanks for the feedback!</h3>
          <p className="rating-thanks-sub">Your rating helps us improve PaceBook.</p>
        </div>
      </section>
    )
  }

  const display = hovered || selected
  return (
    <section className="rating-section">
      <div className="rating-card">
        <h2 className="rating-heading">Rate PaceBook</h2>
        <p className="rating-sub">How useful has this app been for your swimming?</p>
        <div className="rating-stars" onMouseLeave={() => setHovered(0)}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              className={`rating-star${n <= display ? ' filled' : ''}`}
              onMouseEnter={() => setHovered(n)}
              onClick={() => setSelected(n)}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
            >★</button>
          ))}
        </div>
        {selected > 0 && <p className="rating-label">{['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][selected]}</p>}
        {selected > 0 && (
          <div className="rating-comment-wrap">
            <textarea
              className="rating-comment"
              placeholder="Any comments? (optional)"
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <span className="rating-char-count">{comment.length}/500</span>
          </div>
        )}
        <button className="rating-submit" onClick={submit} disabled={!selected || status === 'sending'}>
          {status === 'sending' ? 'Submitting…' : 'Submit Rating'}
        </button>
        {status === 'error' && <p className="rating-error">Something went wrong — please try again.</p>}
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
        if (data) setReviews((data as Review[]).filter(r => r.comment && r.comment.length > 25))
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

// ── Quotes ────────────────────────────────────────────────────────────────────

const QUOTES = [
  { text: "The water is your friend. Just share the same spirit as the water, and it will help you move.", author: "Aleksandr Popov" },
  { text: "You can't put a limit on anything. The more you dream, the farther you get.", author: "Michael Phelps" },
  { text: "I try to beat myself every time I get in the water. Whatever I did in my last race, I try to do better.", author: "Katie Ledecky" },
  { text: "Persistence can change failure into extraordinary achievement.", author: "Matt Biondi" },
  { text: "Champions keep playing until they get it right.", author: "Billie Jean King" },
]

const easeOut = [0.22, 1, 0.36, 1] as const

function QuotesCarousel() {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setIdx(i => (i + 1) % QUOTES.length), 2500)
    return () => clearInterval(t)
  }, [paused])

  const q = QUOTES[idx]

  return (
    <motion.section
      className="quotes-section"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: easeOut }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="quotes-rays" aria-hidden="true">
        {[14, 30, 50, 68, 84].map((left, i) => (
          <div key={i} className="quotes-ray" style={{ left: `${left}%`, animationDelay: `${i * 1.1}s` }} />
        ))}
      </div>

      <p className="quotes-eyebrow">Fuel for the Pool</p>

      <div className="quotes-inner">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            className="quotes-quote"
            initial={{ opacity: 0, y: 22, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.97 }}
            transition={{ duration: 0.65, ease: easeOut }}
          >
            <div className="quotes-mark-large" aria-hidden="true">&ldquo;</div>
            <p className="quotes-text-large">{q.text}</p>
            <p className="quotes-author-large">— {q.author}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="quotes-progress" role="tablist" aria-label="Quote navigation">
        {QUOTES.map((_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === idx}
            className={`quotes-pip${i === idx ? ' active' : ''}`}
            onClick={() => setIdx(i)}
            aria-label={`Quote ${i + 1}`}
          />
        ))}
      </div>
    </motion.section>
  )
}

// ── Motion variants ───────────────────────────────────────────────────────────

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

// Directional slide-in per bento card: left cards from left, right cards from right
const BENTO_DIRS: [number, number][] = [
  [-80, 10],  // Compare Times        — big left card, slides in from left
  [ 80, -10], // Qualifications       — right column, from right
  [ 80,   0], // Goals                — right column, from right
  [-70,   0], // Store & Share Media  — left cell, from left
  [  0,  50], // Event Planning       — center cell, rises from below
]

const bentoVariant = (i: number) => {
  const [dx, dy] = BENTO_DIRS[i] ?? [0, 40]
  return {
    initial: { opacity: 0, x: dx, y: dy, scale: 0.93 },
    whileInView: { opacity: 1, x: 0, y: 0, scale: 1 },
    viewport: { once: true, margin: '-50px' as const },
    transition: { type: 'spring' as const, stiffness: 65, damping: 16, delay: i * 0.07 },
  }
}

// ── Static particle positions (no Math.random in render) ──────────────────────

const PARTICLES = [
  { left: '7%',  top: '15%', delay: '0s',    dur: '5s'   },
  { left: '19%', top: '72%', delay: '0.8s',  dur: '4.2s' },
  { left: '34%', top: '38%', delay: '1.6s',  dur: '6s'   },
  { left: '48%', top: '82%', delay: '0.3s',  dur: '3.8s' },
  { left: '62%', top: '25%', delay: '2.1s',  dur: '5.5s' },
  { left: '75%', top: '58%', delay: '0.9s',  dur: '4.7s' },
  { left: '88%', top: '40%', delay: '1.4s',  dur: '6.2s' },
  { left: '13%', top: '50%', delay: '2.5s',  dur: '4s'   },
  { left: '55%', top: '10%', delay: '0.6s',  dur: '5.8s' },
  { left: '42%', top: '65%', delay: '1.9s',  dur: '3.5s' },
  { left: '81%', top: '78%', delay: '1.1s',  dur: '4.9s' },
  { left: '29%', top: '90%', delay: '3s',    dur: '5.3s' },
]

const RAY_LEFTS = [12, 26, 40, 55, 69, 84]

// ── Features data ─────────────────────────────────────────────────────────────

const FEATURES: { title: string; blurb: string; spanClass?: string; img: string }[] = [
  {
    title: 'Compare Times',
    blurb: 'Line up your times against SCS qualifying standards. Five color tiers show exactly where you stand, with inline split logging per event.',
    spanClass: 'bento-span-tall',
    img: bentoCompareImg,
  },
  {
    title: 'Qualifications View',
    blurb: 'See which meets (WAG, JAG, Elite Ch, SAG) you qualify for across every event, side by side.',
    img: bentoQualImg,
  },
  {
    title: 'Goals',
    blurb: 'Set target times with optional deadlines. Goals appear next to your bests across the entire app.',
    spanClass: 'bento-span-rows-4',
    img: bentoGoalsImg,
  },
  {
    title: 'See Your Improvement',
    blurb: 'Track every event over time with a live progress chart. Watch your best times trend downward, compare splits across sessions, and visualize exactly how far you\'ve come.',
    spanClass: 'bento-span-rows',
    img: bentoImprovImg,
  },
  {
    title: 'Event Planning',
    blurb: 'Paste a meet schedule and instantly get Enter / Consider / Skip for every event. Includes an entry deadline countdown.',
    spanClass: 'bento-span-rows',
    img: bentoEventImg,
  },
]

const NAV_SECTIONS = [
  { label: 'Home',     id: 'hero',     customScroll: null as null | (() => void) },
  { label: 'Why',    id: 'what',     customScroll: () => {
      const hero = document.getElementById('hero')
      if (hero) window.scrollTo({ top: hero.offsetTop + window.innerHeight * 1.3, behavior: 'smooth' })
    }
  },
  { label: 'Features', id: 'features', customScroll: null },
  { label: 'Our Story',id: 'about',    customScroll: null },
  { label: 'Team',     id: 'creators', customScroll: null },
]

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

// ── Search helpers ────────────────────────────────────────────────────────────

function initials(name: string | null, username: string) {
  const src = name || username
  return src.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function avatarBg(userId: string) {
  const palette = ['#0077b6','#0096c7','#00b4d8','#023e8a','#0369a1','#0891b2','#005f73']
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const navigate = useNavigate()
  const [creatorTab, setCreatorTab] = useState<'caleb' | 'mason'>('caleb')

  // ── Navbar swimmer search ──
  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<SwimmerProfile[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchOpen,    setSearchOpen]    = useState(false)
  const searchRef   = useRef<HTMLDivElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!searchQuery.trim()) { setSearchResults([]); setSearchLoading(false); return }
    setSearchLoading(true)
    searchTimer.current = setTimeout(async () => {
      const { data } = await searchProfiles(searchQuery.trim())
      setSearchResults((data ?? []) as SwimmerProfile[])
      setSearchLoading(false)
    }, 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [searchQuery])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setSearchOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])


  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end end'] })

  // UI content (text, badge, buttons) exits FIRST — fast upward sweep + immediate fade
  const heroContentOpacity = useTransform(scrollYProgress, [0.01, 0.08], [1, 0])
  const heroTextY          = useTransform(scrollYProgress, [0, 0.08], [0, -340])
  // After opacity reaches 0, also set visibility:hidden so GPU-promoted layers can't bleed through
  const heroContentVisibility = useTransform(scrollYProgress, v => v > 0.09 ? 'hidden' : 'visible')

  // Background image fades AFTER content is already gone — crossfades directly into scene 2
  const scene1Opacity = useTransform(scrollYProgress, [0.06, 0.17], [1, 0])
  const heroImgScale  = useTransform(scrollYProgress, [0, 0.17], [1, 1.12])

  // Scene 2 fades in quickly, overlapping the tail of scene1 so there is never a dark gap
  const scene2Opacity = useTransform(scrollYProgress, [0.12, 0.22], [0, 1])

  const hintOpacity = useTransform(scrollYProgress, [0, 0.03], [1, 0])

  // Underwater parallax
  const tilesY     = useTransform(scrollYProgress, [0.12, 0.90], [0, -60])
  const uwImgScale = useTransform(scrollYProgress, [0.18, 0.70], [0.88, 1.04])
  const uwLeftX    = useTransform(scrollYProgress, [0.18, 0.70], [32, -24])
  const uwRightX   = useTransform(scrollYProgress, [0.18, 0.70], [-32, 24])

  // Scroll-animated gradients for lower sections
  const aboutRef = useRef<HTMLElement>(null)
  const { scrollYProgress: aboutProgress } = useScroll({ target: aboutRef, offset: ['start end', 'end start'] })
  const aboutGlowX = useTransform(aboutProgress, [0, 1], ['-20%', '120%'])
  const aboutGlowY = useTransform(aboutProgress, [0, 1], ['120%', '-20%'])

  const quotesWrapRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress: quotesProgress } = useScroll({ target: quotesWrapRef, offset: ['start end', 'end start'] })
  const quotesGlowX = useTransform(quotesProgress, [0, 1], ['80%', '20%'])
  const quotesGlowY = useTransform(quotesProgress, [0, 1], ['20%', '80%'])

  return (
    <div className="page">

      {/* ── Navbar ── */}
      <header className="navbar">
        <div className="nav-left">
          <div className="nav-brand">
            <img src="/logo.svg" alt="PaceBook logo" className="nav-logo-img" />
            <span className="nav-logo">PaceBook</span>
          </div>
          <nav className="nav-links">
            {NAV_SECTIONS.map(s => (
              <button
                key={s.id}
                className="nav-link"
                onClick={() => s.customScroll ? s.customScroll() : scrollTo(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>

          {/* ── Swimmer search ── */}
          <div ref={searchRef} className={`nav-search${searchOpen ? ' nav-search--open' : ''}`}>
          <Search size={14} className="nav-search-icon" />
          <input
            className="nav-search-input"
            placeholder="Find a swimmer…"
            value={searchQuery}
            onFocus={() => setSearchOpen(true)}
            onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true) }}
            onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery('') } }}
          />
          {searchLoading && <Loader size={13} className="nav-search-spinner" />}

          {searchOpen && searchQuery.trim() && (
            <div className="nav-search-dropdown">
              {!searchLoading && searchResults.length === 0 && (
                <div className="nav-search-empty">No swimmers found for "{searchQuery}"</div>
              )}
              {searchResults.slice(0, 6).map(p => (
                <button
                  key={p.id}
                  className="nav-search-result"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    setSearchOpen(false)
                    setSearchQuery('')
                    navigate(`/profile/${p.id}`)
                  }}
                >
                  <div className="nav-search-avatar" style={{ background: avatarBg(p.id) }}>
                    {p.avatar_url
                      ? <img src={p.avatar_url} alt="" />
                      : <span>{initials(p.full_name, p.username)}</span>
                    }
                  </div>
                  <div className="nav-search-info">
                    <span className="nav-search-name">{p.full_name || p.username}</span>
                    <span className="nav-search-sub">
                      @{p.username}{p.club_team ? ` · ${p.club_team}` : ''}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          </div>
        </div>

        <div className="nav-actions">
          <button className="btn-secondary" onClick={() => navigate('/sign-in')}>Sign In</button>
          <button className="btn-primary"   onClick={() => navigate('/create-account')}>Create Account</button>
        </div>
      </header>

      {/* ── Pinned Scroll Journey (350 vh) ── */}
      <div ref={heroRef} id="hero" className="hero-scroll-container">
        <div className="sticky-scene-wrapper">

          {/* Scene 1 — Surface */}
          <motion.div className="scene" style={{ opacity: scene1Opacity }}>
            <motion.div
              className="scene-bg-img"
              style={{ backgroundImage: 'url(/Hero.jpg)', scale: heroImgScale }}
            />
            <div className="scene-overlay scene-overlay--surface" />
            <motion.div className="hero-content-centered" style={{ y: heroTextY, opacity: heroContentOpacity, visibility: heroContentVisibility }}>
              <motion.h1
                className="hero-title-new"
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.5, ease: easeOut }}
              >
                Plan Smarter.<br />
                <span className="hero-title-gradient">Swim Faster.</span>
              </motion.h1>
              <motion.p
                className="hero-subtitle-new"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.7, ease: easeOut }}
              >
                The planning tool built for swimmers who are serious about the sport.
                Track your times, compare against qualifying cuts, and know exactly where you stand.
              </motion.p>
              <motion.div
                className="hero-cta-row"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.9, ease: easeOut }}
              >
                <button className="btn-primary" onClick={() => navigate('/create-account')}>
                  Get Started Free
                </button>
                <button className="btn-ghost" onClick={() => scrollTo('features')}>
                  See How It Works →
                </button>
              </motion.div>
            </motion.div>
            <motion.div className="scroll-hint" style={{ opacity: hintOpacity }}>
              <span>Scroll to dive in</span>
              <div className="scroll-hint-bar" />
            </motion.div>
          </motion.div>

          {/* Scene 2 — Underwater */}
          <motion.div className="scene" style={{ opacity: scene2Opacity, pointerEvents: 'none' }}>
            <motion.div className="pool-tiles-bg" style={{ y: tilesY }} />
            {RAY_LEFTS.map((left, i) => (
              <div key={i} className={`light-ray lr-${i + 1}`} style={{ left: `${left}%` }} />
            ))}
            {PARTICLES.map((p, i) => (
              <div
                key={i}
                className="water-particle"
                style={{ left: p.left, top: p.top, animationDelay: p.delay, animationDuration: p.dur }}
              />
            ))}
            <div className="scene-overlay scene-overlay--underwater" />
            <div id="what" className="underwater-content">
              <h2 className="underwater-heading">Why Use PaceBook?</h2>
              <div className="uw-images">
                <motion.div className="uw-img-item" style={{ scale: uwImgScale, x: uwLeftX }}>
                  <p className="uw-img-caption">Check Times</p>
                  <img src={compareTimesImg} alt="Import Times" className="uw-img-photo" />
                </motion.div>
                <motion.div className="uw-img-item" style={{ scale: uwImgScale }}>
                  <p className="uw-img-caption">Track Progress</p>
                  <img src={trackProgressImg} alt="Track Progress" className="uw-img-photo" />
                </motion.div>
                <motion.div className="uw-img-item" style={{ scale: uwImgScale, x: uwRightX }}>
                  <p className="uw-img-caption">Plan Events</p>
                  <img src={planEventsImg} alt="Plan Events" className="uw-img-photo" />
                </motion.div>
              </div>
              <p className="uw-and-more">And More</p>
            </div>
          </motion.div>

        </div>
      </div>


      {/* ── Features ── */}
      <section id="features" className="features-section">
        <div className="features-header">
          <motion.h2 className="section-heading-dark" {...fadeUp}>
            Everything you need in one place
          </motion.h2>
          <motion.p className="section-sub-dark" {...fadeUpDelayed(0.2)}>
            
          </motion.p>
        </div>
        <div className="bento-grid">
          {FEATURES.map((card, i) => (
            <motion.div
              key={card.title}
              className={`bento-card${card.spanClass ? ' ' + card.spanClass : ''}`}
              {...bentoVariant(i)}
            >
              {card.spanClass === 'bento-span-tall' ? (
                <>
                  <h3 className="bento-title">{card.title}</h3>
                  <p className="bento-desc">{card.blurb}</p>
                  <img src={card.img} alt={card.title} className="bento-ph-img" />
                </>
              ) : (
                <>
                  <div className="bento-icon-wrap">
                    <img src={card.img} alt={card.title} className="bento-icon-img" />
                  </div>
                  <h3 className="bento-title">{card.title}</h3>
                  <p className="bento-desc">{card.blurb}</p>
                </>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── About ── */}
      <section ref={aboutRef} id="about" className="about">
        <motion.div className="section-scroll-glow" style={{ left: aboutGlowX, top: aboutGlowY }} />
        <div className="about-inner">
          <motion.div className="about-text" {...fadeLeft}>
            <span className="about-badge">Our Story</span>
            <h2>Built by a swimmer,<br />for swimmers.</h2>
            <p className="about-body">
              PaceBook was created out of frustration with scattered spreadsheets and PDF
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

      {/* ── Quotes ── */}
      <div ref={quotesWrapRef} className="quotes-glow-wrap">
        <motion.div className="section-scroll-glow section-scroll-glow--gold" style={{ left: quotesGlowX, top: quotesGlowY }} />
        <QuotesCarousel />
      </div>

      {/* ── Creators ── */}
      <section id="creators" className="creators">
        <motion.h2 className="creators-heading" {...fadeUp}>Meet the People Behind PaceBook</motion.h2>
        <motion.div className="creators-tabs" {...fadeUpDelayed(0.1)}>
          <button className={`creators-tab${creatorTab === 'caleb' ? ' active' : ''}`} onClick={() => setCreatorTab('caleb')}>
            Caleb Pang &mdash; Creator
          </button>
          <button className={`creators-tab${creatorTab === 'mason' ? ' active' : ''}`} onClick={() => setCreatorTab('mason')}>
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
              <span className="creators-role">{creatorTab === 'caleb' ? 'Creator' : 'Helper'}</span>
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
                My name is Mason Jung and I helped create this website as my friend, Caleb, needed 
                help with the more complex features of the site.. I am 15 as a freshman in Sunny Hills 
                High School, and have never swam before, though I do play tennis.
              </p>
            )}
          </div>
        </motion.div>
      </section>

      {/* ── Rating ── */}
      <RatingSection />

      {/* ── CTA ── */}
      <section id="cta" className="cta cta--immersive">
        <div className="cta-spotlight" />
        <div className="cta-glass-card">
          <motion.img src="/logo.svg" alt="PaceBook logo" className="cta-logo" {...fadeUp} />
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
        </div>
      </section>

      <footer className="footer">
        <img src="/logo.svg" alt="PaceBook logo" className="footer-logo" />
        <span>© 2026 PaceBook</span>
      </footer>
    </div>
  )
}

export default App
