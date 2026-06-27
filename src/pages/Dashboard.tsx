import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Check, User, LogOut, Settings, Trophy, Target, Upload, TrendingUp, X, CalendarCheck, Bell, Star, Clock, Zap, Film } from 'lucide-react'
import TimeConverterPopup from '../components/TimeConverterPopup'
import OnboardingModal from '../components/OnboardingModal'
import { supabase } from '../lib/supabase'
import { upsertProfile, getFollowCounts } from '../lib/friends'
import type { Goal } from './Goals'
import { playClick, playSave, playNavigate } from '../lib/sounds'
import './Dashboard.css'

type EventEntry = { id: string; label: string }
type StrokeGroup = { stroke: string; events: EventEntry[] }

const LCM_EVENTS: StrokeGroup[] = [
  {
    stroke: 'Freestyle',
    events: [
      { id: '50-free',  label: '50m' },
      { id: '100-free', label: '100m' },
      { id: '200-free', label: '200m' },
      { id: '400-free', label: '400m' },
      { id: '800-free', label: '800m' },
      { id: '1500-free',label: '1500m' },
    ],
  },
  {
    stroke: 'Backstroke',
    events: [
      { id: '50-back',  label: '50m' },
      { id: '100-back', label: '100m' },
      { id: '200-back', label: '200m' },
    ],
  },
  {
    stroke: 'Breaststroke',
    events: [
      { id: '50-breast',  label: '50m' },
      { id: '100-breast', label: '100m' },
      { id: '200-breast', label: '200m' },
    ],
  },
  {
    stroke: 'Butterfly',
    events: [
      { id: '50-fly',  label: '50m' },
      { id: '100-fly', label: '100m' },
      { id: '200-fly', label: '200m' },
    ],
  },
  {
    stroke: 'Individual Medley',
    events: [
      { id: '200-im', label: '200m' },
      { id: '400-im', label: '400m' },
    ],
  },
  {
    stroke: 'Relays',
    events: [
      { id: 'relay-4x50-free',    label: '4Ã—50 Free' },
      { id: 'relay-4x100-free',   label: '4Ã—100 Free' },
      { id: 'relay-4x200-free',   label: '4Ã—200 Free' },
      { id: 'relay-4x100-medley', label: '4Ã—100 Medley' },
      { id: 'relay-4x200-medley', label: '4Ã—200 Medley' },
    ],
  },
]

const SCY_EVENTS: StrokeGroup[] = [
  {
    stroke: 'Freestyle',
    events: [
      { id: '50-free',   label: '50y' },
      { id: '100-free',  label: '100y' },
      { id: '200-free',  label: '200y' },
      { id: '500-free',  label: '500y' },
      { id: '1000-free', label: '1000y' },
      { id: '1650-free', label: '1650y' },
    ],
  },
  {
    stroke: 'Backstroke',
    events: [
      { id: '50-back',  label: '50y' },
      { id: '100-back', label: '100y' },
      { id: '200-back', label: '200y' },
    ],
  },
  {
    stroke: 'Breaststroke',
    events: [
      { id: '50-breast',  label: '50y' },
      { id: '100-breast', label: '100y' },
      { id: '200-breast', label: '200y' },
    ],
  },
  {
    stroke: 'Butterfly',
    events: [
      { id: '50-fly',  label: '50y' },
      { id: '100-fly', label: '100y' },
      { id: '200-fly', label: '200y' },
    ],
  },
  {
    stroke: 'Individual Medley',
    events: [
      { id: '100-im', label: '100y' },
      { id: '200-im', label: '200y' },
      { id: '400-im', label: '400y' },
    ],
  },
  {
    stroke: 'Relays',
    events: [
      { id: 'relay-4x50-free',    label: '4Ã—50 Free' },
      { id: 'relay-4x100-free',   label: '4Ã—100 Free' },
      { id: 'relay-4x200-free',   label: '4Ã—200 Free' },
      { id: 'relay-4x100-medley', label: '4Ã—100 Medley' },
    ],
  },
]

type Course = 'SCY' | 'LCM' | 'SCM'
type Times = Record<string, string>
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface AppNotif {
  id: string
  type: 'pb' | 'standard' | 'stale' | 'tip' | 'goal' | 'motivational' | 'birthday' | 'monthly'
  title: string
  message: string
}

