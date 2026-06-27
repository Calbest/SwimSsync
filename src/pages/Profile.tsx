import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, UserPlus, UserCheck, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  getProfile, checkIsFollowing, follow, unfollow, getFollowCounts,
} from '../lib/friends'
import type { Profile as ProfileType } from '../lib/friends'
import './Profile.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function TimesSection({ times }: { times: Record<string, string> }) {
  const scyTimes = SCY_ORDER.filter(k => times[k])
  const lcmTimes = LCM_ORDER.filter(k => times[k])

  if (!scyTimes.length && !lcmTimes.length) {
    return (
      <div className="pub-times-empty">
        <Users size={32} />
        <p>No personal bests recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="pub-times-grid">
      {scyTimes.length > 0 && (
        <div className="pub-times-course">
          <div className="pub-times-course-label">Short Course Yards</div>
          {scyTimes.map(k => (
            <div key={k} className="pub-time-row">
              <span className="pub-time-event">{EVENT_LABELS[k]}</span>
              <span className="pub-time-val">{times[k]}</span>
            </div>
          ))}
        </div>
      )}
      {lcmTimes.length > 0 && (
        <div className="pub-times-course">
          <div className="pub-times-course-label">Long Course Meters</div>
          {lcmTimes.map(k => (
            <div key={k} className="pub-time-row">
              <span className="pub-time-event">{EVENT_LABELS[k]}</span>
              <span className="pub-time-val">{times[k]}</span>
            </div>
          ))}
        </div>
      )}
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
      setProfile(profileRes.data as ProfileType)
      setCounts(countsRes)

      if (user && user.id !== userId) {
        const following = await checkIsFollowing(userId!)
        setIsFollowing(following)
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

        {/* Follow button (top-right, only for other users) */}
        {!isOwnProfile && myId !== undefined && (
          <div className="pub-follow-wrap">
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

      {/* ── Personal bests ── */}
      <div className="pub-section">
        <h2 className="pub-section-title">Personal Bests</h2>
        <TimesSection times={profile.times ?? {}} />
      </div>

    </div>
  )
}
