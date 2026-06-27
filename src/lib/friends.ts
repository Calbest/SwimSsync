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
  updated_at: string
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function upsertProfile(profile: Omit<Profile, 'updated_at'>) {
  return supabase.from('profiles').upsert(
    { ...profile, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  )
}

export async function searchProfiles(query: string, excludeId: string) {
  return supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, club_team, gender, times')
    .ilike('username', `%${query}%`)
    .neq('id', excludeId)
    .limit(12)
}

export async function getProfile(userId: string) {
  return supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single<Profile>()
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