const MOTIVATIONAL_QUOTES = [
  { title: 'Hit the water.',          message: 'The lane doesn\'t care how you feel. Get in. Move. You can rest when the set is done.' },
  { title: 'Every 50 counts.',        message: 'Not just race day. Every interval, every turn, every push off the wall â€” it all adds up.' },
  { title: 'Move. Breathe. Repeat.',  message: 'That\'s the whole game. Show up, do the work, recover. Then do it again tomorrow.' },
  { title: 'The wall is the finish.', message: 'Not three feet before it. Swim through to your fingertips. Finish every single length.' },
  { title: 'Close your rings.',       message: 'Attendance is half the battle. You can\'t drop time from the locker room. Get in the water.' },
  { title: 'Splits don\'t lie.',      message: 'The clock shows exactly how hard you went out and where you faded. Use it. Adjust. Get faster.' },
  { title: 'The morning is yours.',   message: 'While most people are still asleep, you\'re putting in the work. That gap closes on race day.' },
  { title: 'One more rep.',           message: 'When the set feels done, do one more. That extra effort is what separates your training from everyone else\'s.' },
  { title: 'Rest is earned.',         message: 'You don\'t skip the hard sets to get to the rest. You earn the rest by finishing the hard sets.' },
  { title: 'Turn faster.',            message: 'A tenth of a second on every turn is two seconds in a 200. The race is won and lost on the walls.' },
  { title: 'Trust the taper.',        message: 'You\'ve done the work. Now let your body absorb it. Trust the process â€” the race will show.' },
  { title: 'Hold your stroke.',       message: 'When you\'re tired is when technique matters most. Don\'t let form fall apart in the last 25.' },
  { title: 'You set the pace.',       message: 'No one else decides how fast you go. You do. Own it from the first stroke.' },
  { title: 'Track every swim.',       message: 'The data doesn\'t lie. Log your times and you\'ll see the pattern â€” effort in, improvement out.' },
  { title: 'Uncomfortable is good.', message: 'If the set feels easy, you\'re not adapting. Growth lives outside your comfort zone.' },
  { title: 'Stand up straight.',      message: 'Posture on the block, posture in the water. Race day starts before the gun fires.' },
  { title: 'Race your own race.',     message: 'Don\'t look left. Don\'t look right. Your lane, your splits, your race.' },
  { title: 'Drop the excuses.',       message: 'Tired? So is everyone else. Cold water? Same temperature for every swimmer. Get after it.' },
  { title: 'Back half is where it\'s won.', message: 'Anyone can go out fast. The swimmers who go faster on the back half â€” those are the ones who train for it.' },
  { title: 'Show up anyway.',         message: 'The best practice you ever do is the one you almost didn\'t go to. Go.' },
]

const MOTIVATIONAL_KEY = 'sw_last_motivational'

function getMotivationalQuote(): AppNotif | null {
  try {
    const stored = JSON.parse(localStorage.getItem(MOTIVATIONAL_KEY) ?? '{}') as { lastShown?: string; idx?: number }
    const now = Date.now()
    const last = stored.lastShown ? new Date(stored.lastShown).getTime() : 0
    const daysSince = (now - last) / 86400000
    if (daysSince < 3.5) return null
    const idx = ((stored.idx ?? 0) + 1) % MOTIVATIONAL_QUOTES.length
    localStorage.setItem(MOTIVATIONAL_KEY, JSON.stringify({ lastShown: new Date().toISOString(), idx }))
    return { id: 'motivational', type: 'motivational', ...MOTIVATIONAL_QUOTES[idx] }
  } catch {
    return null
  }
}

function parseSeconds(t: string): number {
  const parts = t.split(':')
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseFloat(parts[1])
  return parseFloat(t)
}

function getAgeGroup(age: number): string {
  if (age <= 10) return '10 & Under'
  if (age <= 12) return '11-12'
  if (age <= 14) return '13-14'
  if (age <= 16) return '15-16'
  if (age <= 18) return '17-18'
  return 'Senior'
}

