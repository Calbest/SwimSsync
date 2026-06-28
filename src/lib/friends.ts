import { supabase } from './supabase'

export interface Profile {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  gender: string | null
  club_team: string | null
  high_school: string | null
  times: Record<string, string>
  time_meta: Record<string, { date: string; meet: string }>
  updated_at: string
  dob: string | null
  banner_type: string | null
  banner_value: string | null
  top_events: string[]
  latest_monthly_report: MonthlyReport | null
  share_monthly_report: boolean
}

export interface MonthlyReport {
  year:           number
  month:          number   // 1–12
  swiamsLogged:   number
  eventsImproved: number
  biggestDrop:    { label: string; drop: number; newTime: string } | null
  generatedAt:    string
}

export interface FeedNotif {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  from_user_id: string | null
  data: Record<string, unknown>
  read: boolean
  created_at: string
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function upsertProfile(profile: Omit<Profile, 'updated_at'>) {
  return supabase.from('profiles').upsert(
    { ...profile, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  )
}

export async function searchProfiles(query: string, excludeId = '') {
  let q = supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, club_team, gender, times')
    .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
    .limit(12)
  if (excludeId) q = q.neq('id', excludeId)
  return q
}

export async function getProfile(userId: string) {
  return supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single<Profile>()
}

export async function checkIsFollowing(targetId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', user.id)
    .eq('following_id', targetId)
    .maybeSingle()
  return !!data
}

// ── Follows ───────────────────────────────────────────────────────────────────

export async function follow(followingId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: new Error('Not signed in') }
  return supabase.from('follows').insert({ follower_id: user.id, following_id: followingId })
}

export async function unfollow(followingId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: new Error('Not signed in') }
  return supabase.from('follows').delete()
    .eq('follower_id', user.id)
    .eq('following_id', followingId)
}

export async function getFollowers(userId: string): Promise<{ data: Profile[]; error: unknown }> {
  const { data: rows, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', userId)
  if (error || !rows?.length) return { data: [], error }
  const ids = rows.map((r: { follower_id: string }) => r.follower_id)
  const res = await supabase.from('profiles').select('*').in('id', ids)
  return { data: (res.data ?? []) as Profile[], error: res.error }
}

export async function getFollowing(userId: string): Promise<{ data: Profile[]; error: unknown }> {
  const { data: rows, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)
  if (error || !rows?.length) return { data: [], error }
  const ids = rows.map((r: { following_id: string }) => r.following_id)
  const res = await supabase.from('profiles').select('*').in('id', ids)
  return { data: (res.data ?? []) as Profile[], error: res.error }
}

export async function getFollowCounts(userId: string) {
  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
  ])
  return { followers: followers ?? 0, following: following ?? 0 }
}

// ── Feed Notifications ────────────────────────────────────────────────────────

export async function getFeedNotifications(limit = 30): Promise<FeedNotif[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  try {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)
    return (data ?? []) as FeedNotif[]
  } catch {
    return []
  }
}

export async function markFeedNotifsRead(ids: string[]): Promise<void> {
  if (!ids.length) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  try {
    await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', ids)
      .eq('user_id', user.id)
  } catch { /* notifications table may not exist yet */ }
}

export async function writeFollowNotification(
  targetId: string,
  fromProfile: Pick<Profile, 'id' | 'full_name' | 'username' | 'avatar_url'>,
): Promise<void> {
  try {
    const name = fromProfile.full_name || fromProfile.username
    await supabase.from('notifications').insert({
      user_id:      targetId,
      type:         'new_follower',
      title:        'New follower',
      message:      `${name} started following you.`,
      from_user_id: fromProfile.id,
      data:         { fromAvatar: fromProfile.avatar_url ?? null },
    })
  } catch { /* notifications table may not exist yet */ }
}

export async function writeMeetNotification(
  fromProfile: Pick<Profile, 'id' | 'full_name' | 'username' | 'avatar_url'>,
  meet: { id: string; name: string; date: string; time?: string },
): Promise<void> {
  try {
    const { data: rows } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', fromProfile.id)
      .limit(100)
    if (!rows?.length) return

    const name = fromProfile.full_name || fromProfile.username
    const inserts = rows.map(row => ({
      user_id:      row.follower_id,
      type:         'meet',
      title:        `Meet — ${name}`,
      message:      `${name} is going to ${meet.name} on ${meet.date}${meet.time ? ` at ${meet.time}` : ''}.`,
      from_user_id: fromProfile.id,
      data:         { meetName: meet.name, meetDate: meet.date, meetTime: meet.time ?? '' },
    }))
    await supabase.from('notifications').insert(inserts)
  } catch { /* notifications table may not exist yet */ }
}

export async function writeMonthlyReportNotification(
  fromProfile: Pick<Profile, 'id' | 'full_name' | 'username' | 'avatar_url'>,
  report: MonthlyReport,
): Promise<void> {
  try {
    const { data: rows } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', fromProfile.id)
      .limit(200)
    if (!rows?.length) return

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const name  = fromProfile.full_name || fromProfile.username
    const label = `${months[report.month - 1]} ${report.year}`
    const inserts = rows.map(row => ({
      user_id:      row.follower_id,
      type:         'monthly_report',
      title:        `${name}'s ${label} Progress Report`,
      message:      `${report.swiamsLogged} swim${report.swiamsLogged !== 1 ? 's' : ''} logged${report.eventsImproved > 0 ? `, ${report.eventsImproved} event${report.eventsImproved !== 1 ? 's' : ''} improved` : ''}${report.biggestDrop ? ` — best drop: ${report.biggestDrop.newTime} (−${report.biggestDrop.drop.toFixed(2)}s)` : ''}.`,
      from_user_id: fromProfile.id,
      data:         { year: report.year, month: report.month, fromUserId: fromProfile.id },
    }))
    await supabase.from('notifications').insert(inserts)
  } catch { /* notifications table may not exist yet */ }
}

export async function writePRNotificationsForFollowers(
  fromProfile: Profile,
  prEvents: { key: string; label: string; newTime: string; oldTime?: string }[],
): Promise<void> {
  if (!prEvents.length) return
  try {
    const { data: rows } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', fromProfile.id)
      .limit(100)
    if (!rows?.length) return

    const name = fromProfile.full_name || fromProfile.username
    const inserts = rows.flatMap(row =>
      prEvents.map(ev => ({
        user_id: row.follower_id,
        type: 'pb',
        title: `New PR — ${name}`,
        message: ev.oldTime
          ? `${name} just dropped a ${ev.label} PR: ${ev.newTime} (was ${ev.oldTime})`
          : `${name} posted a new ${ev.label} time: ${ev.newTime}`,
        from_user_id: fromProfile.id,
        data: { eventKey: ev.key, newTime: ev.newTime, oldTime: ev.oldTime ?? null },
      }))
    )
    await supabase.from('notifications').insert(inserts)
  } catch { /* notifications table may not exist yet */ }
}
