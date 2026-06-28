import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, UserPlus, UserCheck, Users, GitCompare } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  getProfile, checkIsFollowing, follow, unfollow, getFollowCounts,
} from '../lib/friends'
import type { Profile as ProfileType } from '../lib/friends'
import './Profile.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TOP_EVENT_LABELS: Record<string, string> = {
  'SCY-50-free':'SCY 50 Free','SCY-100-free':'SCY 100 Free','SCY-200-free':'SCY 200 Free',
  'SCY-500-free':'SCY 500 Free','SCY-1000-free':'SCY 1000 Free','SCY-1650-free':'SCY 1650 Free',
  'SCY-100-back':'SCY 100 Back','SCY-200-back':'SCY 200 Back',
  'SCY-100-breast':'SCY 100 Breast','SCY-200-breast':'SCY 200 Breast',
  'SCY-100-fly':'SCY 100 Fly','SCY-200-fly':'SCY 200 Fly',
  'SCY-200-im':'SCY 200 IM','SCY-400-im':'SCY 400 IM',
  'LCM-50-free':'LCM 50 Free','LCM-100-free':'LCM 100 Free','LCM-200-free':'LCM 200 Free',
  'LCM-400-free':'LCM 400 Free','LCM-800-free':'LCM 800 Free','LCM-1500-free':'LCM 1500 Free',
  'LCM-100-back':'LCM 100 Back','LCM-200-back':'LCM 200 Back',
  'LCM-100-breast':'LCM 100 Breast','LCM-200-breast':'LCM 200 Breast',
  'LCM-100-fly':'LCM 100 Fly','LCM-200-fly':'LCM 200 Fly',
  'LCM-200-im':'LCM 200 IM','LCM-400-im':'LCM 400 IM',
}

const SCY_ORDER = [
  'SCY-50-free','SCY-100-free','SCY-200-free','SCY-500-free','SCY-1000-free','SCY-1650-free',
  'SCY-100-back','SCY-200-back','SCY-100-breast','SCY-200-breast',
  'SCY-100-fly','SCY-200-fly','SCY-200-im','SCY-400-im',
]
const LCM_ORDER = [
  'LCM-50-free','LCM-100-free','LCM-200-free','LCM-400-free','LCM-800-free','LCM-1500-free',
  'LCM-100-back','LCM-200-back','LCM-100-breast','LCM-200-breast',
  'LCM-100-fly','LCM-200-fly','LCM-200-im','LCM-400-im',
]
const EVENT_LABELS: Record<string, string> = {
  'SCY-50-free':'50 Free','SCY-100-free':'100 Free','SCY-200-free':'200 Free',
  'SCY-500-free':'500 Free','SCY-1000-free':'1000 Free','SCY-1650-free':'1650 Free',
  'SCY-100-back':'100 Back','SCY-200-back':'200 Back',
  'SCY-100-breast':'100 Breast','SCY-200-breast':'200 Breast',
  'SCY-100-fly':'100 Fly','SCY-200-fly':'200 Fly',
  'SCY-200-im':'200 IM','SCY-400-im':'400 IM',
  'LCM-50-free':'50 Free','LCM-100-free':'100 Free','LCM-200-free':'200 Free',
  'LCM-400-free':'400 Free','LCM-800-free':'800 Free','LCM-1500-free':'1500 Free',
  'LCM-100-back':'100 Back','LCM-200-back':'200 Back',
  'LCM-100-breast':'100 Breast','LCM-200-breast':'200 Breast',
  'LCM-100-fly':'100 Fly','LCM-200-fly':'200 Fly',
  'LCM-200-im':'200 IM','LCM-400-im':'400 IM',
}

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