function birthdayNotif(dob: string, name: string): AppNotif | null {
  if (!dob) return null
  const today = new Date()
  const birth = new Date(dob + 'T12:00:00')
  const isBirthday =
    today.getMonth() === birth.getMonth() &&
    today.getDate()  === birth.getDate()
  if (!isBirthday) return null

  const age = today.getFullYear() - birth.getFullYear()
  const prevAge = age - 1
  const prevGroup = getAgeGroup(prevAge)
  const newGroup  = getAgeGroup(age)
  const ageGroupChanged = prevGroup !== newGroup

  const first = name.trim().split(' ')[0] || 'Swimmer'
  const msg = ageGroupChanged
    ? `Happy Birthday, ${first}! You're now ${age}. Your qualifying standards have updated to the ${newGroup} age group â€” check Qualifications to see your new cuts.`
    : `Happy Birthday, ${first}! You're ${age} today. Keep training hard â€” another great season ahead! ðŸŽ‰`

  return {
    id: `birthday-${dob}`,
    type: 'birthday',
    title: `Happy Birthday! ðŸŽ‚`,
    message: msg,
  }
}

function goalAchievedNotifs(goals: Goal[], times: Times): AppNotif[] {
  return goals
    .filter(goal => {
      const live = times[`${goal.course}-${goal.eventId}`] || goal.currentTime
      const liveSec = parseSeconds(live)
      const targetSec = parseSeconds(goal.targetTime)
      if (!liveSec || !targetSec) return false
      return liveSec <= targetSec
    })
    .map(goal => ({
      id: `goal-achieved-${goal.id}`,
      type: 'goal' as const,
      title: `Goal achieved â€” ${goal.eventLabel}`,
      message: `You hit your target of ${goal.targetTime} for the ${goal.eventLabel} (${goal.course}). Outstanding work!`,
    }))
}

function monthlyReportNotif(calAttendance: Record<string, unknown>): AppNotif | null {
  const today = new Date()
  if (today.getDate() > 10) return null // only show in first 10 days of month

  const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const year  = prevMonth.getFullYear()
  const month = prevMonth.getMonth() // 0-indexed
  const reportKey = `${year}-${String(month + 1).padStart(2, '0')}`
  const storageKey = 'sw_monthly_report'
  if (localStorage.getItem(storageKey) === reportKey) return null

  let attended = 0, late = 0, absent = 0, cancelled = 0
  for (const [date, day] of Object.entries(calAttendance)) {
    const d = new Date(date + 'T12:00:00')
    if (d.getFullYear() !== year || d.getMonth() !== month) continue
    const dayData = day as { s1?: { status: string } | null; s2?: { status: string } | null }
    for (const s of [dayData?.s1, dayData?.s2]) {
      if (!s) continue
      if (s.status === 'attended')  attended++
      else if (s.status === 'late') late++
      else if (s.status === 'absent') absent++
      else if (s.status === 'cancelled') cancelled++
    }
  }

  const total = attended + late + absent + cancelled
  if (total === 0) return null

  localStorage.setItem(storageKey, reportKey)
  const monthName = prevMonth.toLocaleDateString('en-US', { month: 'long' })
  const rate = Math.round(((attended + late) / total) * 100)
  const parts = [
    `${attended + late} attended`,
    absent    > 0 ? `${absent} absent`    : '',
    cancelled > 0 ? `${cancelled} cancelled` : '',
  ].filter(Boolean).join(', ')

  return {
    id: `monthly-report-${reportKey}`,
    type: 'monthly',
    title: `${monthName} attendance report`,
    message: `${parts} â€” ${rate}% attendance rate across ${total} sessions.`,
  }
}

