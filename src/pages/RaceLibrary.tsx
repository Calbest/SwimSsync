import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, Plus, X, Camera, Video, ChevronLeft, Trash2, Save, ArrowRightLeft, Image } from 'lucide-react'
import { supabase } from '../lib/supabase'
import TimeConverterPopup from '../components/TimeConverterPopup'
import './RaceLibrary.css'

// ─── Types ──────────────────────────────────────────────────────────────────

type Course = 'SCY' | 'LCM' | 'SCM'

interface RaceEntry {
  id: string
  kind: 'race'
  eventLabel: string
  course: Course
  date: string
  time: string
  videoUrl: string
  splits: string[]
  notes: string
  coachFeedback: string
  photoUrls: string[]
  createdAt: string
}

interface GeneralEntry {
  id: string
  kind: 'media'
  title: string
  category: string
  date: string
  description: string
  videoUrl: string
  photoUrls: string[]
  createdAt: string
}

type MediaEntry = RaceEntry | GeneralEntry

// ─── Constants ───────────────────────────────────────────────────────────────

const EVENTS = [
  '50 Free','100 Free','200 Free','500 Free','1000 Free','1650 Free',
  '50 Back','100 Back','200 Back',
  '50 Breast','100 Breast','200 Breast',
  '50 Fly','100 Fly','200 Fly',
  '100 IM','200 IM','400 IM',
]

const CATEGORIES = ['Group Photo', 'Award', 'Certificate', 'Team Event', 'Other']

function splitCount(eventLabel: string): number {
  const m = eventLabel.match(/^(\d+)/)
  if (!m) return 0
  return Math.ceil(parseInt(m[1]) / 50)
}

function formatTimeDigits(raw: string): string {
  const d = raw.replace(/\D/g,'').slice(0,6)
  switch(d.length){
    case 0: return ''
    case 1: case 2: return d
    case 3: return `${d[0]}.${d.slice(1)}`
    case 4: return `${d.slice(0,2)}.${d.slice(2)}`
    case 5: return `${d[0]}:${d.slice(1,3)}.${d.slice(3)}`
    case 6: return `${d.slice(0,2)}:${d.slice(2,4)}.${d.slice(4)}`
    default: return d
  }
}

// ─── Photo uploader hook ─────────────────────────────────────────────────────

