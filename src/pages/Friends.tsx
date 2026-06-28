import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Profile, FeedNotif } from '../lib/friends'
import {
  searchProfiles, getProfile, getFollowers, getFollowing,
  follow, unfollow, getFeedNotifications, markFeedNotifsRead,
  writeFollowNotification,
} from '../lib/friends'
import { ChevronLeft, Search, Loader, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import './Friends.css'

type Tab = 'followers' | 'following' | 'discover' | 'activity'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function notifIcon(type: string) {
  if (type === 'pb')             return '🏊'
  if (type === 'meet')           return '📅'
  if (type === 'monthly_report') return '📊'
  return '📣'
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

// ── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ profile, size = 44 }: { profile: Pick<Profile, 'id'|'full_name'|'username'|'avatar_url'>; size?: number }) {
  if (profile.avatar_url) {
    return <img src={profile.avatar_url} alt="" className="fr-avatar-img" style={{ width: size, height: size }} />
  }
  return (
    <div className="fr-avatar-init" style={{ width: size, height: size, background: avatarBg(profile.id), fontSize: size * 0.36 }}>
      {initials(profile.full_name, profile.username)}
    </div>
  )
}

function TimesPanel({ times }: { times: Record<string, string> }) {
  const scyTimes = SCY_ORDER.filter(k => times[k])
  const lcmTimes = LCM_ORDER.filter(k => times[k])
  if (!scyTimes.length && !lcmTimes.length) {
    return <p className="fr-no-times">No times recorded yet.</p>
  }
  return (
    <div className="fr-times-wrap">
      {scyTimes.length > 0 && (
        <div className="fr-times-course">
          <div className="fr-times-course-label">SCY</div>
          {scyTimes.map(k => (
            <div key={k} className="fr-time-row">
              <span className="fr-time-event">{EVENT_LABELS[k]}</span>
              <span className="fr-time-val">{times[k]}</span>
            </div>
          ))}
        </div>
      )}
      {lcmTimes.length > 0 && (
        <div className="fr-times-course">
          <div className="fr-times-course-label">LCM</div>
          {lcmTimes.map(k => (
            <div key={k} className="fr-time-row">
              <span className="fr-time-event">{EVENT_LABELS[k]}</span>
              <span className="fr-time-val">{times[k]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Friends() {
  const navigate    = useNavigate()
  const [params]    = useSearchParams()

  const [myId,          setMyId]          = useState('')
  const [myMetaName,    setMyMetaName]    = useState<string | null>(null)
  const [myProfile,     setMyProfile]     = useState<Profile | null>(null)
  const [tab,           setTab]           = useState<Tab>((params.get('tab') as Tab) || 'followers')
  const [followers,     setFollowers]     = useState<Profile[]>([])
  const [following,     setFollowing]     = useState<Profile[]>([])
  const [followingIds,  setFollowingIds]  = useState<Set<string>>(new Set())
  const [followerIds,   setFollowerIds]   = useState<Set<string>>(new Set())
  const [pending,       setPending]       = useState<Set<string>>(new Set())
  const [expanded,      setExpanded]      = useState<string | null>(null)
  const [loading,       setLoading]       = useState(true)

  const [feedNotifs,    setFeedNotifs]    = useState<FeedNotif[]>([])
  const [activityRead,  setActivityRead]  = useState(false)

  const [query,         setQuery]         = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [searching,     setSearching]     = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/'); return }
      setMyId(user.id)
      setMyMetaName((user.user_metadata?.full_name as string | null) ?? null)

      const [profileRes, followersRes, followingRes, notifs] = await Promise.all([
        getProfile(user.id),
        getFollowers(user.id),
        getFollowing(user.id),
        getFeedNotifications(50),
      ])

      if (profileRes.data) setMyProfile(profileRes.data as Profile)
      const fwerList  = (followersRes.data ?? []) as Profile[]
      const fwingList = (followingRes.data ?? []) as Profile[]
      setFollowers(fwerList)
      setFollowing(fwingList)
      setFollowingIds(new Set(fwingList.map(p => p.id)))
      setFollowerIds(new Set(fwerList.map(p => p.id)))
      setFeedNotifs(notifs)
      setLoading(false)
    }
    load()
  }, [navigate])

  // Mark activity as read when that tab is opened
  useEffect(() => {
    if (tab !== 'activity' || activityRead) return
    const unreadIds = activityNotifs.filter(n => !n.read).map(n => n.id)
    if (!unreadIds.length) { setActivityRead(true); return }
    markFeedNotifsRead(unreadIds).then(() => {
      setFeedNotifs(prev => prev.map(n => ({ ...n, read: true })))
      setActivityRead(true)
    })
  }, [tab, activityRead, feedNotifs])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!query.trim()) { setSearchResults([]); setSearching(false); return }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      const { data } = await searchProfiles(query.trim(), myId)
      setSearchResults((data ?? []) as Profile[])
      setSearching(false)
    }, 350)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [query, myId])

  async function handleFollow(userId: string) {
    setPending(prev => new Set([...prev, userId]))
    const { error } = await follow(userId)
    if (!error) {
      setFollowingIds(prev => new Set([...prev, userId]))
      const allKnown = [...followers, ...searchResults, ...following]
      const prof = allKnown.find(p => p.id === userId)
      if (prof) {
        setFollowing(prev => prev.find(p => p.id === userId) ? prev : [...prev, prof])
        // Fire follow notification to the person being followed
        if (myProfile) writeFollowNotification(userId, myProfile)
      } else {
        const { data } = await getProfile(userId)
        if (data) {
          setFollowing(prev => [...prev, data as Profile])
          if (myProfile) writeFollowNotification(userId, myProfile)
        }
      }
    }
    setPending(prev => { const s = new Set(prev); s.delete(userId); return s })
  }

  async function handleUnfollow(userId: string) {
    setPending(prev => new Set([...prev, userId]))
    const { error } = await unfollow(userId)
    if (!error) {
      setFollowingIds(prev => { const s = new Set(prev); s.delete(userId); return s })
      setFollowing(prev => prev.filter(p => p.id !== userId))
    }
    setPending(prev => { const s = new Set(prev); s.delete(userId); return s })
  }

  function FollowButton({ userId }: { userId: string }) {
    const iFollow    = followingIds.has(userId)
    const theyFollow = followerIds.has(userId)
    const isPending  = pending.has(userId)

    if (iFollow) {
      return (
        <button
          className="fr-follow-btn fr-follow-btn--following"
          onClick={e => { e.stopPropagation(); handleUnfollow(userId) }}
          disabled={isPending}
        >
          {isPending ? '…' : 'Following'}
        </button>
      )
    }
    return (
      <button
        className={`fr-follow-btn ${theyFollow ? 'fr-follow-btn--followback' : 'fr-follow-btn--follow'}`}
        onClick={e => { e.stopPropagation(); handleFollow(userId) }}
        disabled={isPending}
      >
        {isPending ? '…' : theyFollow ? 'Follow back' : 'Follow'}
      </button>
    )
  }

  function UserCard({ profile }: { profile: Profile }) {
    const isExpanded = expanded === profile.id
    const isMutual   = followingIds.has(profile.id) && followerIds.has(profile.id)

    return (
      <div className={`fr-user-card${isExpanded ? ' fr-user-card--open' : ''}`}>
        <div className="fr-user-card-top" onClick={() => setExpanded(isExpanded ? null : profile.id)}>
          <button
            className="fr-avatar-btn"
            onClick={e => { e.stopPropagation(); navigate(`/profile/${profile.id}`) }}
            title="View profile"
          >
            <Avatar profile={profile} size={48} />
          </button>
          <div className="fr-user-card-info">
            <div className="fr-user-name-row">
              <span className="fr-user-name">{profile.full_name || profile.username}</span>
              {isMutual && <span className="fr-mutual-badge">Mutual</span>}
            </div>
            <span className="fr-user-sub">
              @{profile.username}
              {profile.club_team ? ` · ${profile.club_team}` : ''}
            </span>
          </div>
          <div className="fr-user-card-right">
            {profile.id !== myId && <FollowButton userId={profile.id} />}
            <span className="fr-user-card-chevron">
              {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </span>
          </div>
        </div>

        {isExpanded && (
          <div className="fr-user-card-times">
            <button
              className="fr-view-profile-btn"
              onClick={() => navigate(`/profile/${profile.id}`)}
            >
              <ExternalLink size={13} />
              View full profile
            </button>
            <TimesPanel times={profile.times ?? {}} />
          </div>
        )}
      </div>
    )
  }

  const activityNotifs = feedNotifs.filter(n => n.type === 'pb' || n.type === 'meet' || n.type === 'monthly_report')
  const unreadActivityCount = activityNotifs.filter(n => !n.read).length

  const listToShow: Profile[] =
    tab === 'followers' ? followers :
    tab === 'following' ? following :
    searchResults

  const emptyMsg =
    tab === 'followers' ? 'No one follows you yet.' :
    tab === 'following' ? "You're not following anyone yet." :
    ''

  return (
    <div className="fr-page">

      {/* ── Top nav ── */}
      <header className="fr-header">
        <button className="fr-back" onClick={() => navigate('/dashboard')}>
          <ChevronLeft size={18} /> Dashboard
        </button>
      </header>

      {/* ── My profile block ── */}
      <div className="fr-hero">
        <div className="fr-hero-avatar">
          <Avatar profile={myProfile ?? { id: myId || 'me', full_name: myMetaName, username: myMetaName || 'me', avatar_url: null }} size={84} />
        </div>
        <div className="fr-hero-info">
          <h1 className="fr-hero-name">{myProfile?.full_name || myMetaName || myProfile?.username || '—'}</h1>
          <p className="fr-hero-username">@{myProfile?.username || '—'}</p>
          {myProfile?.club_team && <p className="fr-hero-club">{myProfile.club_team}</p>}
        </div>
        <div className="fr-hero-stats">
          <button
            className={`fr-stat-btn${tab === 'followers' ? ' active' : ''}`}
            onClick={() => setTab('followers')}
          >
            <strong>{followers.length}</strong>
            <span>followers</span>
          </button>
          <div className="fr-stat-divider" />
          <button
            className={`fr-stat-btn${tab === 'following' ? ' active' : ''}`}
            onClick={() => setTab('following')}
          >
            <strong>{following.length}</strong>
            <span>following</span>
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="fr-tabs">
        {(['followers','following','discover','activity'] as Tab[]).map(t => (
          <button
            key={t}
            className={`fr-tab${tab === t ? ' fr-tab--active' : ''}`}
            onClick={() => { setTab(t); setExpanded(null) }}
          >
            {t === 'followers' ? 'Followers' :
             t === 'following' ? 'Following' :
             t === 'discover'  ? 'Discover'  : 'Activity'}
            {t === 'followers' && followers.length > 0 && <span className="fr-tab-pill">{followers.length}</span>}
            {t === 'following' && following.length > 0 && <span className="fr-tab-pill">{following.length}</span>}
            {t === 'activity'  && unreadActivityCount > 0 && (
              <span className="fr-tab-pill fr-tab-pill--alert">{unreadActivityCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Discover search bar ── */}
      {tab === 'discover' && (
        <div className="fr-search-wrap">
          <Search size={15} className="fr-search-icon" />
          <input
            className="fr-search-input"
            placeholder="Search by name or username…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          {searching && <Loader size={14} className="fr-search-spinner" />}
        </div>
      )}

      {/* ── Activity feed ── */}
      {tab === 'activity' && (
        <div className="fr-activity-wrap">
          {loading && (
            <div className="fr-list-empty"><Loader size={24} className="fr-list-spinner" /><p>Loading…</p></div>
          )}
          {!loading && activityNotifs.length === 0 && (
            <div className="fr-list-empty">
              <p>No activity yet.</p>
              <p className="fr-list-hint">Follow swimmers to see their new PRs and meet plans here.</p>
            </div>
          )}
          {!loading && activityNotifs.map(n => (
            <div
              key={n.id}
              className={`fr-activity-item${n.read ? '' : ' fr-activity-item--unread'}`}
              onClick={() => {
                if (n.type === 'meet') {
                  const meetDate = (n.data?.meetDate as string) ?? ''
                  const today = new Date().toISOString().slice(0, 10)
                  if (meetDate && meetDate < today) {
                    alert('This meet has already taken place.')
                    return
                  }
                  const params = new URLSearchParams()
                  if (n.data?.meetName) params.set('prefill_name', n.data.meetName as string)
                  if (n.data?.meetDate) params.set('prefill_date', n.data.meetDate as string)
                  if (n.data?.meetTime) params.set('prefill_time', n.data.meetTime as string)
                  navigate(`/calendar?${params.toString()}`)
                } else if (n.type === 'monthly_report' && n.from_user_id) {
                  navigate(`/profile/${n.from_user_id}`)
                } else if (n.from_user_id) {
                  navigate(`/profile/${n.from_user_id}`)
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <div className="fr-activity-icon">{notifIcon(n.type)}</div>
              <div className="fr-activity-body">
                <div className="fr-activity-title">{n.title}</div>
                <div className="fr-activity-msg">{n.message}</div>
                <div className="fr-activity-time">{relativeTime(n.created_at)}</div>
              </div>
              {!n.read && <div className="fr-activity-dot" />}
            </div>
          ))}
        </div>
      )}

      {/* ── Followers / Following / Discover list ── */}
      {tab !== 'activity' && (
        <div className="fr-list">
          {loading && (
            <div className="fr-list-empty">
              <Loader size={24} className="fr-list-spinner" />
              <p>Loading…</p>
            </div>
          )}

          {!loading && tab === 'discover' && !query.trim() && (
            <div className="fr-list-empty">
              <Search size={36} />
              <p>Search by name or username to find swimmers.</p>
            </div>
          )}

          {!loading && tab !== 'discover' && listToShow.length === 0 && (
            <div className="fr-list-empty">
              <p>{emptyMsg}</p>
              {tab === 'followers' && <p className="fr-list-hint">Share your PaceBook profile to get followers.</p>}
              {tab === 'following' && (
                <button className="fr-discover-cta" onClick={() => setTab('discover')}>
                  Find people to follow
                </button>
              )}
            </div>
          )}

          {!loading && tab === 'discover' && query.trim() && listToShow.length === 0 && !searching && (
            <div className="fr-list-empty"><p>No swimmers found for "{query}".</p></div>
          )}

          {listToShow.map(p => <UserCard key={p.id} profile={p} />)}
        </div>
      )}
    </div>
  )
}