function generateNotifications(
  times: Times,
  timeHistory: Record<string, { date: string; time: string }[]>,
  notifPrefs: Record<string, boolean>,
  dob: string,
  fullName: string,
  goals: Goal[],
  calAttendance: Record<string, unknown>,
): AppNotif[] {
  const notifs: AppNotif[] = []
  const today = new Date()

  // Birthday (always shown at top when it's their birthday)
  const bday = birthdayNotif(dob, fullName)
  if (bday) notifs.unshift(bday)

  // Goal achievements
  goalAchievedNotifs(goals, times).forEach(n => notifs.push(n))

  // Monthly calendar report (first 10 days of month)
  const monthly = monthlyReportNotif(calAttendance)
  if (monthly) notifs.push(monthly)

  // Stale time warnings
  Object.entries(timeHistory).forEach(([key, entries]) => {
    if (!entries || entries.length === 0) return
    const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const days = Math.floor((today.getTime() - new Date(sorted[0].date).getTime()) / 86400000)
    if (days >= 180) {
      const parts = key.split('-')
      const label = parts.slice(2).join(' ')
      notifs.push({
        id: `stale-${key}`,
        type: 'stale',
        title: 'Stale time detected',
        message: `Your ${label} time hasn't been updated in ${days} days. Consider racing this event soon.`,
      })
    }
  })

  // PB detection â€” most recent vs second-most-recent
  Object.entries(timeHistory).forEach(([key, entries]) => {
    if (!entries || entries.length < 2) return
    const sorted = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const latest = parseSeconds(sorted[0].time)
    const prev   = parseSeconds(sorted[1].time)
    if (latest < prev - 0.05) {
      const parts = key.split('-')
      const label = parts.slice(2).join(' ')
      const drop  = (prev - latest).toFixed(2)
      notifs.push({
        id: `pb-${key}`,
        type: 'pb',
        title: `New personal best â€” ${label}`,
        message: `You dropped ${drop}s on your ${label}. Great swim!`,
      })
    }
  })

  // Tip if no times entered at all
  const hasAny = Object.values(times).some(v => v)
  if (!hasAny) {
    notifs.push({
      id: 'tip-no-times',
      type: 'tip',
      title: 'Get started',
      message: 'Enter your times or import from USA Swimming to unlock comparisons, qualifications, and event planning.',
    })
  }

  // Tip if times exist but no goals set
  if (hasAny && notifs.filter(n => n.type === 'goal').length === 0) {
    notifs.push({
      id: 'tip-set-goals',
      type: 'tip',
      title: 'Set your season goals',
      message: 'Head to Goals and set target times for your key events so SwimSync can track your progress.',
    })
  }

  // Motivational quote (every 3-4 days if enabled)
  if (notifPrefs.motivationalQuotes !== false) {
    const quote = getMotivationalQuote()
    if (quote) notifs.unshift(quote)
  }

  return notifs.slice(0, 15)
}

const NOTIF_ICONS: Record<AppNotif['type'], typeof Bell> = {
  pb:           Zap,
  standard:     Star,
  stale:        Clock,
  tip:          Bell,
  goal:         Target,
  motivational: Star,
  birthday:     Star,
  monthly:      CalendarCheck,
}

const NOTIF_COLORS: Record<AppNotif['type'], string> = {
  pb:           '#059669',
  standard:     '#d97706',
  stale:        '#ea580c',
  tip:          '#0891b2',
  goal:         '#7c3aed',
  motivational: '#0369a1',
  birthday:     '#db2777',
  monthly:      '#0891b2',
}

function calcAge(dob: string): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
  return age
}

// Formats raw digits into MM:SS.ss / M:SS.ss / SS.ss as the user types.
// Works right-to-left: last 2 digits are always hundredths, next 2 are seconds, rest is minutes.
function formatTimeDigits(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 6)
  switch (d.length) {
    case 0: return ''
    case 1:
    case 2: return d
    case 3: return `${d[0]}.${d.slice(1)}`
    case 4: return `${d.slice(0, 2)}.${d.slice(2)}`
    case 5: return `${d[0]}:${d.slice(1, 3)}.${d.slice(3)}`
    case 6: return `${d.slice(0, 2)}:${d.slice(2, 4)}.${d.slice(4)}`
    default: return d
  }
}

// Returns true if the seconds portion of a formatted time is 00â€“59.
function isValidTime(value: string): boolean {
  if (value.length <= 2) return true // still typing
  const match = value.match(/(?:^|:)(\d{2})\./)
  if (!match) return true
  return parseInt(match[1], 10) <= 59
}


