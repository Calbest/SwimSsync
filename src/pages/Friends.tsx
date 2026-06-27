import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Profile, Friendship } from '../lib/friends'
import {
  searchProfiles, getMyFriendships, getFriendProfiles,
  sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend,
} from '../lib/friends'
import { ChevronLeft, Search, UserPlus, Check, X, Users, UserMinus, Loader } from 'lucide-react'
import './Friends.css'

// ── Helpers ──────────────────────────────────────────────────────────────────

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

const SCY_ORDER = [
  'SCY-50-free','SCY-100-free','SCY-200-free','SCY-500-free','SCY-1000-free','SCY-1650-free',
  'SCY-100-back','SCY-200-back',
  'SCY-100-breast','SCY-200-breast',
  'SCY-100-fly','SCY-200-fly',
  'SCY-200-im','SCY-400-im',
]
const LCM_ORDER = [
  'LCM-50-free','LCM-100-free','LCM-200-free','LCM-400-free','LCM-800-free','LCM-1500-free',
  'LCM-100-back','LCM-200-back',
  'LCM-100-breast','LCM-200-breast',
  'LCM-100-fly','LCM-200-fly',
  'LCM-200-im','LCM-400-im',
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

function Avatar({ profile, size = 44 }: { profile: Pick<Profile, 'id' | 'full_name' | 'username' | 'avatar_url'>; size?: number }) {
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
  const navigate = useNavigate()
  const [myId, setMyId] = useState('')

  const [friendships,    setFriendships]    = useState<Friendship[]>([])
  const [friendProfiles, setFriendProfiles] = useState<Profile[]>([])
  const [selected,       setSelected]       = useState<Profile | null>(null)
  const [loading,        setLoading]        = useState(true)

  const [query,          setQuery]          = useState('')
  const [searchResults,  setSearchResults]  = useState<Profile[]>([])
  const [searching,      setSearching]      = useState(false)
  const [requestSent,    setRequestSent]    = useState<Set<string>>(new Set())

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/'); return }
      setMyId(user.id)

      const { data: fs } = await getMyFriendships()
      const allFs = (fs ?? []) as Friendship[]
      setFriendships(allFs)

      const acceptedIds = allFs
        .filter(f => f.status === 'accepted')
        .map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id)

      const { data: profiles } = await getFriendProfiles(acceptedIds)
      setFriendProfiles((profiles ?? []) as Profile[])
      setLoading(false)
    }
    load()
  }, [navigate])

  // ── Search ────────────────────────────────────────────────────────────────
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

  // ── Derived state ─────────────────────────────────────────────────────────
  const incoming = friendships.filter(f => f.addressee_id === myId && f.status === 'pending')
  const outgoing  = new Set(
    friendships.filter(f => f.requester_id === myId && f.status === 'pending').map(f => f.addressee_id)
  )
  const friendIds = new Set(
    friendships.filter(f => f.status === 'accepted').map(f =>
      f.requester_id === myId ? f.addressee_id : f.requester_id
    )
  )

  function friendshipWith(userId: string) {
    return friendships.find(f =>
      (f.requester_id === userId && f.addressee_id === myId) ||
      (f.requester_id === myId   && f.addressee_id === userId)
    )
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async function handleSendRequest(addresseeId: string) {
    setRequestSent(prev => new Set([...prev, addresseeId]))
    const { error } = await sendFriendRequest(addresseeId)
    if (error) {
      setRequestSent(prev => { const s = new Set(prev); s.delete(addresseeId); return s })
      return
    }
    const { data: fs } = await getMyFriendships()
    setFriendships((fs ?? []) as Friendship[])
  }

  async function handleAccept(fs: Friendship) {
    await acceptFriendRequest(fs.id)
    const { data } = await getMyFriendships()
    const allFs = (data ?? []) as Friendship[]
    setFriendships(allFs)
    const acceptedIds = allFs
      .filter(f => f.status === 'accepted')
      .map(f => f.requester_id === myId ? f.addressee_id : f.requester_id)
    const { data: profiles } = await getFriendProfiles(acceptedIds)
    setFriendProfiles((profiles ?? []) as Profile[])
  }

  async function handleDecline(fsId: number) {
    await declineFriendRequest(fsId)
    setFriendships(prev => prev.filter(f => f.id !== fsId))
  }

  async function handleUnfriend(profile: Profile) {
    const fs = friendshipWith(profile.id)
    if (!fs) return
    await removeFriend(fs.id)
    setFriendships(prev => prev.filter(f => f.id !== fs.id))
    setFriendProfiles(prev => prev.filter(p => p.id !== profile.id))
    if (selected?.id === profile.id) setSelected(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fr-page">
      {/* Header */}
      <header className="fr-header">
        <button className="fr-back" onClick={() => navigate('/dashboard')}>
          <ChevronLeft size={18} /> Dashboard
        </button>
        <div className="fr-header-title">
          <Users size={20} />
          Friends
        </div>
        <div className="fr-header-spacer" />
      </header>

      <div className="fr-body">
        {/* ── Left panel ── */}
        <aside className="fr-sidebar">
          {/* Search */}
          <div className="fr-search-wrap">
            <Search size={15} className="fr-search-icon" />
            <input
              className="fr-search-input"
              placeholder="Search by username…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {searching && <Loader size={14} className="fr-search-spinner" />}
          </div>

          {/* Search results */}
          {query.trim() && (
            <div className="fr-section">
              <div className="fr-section-label">Results</div>
              {searchResults.length === 0 && !searching && (
                <p className="fr-empty-hint">No users found.</p>
              )}
              {searchResults.map(p => {
                const isFriend   = friendIds.has(p.id)
                const isOutgoing = outgoing.has(p.id) || requestSent.has(p.id)
                const incomingFs = friendships.find(f => f.requester_id === p.id && f.addressee_id === myId && f.status === 'pending')

                return (
                  <div key={p.id} className="fr-result-row">
                    <Avatar profile={p} size={36} />
                    <div className="fr-result-info">
                      <span className="fr-result-name">{p.full_name || p.username}</span>
                      <span className="fr-result-username">@{p.username}</span>
                    </div>
                    {isFriend ? (
                      <button className="fr-req-btn fr-req-btn--done" disabled>Friends</button>
                    ) : incomingFs ? (
                      <button className="fr-req-btn fr-req-btn--accept" onClick={() => handleAccept(incomingFs)}>
                        <Check size={13} /> Accept
                      </button>
                    ) : isOutgoing ? (
                      <button className="fr-req-btn fr-req-btn--sent" disabled>Sent</button>
                    ) : (
                      <button className="fr-req-btn fr-req-btn--add" onClick={() => handleSendRequest(p.id)}>
                        <UserPlus size={13} /> Add
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Pending incoming requests */}
          {incoming.length > 0 && !query.trim() && (
            <div className="fr-section">
              <div className="fr-section-label">
                Pending Requests
                <span className="fr-badge">{incoming.length}</span>
              </div>
              {incoming.map(fs => (
                <IncomingRequest
                  key={fs.id}
                  fs={fs}
                  onAccept={() => handleAccept(fs)}
                  onDecline={() => handleDecline(fs.id)}
                />
              ))}
            </div>
          )}

          {/* Friends list */}
          {!query.trim() && (
            <div className="fr-section fr-section--friends">
              <div className="fr-section-label">
                Friends
                {friendProfiles.length > 0 && <span className="fr-count">{friendProfiles.length}</span>}
              </div>
              {loading && <p className="fr-empty-hint">Loading…</p>}
              {!loading && friendProfiles.length === 0 && (
                <p className="fr-empty-hint">No friends yet — search for teammates above.</p>
              )}
              {friendProfiles.map(p => (
                <button
                  key={p.id}
                  className={`fr-friend-row${selected?.id === p.id ? ' fr-friend-row--active' : ''}`}
                  onClick={() => setSelected(p)}
                >
                  <Avatar profile={p} size={38} />
                  <div className="fr-friend-info">
                    <span className="fr-friend-name">{p.full_name || p.username}</span>
                    <span className="fr-friend-username">@{p.username}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* ── Right panel ── */}
        <main className="fr-main">
          {!selected ? (
            <div className="fr-empty-state">
              <Users size={48} className="fr-empty-icon" />
              <p className="fr-empty-title">Select a friend</p>
              <p className="fr-empty-sub">Choose someone from your friends list to see their profile and best times.</p>
            </div>
          ) : (
            <FriendProfile
              profile={selected}
              onUnfriend={() => handleUnfriend(selected)}
            />
          )}
        </main>
      </div>
    </div>
  )
}

// ── IncomingRequest ───────────────────────────────────────────────────────────

function IncomingRequest({ fs, onAccept, onDecline }: { fs: Friendship; onAccept: () => void; onDecline: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    import('../lib/friends').then(m => m.getProfile(fs.requester_id)).then(({ data }) => {
      if (data) setProfile(data as Profile)
    })
  }, [fs.requester_id])

  return (
    <div className="fr-incoming-row">
      {profile ? <Avatar profile={profile} size={36} /> : <div className="fr-avatar-init" style={{ width: 36, height: 36, background: '#94a3b8', fontSize: 13 }}>?</div>}
      <div className="fr-result-info">
        <span className="fr-result-name">{profile?.full_name || profile?.username || '…'}</span>
        <span className="fr-result-username">{profile ? `@${profile.username}` : 'Loading…'}</span>
      </div>
      <div className="fr-incoming-actions">
        <button className="fr-icon-btn fr-icon-btn--accept" onClick={onAccept} title="Accept"><Check size={14} /></button>
        <button className="fr-icon-btn fr-icon-btn--decline" onClick={onDecline} title="Decline"><X size={14} /></button>
      </div>
    </div>
  )
}

// ── FriendProfile ─────────────────────────────────────────────────────────────

function FriendProfile({ profile, onUnfriend }: { profile: Profile; onUnfriend: () => void }) {
  const [confirmUnfriend, setConfirmUnfriend] = useState(false)

  return (
    <div className="fr-profile">
      <div className="fr-profile-hero">
        <Avatar profile={profile} size={72} />
        <div className="fr-profile-name-wrap">
          <h2 className="fr-profile-name">{profile.full_name || profile.username}</h2>
          <span className="fr-profile-username">@{profile.username}</span>
          <div className="fr-profile-meta">
            {profile.gender && <span className="fr-profile-chip">{profile.gender === 'male' ? '♂ Male' : profile.gender === 'female' ? '♀ Female' : profile.gender}</span>}
            {profile.club_team && <span className="fr-profile-chip">{profile.club_team}</span>}
            {profile.high_school && <span className="fr-profile-chip">{profile.high_school}</span>}
          </div>
        </div>
      </div>

      <div className="fr-profile-section-label">Best Times</div>
      <TimesPanel times={profile.times} />

      <div className="fr-unfriend-wrap">
        {!confirmUnfriend ? (
          <button className="fr-unfriend-btn" onClick={() => setConfirmUnfriend(true)}>
            <UserMinus size={15} /> Unfriend
          </button>
        ) : (
          <div className="fr-confirm-row">
            <span className="fr-confirm-text">Remove {profile.full_name || profile.username}?</span>
            <button className="fr-confirm-yes" onClick={onUnfriend}>Remove</button>
            <button className="fr-confirm-no" onClick={() => setConfirmUnfriend(false)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}