function calcAge(dob: string | null): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function bannerStyle(bannerType: string | null, bannerValue: string | null): React.CSSProperties {
  if ((bannerType === 'canvas' || bannerType === 'photo') && bannerValue)
    return { backgroundImage: `url(${bannerValue})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  if ((bannerType === 'gradient' || bannerType === 'color') && bannerValue)
    return { background: bannerValue }
  return { background: 'linear-gradient(135deg, #001a3d 0%, #003a70 50%, #002855 100%)' }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TimesSection({
  times,
  timeMeta,
}: {
  times: Record<string, string>
  timeMeta: Record<string, { date: string; meet: string }>
}) {
  const hasAnyScy = SCY_ORDER.some(k => times[k])
  const hasAnyLcm = LCM_ORDER.some(k => times[k])

  if (!hasAnyScy && !hasAnyLcm) {
    return (
      <div className="pub-times-empty">
        <Users size={32} />
        <p>No personal bests recorded yet.</p>
      </div>
    )
  }

  function renderCourse(keys: string[], label: string) {
    if (!keys.some(k => times[k])) return null
    return (
      <div className="pub-times-course">
        <div className="pub-times-course-label">{label}</div>
        {keys.map(k => {
          const time = times[k]
          const meta = timeMeta?.[k]
          return (
            <div key={k} className="pub-time-row">
              <span className="pub-time-event">{EVENT_LABELS[k]}</span>
              <div className="pub-time-right">
                <span className={`pub-time-val${!time ? ' pub-time-val--na' : ''}`}>
                  {time || 'N/A'}
                </span>
                {time && meta && (
                  <span className="pub-time-meta">
                    {meta.date}{meta.meet ? ` · ${meta.meet}` : ''}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="pub-times-grid">
      {renderCourse(SCY_ORDER, 'Short Course Yards')}
      {renderCourse(LCM_ORDER, 'Long Course Meters')}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PublicProfile() {
  const { userId } = useParams<{ userId: string }>()
  const navigate   = useNavigate()

  const [profile,       setProfile]       = useState<ProfileType | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [notFound,      setNotFound]      = useState(false)
  const [isPrivate,     setIsPrivate]     = useState(false)
  const [isBlocked,     setIsBlocked]     = useState(false)
  const [myId,          setMyId]          = useState<string | null>(null)
  const [isFollowing,   setIsFollowing]   = useState(false)
  const [followPending, setFollowPending] = useState(false)
  const [counts,        setCounts]        = useState({ followers: 0, following: 0 })
  const didInit = useRef(false)

  useEffect(() => {
    if (!userId || didInit.current) return
    didInit.current = true

    async function load() {
      const [{ data: { user } }, profileRes, countsRes] = await Promise.all([
        supabase.auth.getUser(),
        getProfile(userId!),
        getFollowCounts(userId!),
      ])

      setMyId(user?.id ?? null)
      if (!profileRes.data) { setNotFound(true); setLoading(false); return }
      const prof = profileRes.data as ProfileType & { is_private?: boolean }
      setProfile(prof)
      setCounts(countsRes)

      if (user && user.id !== userId) {
        const following = await checkIsFollowing(userId!)
        setIsFollowing(following)

        // Check if viewer is blocked by profile owner
        try {
          const { data: block } = await supabase
            .from('blocks')
            .select('id')
            .eq('blocker_id', userId!)
            .eq('blocked_id', user.id)
            .maybeSingle()
          if (block) { setIsBlocked(true); setLoading(false); return }
        } catch { /* blocks table may not exist yet */ }

        // Check private account
        if (prof.is_private && !following) {
          setIsPrivate(true)
        }
      }
      setLoading(false)
    }

    load()
  }, [userId])

  async function handleFollow() {
    if (!myId) { navigate('/sign-in'); return }
    setFollowPending(true)
    const { error } = await follow(userId!)
    if (!error) {
      setIsFollowing(true)
      setCounts(c => ({ ...c, followers: c.followers + 1 }))
    }
    setFollowPending(false)
  }

  async function handleUnfollow() {
    setFollowPending(true)
    const { error } = await unfollow(userId!)
    if (!error) {
      setIsFollowing(false)
      setCounts(c => ({ ...c, followers: Math.max(0, c.followers - 1) }))
    }
    setFollowPending(false)
  }

  if (loading) {
    return (
      <div className="pub-page pub-page--loading">
        <div className="pub-spinner" />
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="pub-page pub-page--404">
        <button className="pub-back" onClick={() => navigate('/')}>
          <ChevronLeft size={18} /> Home
        </button>
        <div className="pub-404-body">
          <span className="pub-404-icon">🏊</span>
          <h2>Swimmer not found</h2>
          <p>This profile doesn't exist or may have been removed.</p>
        </div>
      </div>
    )
  }

  if (isBlocked) {
    return (
      <div className="pub-page pub-page--404">
        <button className="pub-back" onClick={() => navigate(-1)}>
          <ChevronLeft size={18} /> Back
        </button>
        <div className="pub-404-body">
          <span className="pub-404-icon">🔒</span>
          <h2>Profile unavailable</h2>
          <p>You can't view this profile.</p>
        </div>
      </div>
    )
  }

  if (isPrivate) {
    return (
      <div className="pub-page pub-page--404">
        <button className="pub-back" onClick={() => navigate(-1)}>
          <ChevronLeft size={18} /> Back
        </button>
        <div className="pub-404-body">
          <span className="pub-404-icon">🔒</span>
          <h2>This account is private</h2>
          <p>Follow this swimmer to see their profile and times.</p>
        </div>
      </div>
    )
  }

  const age = calcAge(profile.dob)
  const isOwnProfile = myId === profile.id

  return (
    <div className="pub-page">

      {/* ── Banner ── */}
      <div className="pub-banner-wrap">
        <div className="pub-banner" style={bannerStyle(profile.banner_type, profile.banner_value)} />
        <button className="pub-back pub-back--overlay" onClick={() => navigate(-1)}>
          <ChevronLeft size={18} /> Back
        </button>
      </div>

      {/* ── Profile header ── */}
      <div className="pub-profile-header">

        {/* Avatar */}
        <div className="pub-avatar-wrap">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" className="pub-avatar-img" />
            : (
              <div className="pub-avatar-init" style={{ background: avatarBg(profile.id) }}>
                {initials(profile.full_name, profile.username)}
              </div>
            )
          }
        </div>

        {/* Follow + Compare buttons (top-right, only for other users) */}
        {!isOwnProfile && myId !== undefined && (
          <div className="pub-follow-wrap" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {myId && (
              <button
                className="pub-compare-btn"
                onClick={() => navigate(`/compare-profiles/${profile.id}`)}
              >
                <GitCompare size={14} />
                Compare
              </button>
            )}
            {isFollowing ? (
              <button
                className="pub-follow-btn pub-follow-btn--following"
                onClick={handleUnfollow}
                disabled={followPending}
              >
                <UserCheck size={15} />
                {followPending ? '…' : 'Following'}
              </button>
            ) : (
              <button
                className="pub-follow-btn pub-follow-btn--follow"
                onClick={handleFollow}
                disabled={followPending}
              >
                <UserPlus size={15} />
                {followPending ? '…' : myId ? 'Follow' : 'Sign in to follow'}
              </button>
            )}
          </div>
        )}

        {/* Name / meta */}
        <h1 className="pub-name">{profile.full_name || profile.username}</h1>
        <p className="pub-handle">@{profile.username}</p>

        <div className="pub-meta-row">
          {profile.club_team && <span className="pub-meta-tag">{profile.club_team}</span>}
          {profile.high_school && <span className="pub-meta-tag">{profile.high_school}</span>}
          {profile.gender && (
            <span className={`pub-meta-tag pub-meta-tag--gender pub-meta-tag--${profile.gender}`}>
              {profile.gender === 'male' ? 'Male' : 'Female'}
            </span>
          )}
          {age !== null && <span className="pub-meta-tag">Age {age}</span>}
        </div>

        {/* Follower / following counts */}
        <div className="pub-counts">
          <div className="pub-count">
            <strong>{counts.followers}</strong>
            <span>followers</span>
          </div>
          <div className="pub-count-divider" />
          <div className="pub-count">
            <strong>{counts.following}</strong>
            <span>following</span>
          </div>
        </div>

        {isOwnProfile && (
          <button className="pub-edit-btn" onClick={() => navigate('/settings')}>
            Edit Profile
          </button>
        )}
      </div>

      {/* ── Top Events ── */}
      {(profile.top_events ?? []).filter(Boolean).length > 0 && (
        <div className="pub-section">
          <h2 className="pub-section-title">Top Events</h2>
          <div className="pub-top-events">
            {(profile.top_events ?? []).filter(Boolean).map((key, i) => (
              <div key={key} className="pub-top-event-row">
                <span className="pub-top-event-rank">#{i + 1}</span>
                <span className="pub-top-event-label">{TOP_EVENT_LABELS[key] ?? key}</span>
                {profile.times?.[key] && (
                  <span className="pub-top-event-time">{profile.times[key]}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Monthly Report ── */}
      {profile.share_monthly_report && profile.latest_monthly_report && isFollowing && (
        <div className="pub-section">
          <h2 className="pub-section-title">
            {(() => {
              const r = profile.latest_monthly_report!
              const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
              return `${months[r.month - 1]} ${r.year} Progress Report`
            })()}
          </h2>
          <div className="pub-report-card">
            <div className="pub-report-stat">
              <span className="pub-report-val">{profile.latest_monthly_report.swiamsLogged}</span>
              <span className="pub-report-label">swims logged</span>
            </div>
            <div className="pub-report-stat">
              <span className="pub-report-val">{profile.latest_monthly_report.eventsImproved}</span>
              <span className="pub-report-label">events improved</span>
            </div>
            {profile.latest_monthly_report.biggestDrop && (
              <div className="pub-report-drop">
                <span className="pub-report-drop-label">Best drop</span>
                <span className="pub-report-drop-event">{profile.latest_monthly_report.biggestDrop.label}</span>
                <span className="pub-report-drop-time">{profile.latest_monthly_report.biggestDrop.newTime}</span>
                <span className="pub-report-drop-delta">−{profile.latest_monthly_report.biggestDrop.drop.toFixed(2)}s</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Personal bests ── */}
      <div className="pub-section">
        <h2 className="pub-section-title">Personal Bests</h2>
        <TimesSection times={profile.times ?? {}} timeMeta={profile.time_meta ?? {}} />
      </div>

    </div>
  )
}