export default function Dashboard() {
  const navigate = useNavigate()
  const [username,    setUsername]    = useState('')
  const [fullName,    setFullName]    = useState('')
  const [gender,      setGender]      = useState('')
  const [age,         setAge]         = useState<number | null>(null)
  const [avatarUrl,   setAvatarUrl]   = useState('')
  const [bannerType,  setBannerType]  = useState('default')
  const [bannerValue, setBannerValue] = useState('')
  const [course,      setCourse]      = useState<Course>('SCY')
  const [editing,     setEditing]     = useState(false)
  const [times,       setTimes]       = useState<Times>({})
  const [saveStatus,  setSaveStatus]  = useState<SaveStatus>('idle')
  const [showNotifs,  setShowNotifs]  = useState(false)
  const [timeHistory, setTimeHistory] = useState<Record<string, { date: string; time: string }[]>>({})
  const [timeDate,    setTimeDate]    = useState(new Date().toISOString().slice(0, 10))
  const [dob,         setDob]         = useState('')
  const [notifPrefs,     setNotifPrefs]     = useState<Record<string, boolean>>({ motivationalQuotes: true })
  const [goals,          setGoals]          = useState<Goal[]>([])
  const [calAttendance,  setCalAttendance]  = useState<Record<string, unknown>>({})
  const [followCounts,   setFollowCounts]   = useState({ followers: 0, following: 0 })
  const [readIds,     setReadIds]     = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('sw_read_notifs') ?? '[]')) }
    catch { return new Set() }
  })
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('sw_onboarded')
  )
  const [importBannerDismissed, setImportBannerDismissed] = useState(
    () => localStorage.getItem('sw_import_banner_dismissed') === '1'
  )
  const [showTC,          setShowTC]          = useState(false)
  const [avatarSheet,     setAvatarSheet]     = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarFileRef = useRef<HTMLInputElement>(null)
  const userIdRef     = useRef('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    setAvatarSheet(false)
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 256; canvas.height = 256
        const ctx = canvas.getContext('2d')!
        const side = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
    setAvatarUrl(dataUrl)
    await supabase.auth.updateUser({ data: { avatar_url: dataUrl } })
    setAvatarUploading(false)
    if (avatarFileRef.current) avatarFileRef.current.value = ''
  }

  async function removeAvatar() {
    setAvatarSheet(false)
    setAvatarUrl('')
    await supabase.auth.updateUser({ data: { avatar_url: '' } })
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      if (!user) { navigate('/'); return }
      userIdRef.current = user.id
      setUsername(user.user_metadata?.username || user.email || 'Swimmer')
      setFullName(user.user_metadata?.full_name || '')
      setGender(user.user_metadata?.gender || '')
      setDob(user.user_metadata?.dob || '')
      setAge(calcAge(user.user_metadata?.dob || ''))
      setAvatarUrl(user.user_metadata?.avatar_url || '')
      setBannerType(user.user_metadata?.bannerType || 'default')
      setBannerValue(user.user_metadata?.bannerValue || '')
      setTimes(user.user_metadata?.times || {})
      setTimeHistory(user.user_metadata?.timeHistory || {})
      if (user.user_metadata?.notifPrefs) setNotifPrefs(user.user_metadata.notifPrefs)
      setGoals(user.user_metadata?.goals || [])
      setCalAttendance(user.user_metadata?.calAttendance || {})
      getFollowCounts(user.id).then(counts => setFollowCounts(counts))
      // Ensure public profile row exists
      upsertProfile({
        id:          user.id,
        username:    user.user_metadata?.username || user.email || '',
        full_name:   user.user_metadata?.full_name  || null,
        avatar_url:  user.user_metadata?.avatar_url || null,
        gender:      user.user_metadata?.gender      || null,
        club_team:   user.user_metadata?.club_team   || null,
        high_school: user.user_metadata?.high_school || null,
        times:       user.user_metadata?.times       || {},
      })
    })
  }, [navigate])

  const notifications = generateNotifications(times, timeHistory, notifPrefs, dob, fullName, goals, calAttendance)
  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length

  function markAllRead() {
    const next = new Set([...readIds, ...notifications.map(n => n.id)])
    setReadIds(next)
    localStorage.setItem('sw_read_notifs', JSON.stringify([...next]))
  }

  function dismissNotif(id: string) {
    const next = new Set([...readIds, id])
    setReadIds(next)
    localStorage.setItem('sw_read_notifs', JSON.stringify([...next]))
  }

  const persistTimes = useCallback((nextTimes: Times) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSaveStatus('saving')
    debounceRef.current = setTimeout(async () => {
      const { error } = await supabase.auth.updateUser({ data: { times: nextTimes } })
      if (error) { setSaveStatus('error'); return }
      setSaveStatus('saved')
      playSave()
      setTimeout(() => setSaveStatus('idle'), 2000)
      // Sync public profile so friends can see updated times
      if (userIdRef.current) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          upsertProfile({
            id:          user.id,
            username:    user.user_metadata?.username || user.email || '',
            full_name:   user.user_metadata?.full_name  || null,
            avatar_url:  user.user_metadata?.avatar_url || null,
            gender:      user.user_metadata?.gender      || null,
            club_team:   user.user_metadata?.club_team   || null,
            high_school: user.user_metadata?.high_school || null,
            times:       nextTimes,
          })
        }
      }
    }, 700)
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  const groups = course === 'SCY' ? SCY_EVENTS : LCM_EVENTS

  function timeKey(c: Course, eventId: string) {
    return `${c}-${eventId}`
  }

  function handleTimeChange(eventId: string, raw: string) {
    const formatted = formatTimeDigits(raw)
    const key = timeKey(course, eventId)
    setTimes(prev => {
      const next = { ...prev, [key]: formatted }
      persistTimes(next)
      return next
    })
    if (formatted && isValidTime(formatted)) {
      setTimeHistory(prev => {
        const arr = [...(prev[key] ?? [])]
        const date = timeDate || 'unknown'
        const idx = arr.findIndex(e => e.date === date)
        if (idx >= 0) arr[idx] = { date, time: formatted }
        else arr.push({ date, time: formatted })
        const next = { ...prev, [key]: arr }
        supabase.auth.updateUser({ data: { timeHistory: next } })
        return next
      })
    }
  }

  return (
    <>
    {showOnboarding && (
      <OnboardingModal
        name={fullName.split(' ')[0]}
        onDone={() => {
          localStorage.setItem('sw_onboarded', '1')
          setShowOnboarding(false)
        }}
      />
    )}
    <TimeConverterPopup isOpen={showTC} onClose={() => setShowTC(false)} />

    {/* â”€â”€ Avatar action sheet (Instagram-style) â”€â”€ */}
    {avatarSheet && (
      <div className="dash-avatar-sheet-overlay" onClick={() => setAvatarSheet(false)}>
        <div className="dash-avatar-sheet" onClick={e => e.stopPropagation()}>
          <div className="dash-avatar-sheet-title">Change Profile Photo</div>
          <button className="dash-avatar-sheet-btn dash-avatar-sheet-btn--upload"
            onClick={() => avatarFileRef.current?.click()}>
            Upload Photo
          </button>
          {avatarUrl && (
            <button className="dash-avatar-sheet-btn dash-avatar-sheet-btn--remove"
              onClick={removeAvatar}>
              Remove Current Photo
            </button>
          )}
          <button className="dash-avatar-sheet-btn" onClick={() => setAvatarSheet(false)}>
            Cancel
          </button>
        </div>
      </div>
    )}

    <div className="dash-layout">

      {/* â”€â”€ Sidebar â”€â”€ */}
      <aside className="dash-sidebar">
        {/* Profile + settings gear pinned at top */}
        <div className="dash-profile">
          <div className="dash-avatar">
            {avatarUrl
              ? <img src={avatarUrl} alt="Profile" className="dash-avatar-img" />
              : <User size={30} />
            }
          </div>
          <span className="dash-username">{fullName || username || 'â€”'}</span>
          <div className="dash-badges">
            {age !== null && <span className="dash-age">Age {age}</span>}
            {gender && <span className={`dash-gender dash-gender--${gender}`}>{gender === 'male' ? 'Male' : 'Female'}</span>}
          </div>
          <div className="dash-profile-actions">
            <button className="dash-settings-icon" onClick={() => { playNavigate(); navigate('/settings') }} title="Settings">
              <Settings size={15} />
              <span>Settings</span>
            </button>
            <button className="dash-settings-icon" onClick={() => { playNavigate(); navigate('/import') }} title="Import Times">
              <Upload size={15} />
              <span>Import</span>
            </button>
          </div>
        </div>

        {/* Scrollable nav */}
        <nav className="dash-nav-scroll">

        <button className="dash-compare" onClick={() => { playNavigate(); navigate('/compare') }}>
          <span className="dash-compare-icon">â‡Œ</span>
          <span>Compare Standards</span>
        </button>

        <button className="dash-competitions" onClick={() => { playNavigate(); navigate('/qualifications') }}>
          <Trophy size={16} />
          <span>Competitions</span>
        </button>

        <button className="dash-goals" onClick={() => { playNavigate(); navigate('/goals') }}>
          <Target size={16} />
          <span>Goals</span>
        </button>

        <button className="dash-progress" onClick={() => { playNavigate(); navigate('/progress') }}>
          <TrendingUp size={16} />
          <span>Progress</span>
        </button>

        <button className="dash-calendar" onClick={() => { playNavigate(); navigate('/calendar') }}>
          <CalendarCheck size={16} />
          <span>Calendar</span>
        </button>

        <button className="dash-race-library" onClick={() => { playNavigate(); navigate('/race-library') }}>
          <Film size={16} />
          <span>Media Library</span>
        </button>

        </nav>
      </aside>

      {/* â”€â”€ Main â”€â”€ */}
      <main className="dash-main">

        {/* â”€â”€ Profile header (SwimCloud style) â”€â”€ */}
        <div className="dash-profile-header">

          {/* Banner strip */}
          <div className="dash-banner-strip" style={
            (bannerType === 'canvas' || bannerType === 'photo') && bannerValue
              ? { backgroundImage: `url(${bannerValue})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : (bannerType === 'gradient' || bannerType === 'color') && bannerValue
              ? { background: bannerValue }
              : undefined
          }>
            <div className="dash-banner-actions">
              <button
                className="dash-bell-btn"
                onClick={() => { setShowNotifs(s => !s); if (!showNotifs) markAllRead() }}
                aria-label="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="dash-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>
              <img src="/logos/scs.svg" alt="Southern California Swimming" className="scs-logo-corner" />
            </div>
          </div>

          {/* Profile bar */}
          <div className="dash-profile-bar">
            <button
              className={`dash-banner-avatar-wrap dash-avatar-clickable${avatarUploading ? ' dash-avatar-uploading' : ''}`}
              onClick={() => setAvatarSheet(true)}
              title="Change profile photo"
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" className="dash-banner-avatar-img" />
                : <span className="dash-banner-avatar-initials">
                    {(fullName || username || 'S').charAt(0).toUpperCase()}
                  </span>
              }
              <span className="dash-avatar-camera-overlay">
                {avatarUploading ? 'â€¦' : 'ðŸ“·'}
              </span>
            </button>
            <input ref={avatarFileRef} type="file" accept="image/*" hidden onChange={handleAvatarFile} />
            <div className="dash-profile-meta">
              <h1 className="dash-welcome">{fullName || username || 'â€¦'}</h1>
              <p className="dash-profile-sub">
                {[
                  age !== null ? `Age ${age}` : null,
                  gender ? (gender === 'male' ? 'Male' : 'Female') : null,
                  course,
                  'Southern California Swimming',
                ].filter(Boolean).join(' Â· ')}
              </p>
              <div className="dash-follow-stats">
                <button className="dash-follow-stat" onClick={() => navigate('/friends?tab=followers')}>
                  <strong>{followCounts.followers}</strong> followers
                </button>
                <span className="dash-follow-dot">Â·</span>
                <button className="dash-follow-stat" onClick={() => navigate('/friends?tab=following')}>
                  <strong>{followCounts.following}</strong> following
                </button>
              </div>
            </div>
            <button
              className="dash-profile-signout"
              onClick={() => { playClick(); handleSignOut() }}
              title="Sign out"
            >
              <LogOut size={15} />
              <span>Sign out</span>
            </button>
          </div>
        </div>

        {/* â”€â”€ Notifications panel â”€â”€ */}
        {showNotifs && (
          <div className="notifs-panel">
            <div className="notifs-header">
              <span className="notifs-title">Notifications</span>
              <button className="notifs-close" onClick={() => setShowNotifs(false)}>
                <X size={16} />
              </button>
            </div>
            {notifications.length === 0 ? (
              <p className="notifs-empty">You're all caught up!</p>
            ) : (
              <ul className="notifs-list">
                {notifications.map(n => {
                  const Icon = NOTIF_ICONS[n.type]
                  const color = NOTIF_COLORS[n.type]
                  const isRead = readIds.has(n.id)
                  return (
                    <li key={n.id} className={`notif-item${isRead ? ' read' : ''}`}>
                      <span className="notif-icon" style={{ color, background: `${color}18` }}>
                        <Icon size={15} />
                      </span>
                      <div className="notif-body">
                        <p className="notif-title">{n.title}</p>
                        <p className="notif-msg">{n.message}</p>
                      </div>
                      <button
                        className="notif-dismiss"
                        onClick={() => dismissNotif(n.id)}
                        aria-label="Dismiss"
                      >
                        <X size={13} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {/* â”€â”€ Import warning â”€â”€ */}
        {!importBannerDismissed && Object.keys(timeHistory).length < 3 && (
          <div className="dash-import-banner">
            <div className="dash-import-banner-body">
              <strong>Set up your swim history to unlock all features</strong>
              <p>
                Features like the <strong>Progress Tracker</strong> only work if your full career history is imported.
                Without it, charts and trends will be empty or incomplete.
                Sign into <strong>Swimcloud</strong> or <strong>USA Swimming</strong>, copy your full times history,
                and paste it in <strong>Import Times</strong> â€” it will automatically fill in Progress and everywhere else.
              </p>
              <button
                className="dash-import-banner-btn"
                onClick={() => { playNavigate(); navigate('/import') }}
              >
                Import Times â†’
              </button>
            </div>
            <button
              className="dash-import-banner-close"
              onClick={() => {
                setImportBannerDismissed(true)
                localStorage.setItem('sw_import_banner_dismissed', '1')
              }}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* â”€â”€ Times Panel â”€â”€ */}
        <section className="times-panel">
          <div className="times-toolbar">
            <div className="times-toolbar-left">
              <span className="times-panel-title">Personal Bests</span>
            </div>
            <div className="times-tabs">
              <button
                className={`times-tab${course === 'SCY' ? ' active' : ''}`}
                onClick={() => setCourse('SCY')}
              >
                SCY
              </button>
              <button
                className={`times-tab${course === 'LCM' ? ' active' : ''}`}
                onClick={() => setCourse('LCM')}
              >
                LCM
              </button>
              <button
                className={`times-tab${course === 'SCM' ? ' active' : ''}`}
                onClick={() => setCourse('SCM')}
              >
                SCM
              </button>
            </div>

            <div className="toolbar-right">
              {editing && (
                <span className={`save-status save-status--${saveStatus}`}>
                  {saveStatus === 'saving' && 'Savingâ€¦'}
                  {saveStatus === 'saved'  && 'âœ“ Saved'}
                  {saveStatus === 'error'  && 'Error saving'}
                </span>
              )}
              <button
                className={`edit-btn${editing ? ' active' : ''}`}
                onClick={() => setEditing(e => !e)}
              >
                {editing ? <Check size={15} /> : <Pencil size={15} />}
                {editing ? 'Done' : 'Edit'}
              </button>
            </div>
          </div>

          {editing && (
            <div className="times-format-hint">
              Type <strong>numbers only</strong> â€” the <strong>:</strong> and <strong>.</strong> are placed automatically.
              &thinsp; Example: type <code>10234</code> to get <strong>1:02.34</strong>.
              &thinsp; Seconds must be 00â€“59.
            </div>
          )}

          {editing && (
            <div className="times-date-row">
              <label className="times-date-label">Date of these times</label>
              <input
                type="date"
                className="times-date-input"
                value={timeDate}
                onChange={e => setTimeDate(e.target.value)}
              />
              <span className="times-date-hint">Used to log entries in Progress Tracker</span>
            </div>
          )}

          <div className="times-grid">
            {groups.map(({ stroke, events }) => (
              <div
                key={stroke}
                className={`stroke-group${stroke === 'Relays' ? ' stroke-group--relay' : ''}`}
              >
                <h3 className="stroke-heading">{stroke}</h3>
                <div className={stroke === 'Relays' ? 'stroke-relay-events' : undefined}>
                {events.map(({ id, label }) => (
                  <div key={id} className="event-row">
                    <span className="event-label">{label}</span>
                    {editing ? (
                      <input
                        className={`time-input${isValidTime(times[timeKey(course, id)] ?? '') ? '' : ' time-input--error'}`}
                        placeholder="e.g. 10234"
                        value={times[timeKey(course, id)] ?? ''}
                        onChange={e => handleTimeChange(id, e.target.value)}
                      />
                    ) : (
                      <span className="time-value">
                        {times[timeKey(course, id)] || 'â€”'}
                      </span>
                    )}
                  </div>
                ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* TODO: Add Calendar, Meet Comparison, Progress Chart sections here */}

      </main>

      {/* â”€â”€ Mobile bottom nav â”€â”€ */}
      <nav className="dash-mobile-nav">
        <button className="dash-mobile-nav-btn" onClick={() => { playNavigate(); navigate('/compare') }}>
          <Trophy size={20} />
          Compare
        </button>
        <button className="dash-mobile-nav-btn" onClick={() => { playNavigate(); navigate('/qualifications') }}>
          <Star size={20} />
          Quals
        </button>

        <button className="dash-mobile-nav-btn" onClick={() => { playNavigate(); navigate('/goals') }}>
          <Target size={20} />
          Goals
        </button>
        <button className="dash-mobile-nav-btn" onClick={() => { playNavigate(); navigate('/settings') }}>
          <Settings size={20} />
          Settings
        </button>
        <button className="dash-mobile-nav-btn" onClick={() => { playNavigate(); navigate('/calendar') }}>
          <CalendarCheck size={20} />
          Calendar
        </button>
      </nav>
    </div>
    </>
  )
}