function usePhotoUpload(userId: string, entryId: string) {
  const ref = useRef<HTMLInputElement>(null)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [uploading,  setUploading] = useState(false)

  async function handlePhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    const newUrls: string[] = []
    for (const file of files) {
      const ext  = file.name.split('.').pop()
      const path = `${userId}/${entryId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('race-photos').upload(path, file, { upsert: true })
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('race-photos').getPublicUrl(path)
        newUrls.push(publicUrl)
      }
    }
    setPhotoUrls(prev => [...prev, ...newUrls])
    setUploading(false)
  }

  return { ref, photoUrls, setPhotoUrls, uploading, handlePhotos }
}

// ─── Race form ───────────────────────────────────────────────────────────────

function RaceForm({ initial, userId, onSave, onCancel }: {
  initial: Partial<RaceEntry>
  userId: string
  onSave: (e: RaceEntry) => void
  onCancel: () => void
}) {
  const entryId = initial.id ?? 'new'
  const { ref: photoRef, photoUrls, setPhotoUrls, uploading, handlePhotos } = usePhotoUpload(userId, entryId)
  const [eventLabel,    setEventLabel]    = useState(initial.eventLabel    ?? '50 Free')
  const [course,        setCourse]        = useState<Course>(initial.course ?? 'SCY')
  const [date,          setDate]          = useState(initial.date          ?? new Date().toISOString().slice(0,10))
  const [time,          setTime]          = useState(initial.time          ?? '')
  const [videoUrl,      setVideoUrl]      = useState(initial.videoUrl      ?? '')
  const [splits,        setSplits]        = useState<string[]>(initial.splits ?? [])
  const [notes,         setNotes]         = useState(initial.notes         ?? '')
  const [coachFeedback, setCoachFeedback] = useState(initial.coachFeedback ?? '')

  // init photos from existing entry
  useEffect(() => { if (initial.photoUrls) setPhotoUrls(initial.photoUrls) }, [])

  const numSplits = splitCount(eventLabel)

  function save() {
    onSave({
      id: initial.id ?? crypto.randomUUID(),
      kind: 'race',
      eventLabel, course, date, time, videoUrl,
      splits: splits.slice(0, numSplits).filter(Boolean),
      notes, coachFeedback, photoUrls,
      createdAt: initial.createdAt ?? new Date().toISOString(),
    })
  }

  return (
    <div className="rl-form">
      <div className="rl-form-row">
        <div className="rl-field">
          <label className="rl-label">Event</label>
          <select className="rl-select" value={eventLabel} onChange={e => setEventLabel(e.target.value)}>
            {EVENTS.map(ev => <option key={ev}>{ev}</option>)}
          </select>
        </div>
        <div className="rl-field">
          <label className="rl-label">Course</label>
          <div className="rl-course-tabs">
            {(['SCY','LCM','SCM'] as Course[]).map(c => (
              <button key={c} className={`rl-course-tab${course===c?' active':''}`} onClick={() => setCourse(c)}>{c}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="rl-form-row">
        <div className="rl-field">
          <label className="rl-label">Date</label>
          <input type="date" className="rl-input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="rl-field">
          <label className="rl-label">Time</label>
          <input className="rl-input" placeholder="e.g. 5234 → 52.34" value={time} onChange={e => setTime(formatTimeDigits(e.target.value))} />
        </div>
      </div>
      {numSplits > 0 && (
        <div className="rl-field">
          <label className="rl-label">Splits <span className="rl-label-hint">one per 50{course==='SCY'?'y':'m'}</span></label>
          <div className="rl-splits-grid">
            {Array.from({length: numSplits}, (_, i) => (
              <div key={i} className="rl-split-cell">
                <span className="rl-split-label">{(i+1)*50}{course==='SCY'?'y':'m'}</span>
                <input className="rl-input rl-input--split" placeholder="—" value={splits[i] ?? ''}
                  onChange={e => { const n=[...splits]; n[i]=formatTimeDigits(e.target.value); setSplits(n) }} />
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="rl-field">
        <label className="rl-label"><Video size={13} /> Race Video <span className="rl-label-hint">YouTube, Vimeo, or direct link</span></label>
        <input className="rl-input" placeholder="https://youtube.com/watch?v=..." value={videoUrl} onChange={e => setVideoUrl(e.target.value)} />
      </div>
      <div className="rl-field">
        <label className="rl-label">Notes</label>
        <textarea className="rl-textarea" rows={3} placeholder="How did the race feel? What went well?" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <div className="rl-field">
        <label className="rl-label">Coach Feedback</label>
        <textarea className="rl-textarea" rows={3} placeholder="What did your coach say?" value={coachFeedback} onChange={e => setCoachFeedback(e.target.value)} />
      </div>
      <div className="rl-field">
        <label className="rl-label"><Camera size={13} /> Photos of Times</label>
        <button className="rl-photo-btn" onClick={() => photoRef.current?.click()} disabled={uploading}>
          <Camera size={15} />{uploading ? 'Uploading…' : 'Add Photos'}
        </button>
        <input ref={photoRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={handlePhotos} />
        {photoUrls.length > 0 && (
          <div className="rl-photos-grid">
            {photoUrls.map(url => (
              <div key={url} className="rl-photo-wrap">
                <img src={url} alt="" className="rl-photo" />
                <button className="rl-photo-del" onClick={() => setPhotoUrls(p => p.filter(u => u!==url))}><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rl-form-actions">
        <button className="rl-btn-cancel" onClick={onCancel}>Cancel</button>
        <button className="rl-btn-save" onClick={save} disabled={!date}>
          <Save size={14} />Save Media
        </button>
      </div>
    </div>
  )
}

// ─── General media form ───────────────────────────────────────────────────────

function MediaForm({ initial, userId, onSave, onCancel }: {
  initial: Partial<GeneralEntry>
  userId: string
  onSave: (e: GeneralEntry) => void
  onCancel: () => void
}) {
  const entryId = initial.id ?? 'new'
  const { ref: photoRef, photoUrls, setPhotoUrls, uploading, handlePhotos } = usePhotoUpload(userId, entryId)
  const [title,       setTitle]       = useState(initial.title       ?? '')
  const [category,    setCategory]    = useState(initial.category    ?? 'Group Photo')
  const [date,        setDate]        = useState(initial.date        ?? new Date().toISOString().slice(0,10))
  const [description, setDescription] = useState(initial.description ?? '')
  const [videoUrl,    setVideoUrl]    = useState(initial.videoUrl    ?? '')

  useEffect(() => { if (initial.photoUrls) setPhotoUrls(initial.photoUrls) }, [])

  function save() {
    onSave({
      id: initial.id ?? crypto.randomUUID(),
      kind: 'media',
      title, category, date, description, videoUrl, photoUrls,
      createdAt: initial.createdAt ?? new Date().toISOString(),
    })
  }

  return (
    <div className="rl-form">
      <div className="rl-form-row">
        <div className="rl-field">
          <label className="rl-label">Title</label>
          <input className="rl-input" placeholder="e.g. State Championship 2025" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="rl-field">
          <label className="rl-label">Category</label>
          <select className="rl-select" value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="rl-field">
        <label className="rl-label">Date</label>
        <input type="date" className="rl-input" value={date} onChange={e => setDate(e.target.value)} />
      </div>
      <div className="rl-field">
        <label className="rl-label">Description</label>
        <textarea className="rl-textarea" rows={3} placeholder="What is this? Any context or memories?" value={description} onChange={e => setDescription(e.target.value)} />
      </div>
      <div className="rl-field">
        <label className="rl-label"><Video size={13} /> Video <span className="rl-label-hint">optional</span></label>
        <input className="rl-input" placeholder="https://youtube.com/watch?v=..." value={videoUrl} onChange={e => setVideoUrl(e.target.value)} />
      </div>
      <div className="rl-field">
        <label className="rl-label"><Image size={13} /> Photos</label>
        <button className="rl-photo-btn" onClick={() => photoRef.current?.click()} disabled={uploading}>
          <Camera size={15} />{uploading ? 'Uploading…' : 'Add Photos'}
        </button>
        <input ref={photoRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={handlePhotos} />
        {photoUrls.length > 0 && (
          <div className="rl-photos-grid">
            {photoUrls.map(url => (
              <div key={url} className="rl-photo-wrap">
                <img src={url} alt="" className="rl-photo" />
                <button className="rl-photo-del" onClick={() => setPhotoUrls(p => p.filter(u => u!==url))}><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rl-form-actions">
        <button className="rl-btn-cancel" onClick={onCancel}>Cancel</button>
        <button className="rl-btn-save" onClick={save} disabled={!title.trim() || !date}>
          <Save size={14} />Save Media
        </button>
      </div>
    </div>
  )
}

// ─── Sidebar (shared across views) ───────────────────────────────────────────

function Sidebar({ onTC }: { onTC: () => void }) {
  const navigate = useNavigate()
  return (
    <aside className="rl-sidebar">
      <div className="rl-sidebar-brand">Media Library</div>
      <nav className="rl-sidebar-nav">
        <button className="rl-nav-btn" onClick={() => navigate('/dashboard')}>
          <LayoutDashboard size={16} /><span>Dashboard</span>
        </button>
        <button className="rl-nav-btn" onClick={onTC}>
          <ArrowRightLeft size={16} /><span>Time Converter</span>
        </button>
      </nav>
    </aside>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RaceLibrary() {
  const navigate  = useNavigate()
  const [entries,  setEntries]  = useState<MediaEntry[]>([])
  const [userId,   setUserId]   = useState('')
  const [view,     setView]     = useState<'list' | 'pick' | 'add-race' | 'add-media' | 'detail'>('list')
  const [selected, setSelected] = useState<MediaEntry | null>(null)
  const [editing,  setEditing]  = useState(false)
  const [showTC,   setShowTC]   = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      if (!user) { navigate('/'); return }
      setUserId(user.id)
      // Support old entries that have no `kind` — treat as race
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: MediaEntry[] = (user.user_metadata?.raceLibrary ?? []).map((e: any) =>
        e?.kind ? e : { ...e, kind: 'race' }
      )
      setEntries(raw)
    })
  }, [navigate])

  async function persist(next: MediaEntry[]) {
    setEntries(next)
    await supabase.auth.updateUser({ data: { raceLibrary: next } })
  }

  async function handleSave(entry: MediaEntry) {
    const next = entries.some(e => e.id === entry.id)
      ? entries.map(e => e.id === entry.id ? entry : e)
      : [...entries, entry]
    await persist(next)
    setSelected(entry)
    setView('detail')
    setEditing(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this entry?')) return
    await persist(entries.filter(e => e.id !== id))
    setView('list')
    setSelected(null)
  }

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date))

  // ── List ──────────────────────────────────────────────────────────────────

  if (view === 'list') return (
    <div className="rl-layout">
      <TimeConverterPopup isOpen={showTC} onClose={() => setShowTC(false)} />
      <Sidebar onTC={() => setShowTC(true)} />
      <div className="rl-page">
        <div className="rl-header">
          <div>
            <h1 className="rl-title">Media Library</h1>
            <p className="rl-subtitle">Races, group photos, awards, and more</p>
          </div>
          <img src="/logos/scs.svg" alt="SCS" className="scs-logo-corner" />
        </div>
        <div className="rl-body">
          <button className="rl-add-btn" onClick={() => setView('pick')}>
            <Plus size={16} /> Add Media
          </button>
          {sorted.length === 0 ? (
            <div className="rl-empty">
              <Camera size={40} className="rl-empty-icon" />
              <p>Nothing here yet. Add your first entry above.</p>
            </div>
          ) : (
            <div className="rl-cards">
              {sorted.map(entry => (
                <div key={entry.id} className="rl-card" onClick={() => { setSelected(entry); setView('detail') }}>
                  {entry.photoUrls[0] && <img src={entry.photoUrls[0]} alt="" className="rl-card-thumb" />}
                  <div className="rl-card-body">
                    {entry.kind === 'race' ? (
                      <>
                        <div className="rl-card-event">{entry.eventLabel} · {entry.course}</div>
                        <div className="rl-card-time">{entry.time || '—'}</div>
                      </>
                    ) : (
                      <>
                        <div className="rl-card-event">{entry.title}</div>
                        <div className="rl-card-category">{entry.category}</div>
                      </>
                    )}
                    <div className="rl-card-date">{entry.date}</div>
                    <div className="rl-card-tags">
                      <span className={`rl-tag rl-tag--kind-${entry.kind}`}>{entry.kind === 'race' ? 'Race' : 'Media'}</span>
                      {entry.videoUrl && <span className="rl-tag rl-tag--video">Video</span>}
                      {entry.photoUrls.length > 0 && <span className="rl-tag rl-tag--photo">{entry.photoUrls.length} photo{entry.photoUrls.length!==1?'s':''}</span>}
                      {entry.kind === 'race' && entry.notes && <span className="rl-tag">Notes</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ── Type picker ───────────────────────────────────────────────────────────

  if (view === 'pick') return (
    <div className="rl-layout">
      <TimeConverterPopup isOpen={showTC} onClose={() => setShowTC(false)} />
      <Sidebar onTC={() => setShowTC(true)} />
      <div className="rl-page">
        <div className="rl-header">
          <button className="rl-back-btn" onClick={() => setView('list')}><ChevronLeft size={16} /> Back</button>
          <h1 className="rl-title">Add Media</h1>
          <img src="/logos/scs.svg" alt="SCS" className="scs-logo-corner" />
        </div>
        <div className="rl-body">
          <p className="rl-pick-label">What would you like to add?</p>
          <div className="rl-pick-grid">
            <button className="rl-pick-card" onClick={() => setView('add-race')}>
              <Video size={28} className="rl-pick-icon" />
              <span className="rl-pick-name">Race / Swim</span>
              <span className="rl-pick-desc">Event, time, splits, video, coach feedback</span>
            </button>
            <button className="rl-pick-card" onClick={() => setView('add-media')}>
              <Image size={28} className="rl-pick-icon" />
              <span className="rl-pick-name">Photos &amp; Awards</span>
              <span className="rl-pick-desc">Group photos, awards, certificates, team events</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Add race ──────────────────────────────────────────────────────────────

  if (view === 'add-race') return (
    <div className="rl-layout">
      <TimeConverterPopup isOpen={showTC} onClose={() => setShowTC(false)} />
      <Sidebar onTC={() => setShowTC(true)} />
      <div className="rl-page">
        <div className="rl-header">
          <button className="rl-back-btn" onClick={() => setView('pick')}><ChevronLeft size={16} /> Back</button>
          <h1 className="rl-title">Add Race</h1>
          <img src="/logos/scs.svg" alt="SCS" className="scs-logo-corner" />
        </div>
        <div className="rl-body">
          <div className="rl-form-card">
            <RaceForm initial={{}} userId={userId} onSave={handleSave} onCancel={() => setView('pick')} />
          </div>
        </div>
      </div>
    </div>
  )

  // ── Add media ─────────────────────────────────────────────────────────────

  if (view === 'add-media') return (
    <div className="rl-layout">
      <TimeConverterPopup isOpen={showTC} onClose={() => setShowTC(false)} />
      <Sidebar onTC={() => setShowTC(true)} />
      <div className="rl-page">
        <div className="rl-header">
          <button className="rl-back-btn" onClick={() => setView('pick')}><ChevronLeft size={16} /> Back</button>
          <h1 className="rl-title">Add Photos &amp; Awards</h1>
          <img src="/logos/scs.svg" alt="SCS" className="scs-logo-corner" />
        </div>
        <div className="rl-body">
          <div className="rl-form-card">
            <MediaForm initial={{}} userId={userId} onSave={handleSave} onCancel={() => setView('pick')} />
          </div>
        </div>
      </div>
    </div>
  )

  // ── Detail ────────────────────────────────────────────────────────────────

  const entry = selected!
  return (
    <div className="rl-layout">
      <TimeConverterPopup isOpen={showTC} onClose={() => setShowTC(false)} />
      <Sidebar onTC={() => setShowTC(true)} />
      <div className="rl-page">
        <div className="rl-header">
          <button className="rl-back-btn" onClick={() => { setView('list'); setEditing(false) }}>
            <ChevronLeft size={16} /> All Media
          </button>
          <h1 className="rl-title">
            {entry.kind === 'race' ? `${entry.eventLabel} · ${entry.course}` : entry.title}
          </h1>
          <div className="rl-detail-actions">
            <button className="rl-edit-btn" onClick={() => setEditing(e => !e)}>{editing ? 'Cancel Edit' : 'Edit'}</button>
            <button className="rl-delete-btn" onClick={() => handleDelete(entry.id)}><Trash2 size={14} /></button>
          </div>
          <img src="/logos/scs.svg" alt="SCS" className="scs-logo-corner" />
        </div>
        <div className="rl-body">
          {editing ? (
            <div className="rl-form-card">
              {entry.kind === 'race'
                ? <RaceForm initial={entry} userId={userId} onSave={handleSave} onCancel={() => setEditing(false)} />
                : <MediaForm initial={entry} userId={userId} onSave={handleSave} onCancel={() => setEditing(false)} />
              }
            </div>
          ) : entry.kind === 'race' ? (
            <div className="rl-detail">
              <div className="rl-detail-meta">
                <span className="rl-detail-date">{entry.date}</span>
                <span className="rl-detail-time">{entry.time || '—'}</span>
              </div>
              {entry.videoUrl && (
                <div className="rl-detail-section">
                  <h3 className="rl-detail-heading">Race Video</h3>
                  <a href={entry.videoUrl} target="_blank" rel="noopener noreferrer" className="rl-video-link">
                    <Video size={16} /> Watch Video
                  </a>
                </div>
              )}
              {entry.splits.length > 0 && (
                <div className="rl-detail-section">
                  <h3 className="rl-detail-heading">Splits</h3>
                  <div className="rl-splits-display">
                    {entry.splits.map((s, i) => (
                      <div key={i} className="rl-split-display-cell">
                        <span className="rl-split-display-label">{(i+1)*50}{entry.course==='SCY'?'y':'m'}</span>
                        <span className="rl-split-display-val">{s || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {entry.notes && (
                <div className="rl-detail-section">
                  <h3 className="rl-detail-heading">Notes</h3>
                  <p className="rl-detail-text">{entry.notes}</p>
                </div>
              )}
              {entry.coachFeedback && (
                <div className="rl-detail-section">
                  <h3 className="rl-detail-heading">Coach Feedback</h3>
                  <p className="rl-detail-text">{entry.coachFeedback}</p>
                </div>
              )}
              {entry.photoUrls.length > 0 && (
                <div className="rl-detail-section">
                  <h3 className="rl-detail-heading">Photos</h3>
                  <div className="rl-photos-grid">
                    {entry.photoUrls.map(url => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="" className="rl-photo" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {!entry.videoUrl && !entry.notes && !entry.coachFeedback && !entry.splits.length && !entry.photoUrls.length && (
                <p className="rl-detail-empty">No details yet — click Edit to add video, splits, notes, or photos.</p>
              )}
            </div>
          ) : (
            <div className="rl-detail">
              <div className="rl-detail-meta">
                <span className="rl-detail-date">{entry.date}</span>
                <span className="rl-tag rl-tag--kind-media" style={{fontSize:13,padding:'4px 10px'}}>{entry.category}</span>
              </div>
              {entry.description && (
                <div className="rl-detail-section">
                  <h3 className="rl-detail-heading">Description</h3>
                  <p className="rl-detail-text">{entry.description}</p>
                </div>
              )}
              {entry.videoUrl && (
                <div className="rl-detail-section">
                  <h3 className="rl-detail-heading">Video</h3>
                  <a href={entry.videoUrl} target="_blank" rel="noopener noreferrer" className="rl-video-link">
                    <Video size={16} /> Watch Video
                  </a>
                </div>
              )}
              {entry.photoUrls.length > 0 && (
                <div className="rl-detail-section">
                  <h3 className="rl-detail-heading">Photos</h3>
                  <div className="rl-photos-grid">
                    {entry.photoUrls.map(url => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="" className="rl-photo" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {!entry.description && !entry.videoUrl && !entry.photoUrls.length && (
                <p className="rl-detail-empty">No details yet — click Edit to add photos or a description.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
