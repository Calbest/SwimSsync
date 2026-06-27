import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, Plus, X, Camera, Video, ChevronLeft, Trash2, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import TimeConverterPopup from '../components/TimeConverterPopup'
import './RaceLibrary.css'

// ─── Types ──────────────────────────────────────────────────────────────────

type Course = 'SCY' | 'LCM' | 'SCM'

interface RaceEntry {
  id: string
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

const EVENTS = [
  '50 Free','100 Free','200 Free','500 Free','1000 Free','1650 Free',
  '50 Back','100 Back','200 Back',
  '50 Breast','100 Breast','200 Breast',
  '50 Fly','100 Fly','200 Fly',
  '100 IM','200 IM','400 IM',
]

function splitCount(eventLabel: string): number {
  const m = eventLabel.match(/^(\d+)/)
  if (!m) return 0
  const dist = parseInt(m[1])
  return Math.ceil(dist / 50)
}

// ─── Detail / Edit view ─────────────────────────────────────────────────────

function RaceForm({
  initial,
  userId,
  onSave,
  onCancel,
}: {
  initial: Partial<RaceEntry>
  userId: string
  onSave: (r: RaceEntry) => void
  onCancel: () => void
}) {
  const photoRef = useRef<HTMLInputElement>(null)
  const [eventLabel,    setEventLabel]    = useState(initial.eventLabel    ?? '50 Free')
  const [course,        setCourse]        = useState<Course>(initial.course ?? 'SCY')
  const [date,          setDate]          = useState(initial.date          ?? new Date().toISOString().slice(0,10))
  const [time,          setTime]          = useState(initial.time          ?? '')
  const [videoUrl,      setVideoUrl]      = useState(initial.videoUrl      ?? '')
  const [splits,        setSplits]        = useState<string[]>(initial.splits ?? [])
  const [notes,         setNotes]         = useState(initial.notes         ?? '')
  const [coachFeedback, setCoachFeedback] = useState(initial.coachFeedback ?? '')
  const [photoUrls,     setPhotoUrls]     = useState<string[]>(initial.photoUrls ?? [])
  const [uploading,     setUploading]     = useState(false)
  const [saving,        setSaving]        = useState(false)

  const numSplits = splitCount(eventLabel)

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

  function updateSplit(i: number, raw: string) {
    const next = [...splits]
    next[i] = formatTimeDigits(raw)
    setSplits(next)
  }

  async function handlePhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    const newUrls: string[] = []
    for (const file of files) {
      const ext  = file.name.split('.').pop()
      const path = `${userId}/${initial.id ?? 'new'}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('race-photos').upload(path, file, { upsert: true })
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('race-photos').getPublicUrl(path)
        newUrls.push(publicUrl)
      }
    }
    setPhotoUrls(prev => [...prev, ...newUrls])
    setUploading(false)
  }

  function removePhoto(url: string) {
    setPhotoUrls(prev => prev.filter(u => u !== url))
  }

  function handleSave() {
    setSaving(true)
    const entry: RaceEntry = {
      id:           initial.id ?? crypto.randomUUID(),
      eventLabel,
      course,
      date,
      time,
      videoUrl,
      splits:       splits.slice(0, numSplits).filter(Boolean),
      notes,
      coachFeedback,
      photoUrls,
      createdAt:    initial.createdAt ?? new Date().toISOString(),
    }
    onSave(entry)
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
        <div className="rl-field rl-field--sm">
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

      {/* Splits */}
      {numSplits > 0 && (
        <div className="rl-field">
          <label className="rl-label">Splits <span className="rl-label-hint">one per 50{course==='SCY'?'y':'m'}</span></label>
          <div className="rl-splits-grid">
            {Array.from({length: numSplits}, (_, i) => (
              <div key={i} className="rl-split-cell">
                <span className="rl-split-label">{(i+1)*50}{course==='SCY'?'y':'m'}</span>
                <input className="rl-input rl-input--split" placeholder="—" value={splits[i] ?? ''} onChange={e => updateSplit(i, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video */}
      <div className="rl-field">
        <label className="rl-label"><Video size={13} /> Race Video <span className="rl-label-hint">YouTube, Vimeo, or direct link</span></label>
        <input className="rl-input" placeholder="https://youtube.com/watch?v=..." value={videoUrl} onChange={e => setVideoUrl(e.target.value)} />
      </div>

      {/* Notes */}
      <div className="rl-field">
        <label className="rl-label">Notes</label>
        <textarea className="rl-textarea" rows={3} placeholder="How did the race feel? What went well?" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {/* Coach feedback */}
      <div className="rl-field">
        <label className="rl-label">Coach Feedback</label>
        <textarea className="rl-textarea" rows={3} placeholder="What did your coach say?" value={coachFeedback} onChange={e => setCoachFeedback(e.target.value)} />
      </div>

      {/* Photos */}
      <div className="rl-field">
        <label className="rl-label"><Camera size={13} /> Photos of Times</label>
        <button className="rl-photo-btn" onClick={() => photoRef.current?.click()} disabled={uploading}>
          <Camera size={15} />
          {uploading ? 'Uploading…' : 'Add Photos'}
        </button>
        <input ref={photoRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={handlePhotos} />
        {photoUrls.length > 0 && (
          <div className="rl-photos-grid">
            {photoUrls.map(url => (
              <div key={url} className="rl-photo-wrap">
                <img src={url} alt="Race photo" className="rl-photo" />
                <button className="rl-photo-del" onClick={() => removePhoto(url)}><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rl-form-actions">
        <button className="rl-btn-cancel" onClick={onCancel}>Cancel</button>
        <button className="rl-btn-save" onClick={handleSave} disabled={saving || !date}>
          <Save size={14} />
          {saving ? 'Saving…' : 'Save Race'}
        </button>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function RaceLibrary() {
  const navigate  = useNavigate()
  const [races,    setRaces]    = useState<RaceEntry[]>([])
  const [userId,   setUserId]   = useState('')
  const [view,     setView]     = useState<'list' | 'add' | 'detail'>('list')
  const [selected, setSelected] = useState<RaceEntry | null>(null)
  const [editing,  setEditing]  = useState(false)
  const [showTC,   setShowTC]   = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      if (!user) { navigate('/'); return }
      setUserId(user.id)
      setRaces(user.user_metadata?.raceLibrary ?? [])
    })
  }, [navigate])

  async function persist(next: RaceEntry[]) {
    setRaces(next)
    await supabase.auth.updateUser({ data: { raceLibrary: next } })
  }

  async function handleSave(entry: RaceEntry) {
    const next = races.some(r => r.id === entry.id)
      ? races.map(r => r.id === entry.id ? entry : r)
      : [...races, entry]
    await persist(next)
    setSelected(entry)
    setView('detail')
    setEditing(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this race entry?')) return
    await persist(races.filter(r => r.id !== id))
    setView('list')
    setSelected(null)
  }

  const sorted = [...races].sort((a, b) => b.date.localeCompare(a.date))

  // ── List ────────────────────────────────────────────────────────────────

  if (view === 'list') return (
    <div className="rl-layout">
      <TimeConverterPopup isOpen={showTC} onClose={() => setShowTC(false)} />
      <aside className="rl-sidebar">
        <div className="rl-sidebar-brand">Race Library</div>
        <nav className="rl-sidebar-nav">
          <button className="rl-nav-btn" onClick={() => navigate('/dashboard')}>
            <LayoutDashboard size={16} /><span>Dashboard</span>
          </button>
        </nav>
      </aside>

      <div className="rl-page">
        <div className="rl-header">
          <div>
            <h1 className="rl-title">Race Library</h1>
            <p className="rl-subtitle">Videos, splits, notes, and photos from every race</p>
          </div>
          <img src="/logos/scs.svg" alt="SCS" className="scs-logo-corner" />
        </div>

        <div className="rl-body">
          <button className="rl-add-btn" onClick={() => setView('add')}>
            <Plus size={16} /> Add Race
          </button>

          {sorted.length === 0 ? (
            <div className="rl-empty">
              <Camera size={40} className="rl-empty-icon" />
              <p>No races yet. Add your first race above.</p>
            </div>
          ) : (
            <div className="rl-cards">
              {sorted.map(r => (
                <div key={r.id} className="rl-card" onClick={() => { setSelected(r); setView('detail') }}>
                  {r.photoUrls[0] && <img src={r.photoUrls[0]} alt="" className="rl-card-thumb" />}
                  <div className="rl-card-body">
                    <div className="rl-card-event">{r.eventLabel} · {r.course}</div>
                    <div className="rl-card-time">{r.time || '—'}</div>
                    <div className="rl-card-date">{r.date}</div>
                    <div className="rl-card-tags">
                      {r.videoUrl    && <span className="rl-tag rl-tag--video">Video</span>}
                      {r.photoUrls.length > 0 && <span className="rl-tag rl-tag--photo">{r.photoUrls.length} photo{r.photoUrls.length!==1?'s':''}</span>}
                      {r.notes       && <span className="rl-tag">Notes</span>}
                      {r.coachFeedback && <span className="rl-tag">Coach</span>}
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

  // ── Add ──────────────────────────────────────────────────────────────────

  if (view === 'add') return (
    <div className="rl-layout">
      <TimeConverterPopup isOpen={showTC} onClose={() => setShowTC(false)} />
      <aside className="rl-sidebar">
        <div className="rl-sidebar-brand">Race Library</div>
        <nav className="rl-sidebar-nav">
          <button className="rl-nav-btn" onClick={() => navigate('/dashboard')}>
            <LayoutDashboard size={16} /><span>Dashboard</span>
          </button>
        </nav>
      </aside>
      <div className="rl-page">
        <div className="rl-header">
          <button className="rl-back-btn" onClick={() => setView('list')}><ChevronLeft size={16} /> Back</button>
          <h1 className="rl-title">Add Race</h1>
          <img src="/logos/scs.svg" alt="SCS" className="scs-logo-corner" />
        </div>
        <div className="rl-body">
          <div className="rl-form-card">
            <RaceForm initial={{}} userId={userId} onSave={handleSave} onCancel={() => setView('list')} />
          </div>
        </div>
      </div>
    </div>
  )

  // ── Detail ───────────────────────────────────────────────────────────────

  const r = selected!
  return (
    <div className="rl-layout">
      <TimeConverterPopup isOpen={showTC} onClose={() => setShowTC(false)} />
      <aside className="rl-sidebar">
        <div className="rl-sidebar-brand">Race Library</div>
        <nav className="rl-sidebar-nav">
          <button className="rl-nav-btn" onClick={() => navigate('/dashboard')}>
            <LayoutDashboard size={16} /><span>Dashboard</span>
          </button>
        </nav>
      </aside>
      <div className="rl-page">
        <div className="rl-header">
          <button className="rl-back-btn" onClick={() => { setView('list'); setEditing(false) }}><ChevronLeft size={16} /> All Races</button>
          <h1 className="rl-title">{r.eventLabel} · {r.course}</h1>
          <div className="rl-detail-actions">
            <button className="rl-edit-btn" onClick={() => setEditing(e => !e)}>{editing ? 'Cancel Edit' : 'Edit'}</button>
            <button className="rl-delete-btn" onClick={() => handleDelete(r.id)}><Trash2 size={14} /></button>
          </div>
          <img src="/logos/scs.svg" alt="SCS" className="scs-logo-corner" />
        </div>

        <div className="rl-body">
          {editing ? (
            <div className="rl-form-card">
              <RaceForm initial={r} userId={userId} onSave={handleSave} onCancel={() => setEditing(false)} />
            </div>
          ) : (
            <div className="rl-detail">
              <div className="rl-detail-meta">
                <span className="rl-detail-date">{r.date}</span>
                <span className="rl-detail-time">{r.time || '—'}</span>
              </div>

              {r.videoUrl && (
                <div className="rl-detail-section">
                  <h3 className="rl-detail-heading">Race Video</h3>
                  <a href={r.videoUrl} target="_blank" rel="noopener noreferrer" className="rl-video-link">
                    <Video size={16} /> Watch Video
                  </a>
                </div>
              )}

              {r.splits.length > 0 && (
                <div className="rl-detail-section">
                  <h3 className="rl-detail-heading">Splits</h3>
                  <div className="rl-splits-display">
                    {r.splits.map((s, i) => (
                      <div key={i} className="rl-split-display-cell">
                        <span className="rl-split-display-label">{(i+1)*50}{r.course==='SCY'?'y':'m'}</span>
                        <span className="rl-split-display-val">{s || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {r.notes && (
                <div className="rl-detail-section">
                  <h3 className="rl-detail-heading">Notes</h3>
                  <p className="rl-detail-text">{r.notes}</p>
                </div>
              )}

              {r.coachFeedback && (
                <div className="rl-detail-section">
                  <h3 className="rl-detail-heading">Coach Feedback</h3>
                  <p className="rl-detail-text">{r.coachFeedback}</p>
                </div>
              )}

              {r.photoUrls.length > 0 && (
                <div className="rl-detail-section">
                  <h3 className="rl-detail-heading">Photos</h3>
                  <div className="rl-photos-grid">
                    {r.photoUrls.map(url => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="Race photo" className="rl-photo" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {!r.videoUrl && !r.notes && !r.coachFeedback && !r.splits.length && !r.photoUrls.length && (
                <p className="rl-detail-empty">No details yet — click Edit to add video, splits, notes, or photos.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
