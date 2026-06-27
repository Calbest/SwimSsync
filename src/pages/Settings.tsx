import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, User, RotateCcw, Eraser, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './Settings.css'

type SaveStatus  = 'idle' | 'saving' | 'saved' | 'error'
type ResetStep   = 'idle' | 'code_sent'
type ResetStatus = 'idle' | 'loading' | 'success' | 'error'
type BannerType  = 'default' | 'gradient' | 'color' | 'canvas' | 'photo'

const GRADIENT_PRESETS = [
  { label: 'SwimSync (Default)', value: 'radial-gradient(ellipse at 10% 80%, rgba(99,102,241,0.7) 0%, transparent 45%), radial-gradient(ellipse at 55% 30%, rgba(14,165,233,0.65) 0%, transparent 50%), radial-gradient(ellipse at 95% 10%, rgba(6,182,212,0.8) 0%, transparent 45%), linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #0284c7 100%)' },
  { label: 'Ocean',          value: 'linear-gradient(135deg, #0369a1 0%, #001a3d 100%)' },
  { label: 'Sunset',         value: 'linear-gradient(135deg, #f97316 0%, #dc2626 55%, #9333ea 100%)' },
  { label: 'Forest',         value: 'linear-gradient(135deg, #166534 0%, #052e16 100%)' },
  { label: 'Purple Rain',    value: 'linear-gradient(135deg, #7c3aed 0%, #1e1b4b 100%)' },
  { label: 'Midnight',       value: 'linear-gradient(180deg, #0f172a 0%, #334155 100%)' },
  { label: 'Rose',           value: 'linear-gradient(135deg, #f43f5e 0%, #881337 100%)' },
  { label: 'Aurora',         value: 'linear-gradient(135deg, #059669 0%, #0891b2 50%, #7c3aed 100%)' },
  { label: 'Sky',            value: 'linear-gradient(180deg, #0ea5e9 0%, #0c4a6e 100%)' },
  { label: 'Ember',          value: 'linear-gradient(135deg, #f59e0b 0%, #b91c1c 100%)' },
]

const COLOR_PRESETS = [
  '#002855', '#0369a1', '#7c3aed', '#166534',
  '#b91c1c', '#c2410c', '#be185d', '#0f172a',
]

const CANVAS_BG_FROM = '#001a3d'
const CANVAS_BG_TO   = '#002855'

function formatBirthday(isoDate: string): string {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-')
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December']
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`
}

export default function Settings() {
  const navigate   = useNavigate()
  const fileInput      = useRef<HTMLInputElement>(null)
  const bannerPhotoRef = useRef<HTMLInputElement>(null)
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastPos    = useRef<{ x: number; y: number } | null>(null)

  // Profile
  const [fullName,      setFullName]     = useState('')
  const [gender,        setGender]       = useState('')
  const [dob,           setDob]          = useState('')
  const [clubTeam,      setClubTeam]     = useState('')
  const [highSchool,    setHighSchool]   = useState('')
  const [profileStatus, setProfileStatus] = useState<SaveStatus>('idle')

  // Account
  const [userId,   setUserId]   = useState('')
  const [email,    setEmail]    = useState('')
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<SaveStatus>('idle')
  const [emailStatus,    setEmailStatus]    = useState<SaveStatus>('idle')

  // Contact
  const [phone,       setPhone]       = useState('')
  const [phoneStatus, setPhoneStatus] = useState<SaveStatus>('idle')

  // Avatar
  const [avatarUrl,     setAvatarUrl]     = useState('')
  const [avatarPreview, setAvatarPreview] = useState('')
  const [avatarStatus,  setAvatarStatus]  = useState<'idle'|'uploading'|'saved'|'error'>('idle')

  // Banner
  const [bannerType,   setBannerType]   = useState<BannerType>('default')
  const [bannerValue,  setBannerValue]  = useState('')
  const [bannerTab,    setBannerTab]    = useState<'colors' | 'paint' | 'photo'>('colors')
  const [bannerStatus, setBannerStatus] = useState<SaveStatus>('idle')
  const [brushColor,   setBrushColor]   = useState('#7ee8ff')
  const [brushSize,    setBrushSize]    = useState(12)
  const [isEraser,     setIsEraser]     = useState(false)

  // Active tab
  const [settingsTab, setSettingsTab] = useState<'profile' | 'account' | 'tutorial'>('profile')
  const [tutSlide,    setTutSlide]    = useState(0)

  // Notifications
  const [notifPrefs, setNotifPrefs] = useState({
    personalBests:       true,
    swimMeetReminder:    true,
    weeklyProgress:      true,
    goalAchieved:        true,
    streakMilestone:     true,
    trainingTips:        false,
    newFeatures:         true,
    motivationalQuotes:  true,
  })
  const [notifStatus, setNotifStatus] = useState<SaveStatus>('idle')

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteStatus,  setDeleteStatus]  = useState<'idle'|'loading'|'error'>('idle')
  const [deleteError,   setDeleteError]   = useState('')

  // Password reset
  const [resetStep,   setResetStep]   = useState<ResetStep>('idle')
  const [resetStatus, setResetStatus] = useState<ResetStatus>('idle')
  const [resetError,  setResetError]  = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPass, setConfirmPass] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      if (!user) { navigate('/'); return }
      const m = user.user_metadata ?? {}
      setUserId(user.id)
      setEmail(user.email ?? '')
      setUsername(m.username ?? '')
      setFullName(m.full_name ?? '')
      setGender(m.gender ?? '')
      setDob(m.dob ?? '')
      setClubTeam(m.club_team ?? '')
      setHighSchool(m.high_school ?? '')
      setPhone(m.phone ?? '')
      setAvatarUrl(m.avatar_url ?? '')
      setBannerType((m.bannerType as BannerType) ?? 'default')
      setBannerValue(m.bannerValue ?? '')
      if (m.notifPrefs) setNotifPrefs(prev => ({ ...prev, ...m.notifPrefs }))
    })
  }, [navigate])

  // ── Canvas helpers ────────────────────────────────────────────────────────

  function fillCanvasBg(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height)
    g.addColorStop(0, CANVAS_BG_FROM)
    g.addColorStop(1, CANVAS_BG_TO)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  function initCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    if (bannerType === 'canvas' && bannerValue) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      img.src = bannerValue
    } else {
      fillCanvasBg(ctx, canvas)
    }
  }

  useEffect(() => {
    if (bannerTab !== 'paint') return
    const t = setTimeout(initCanvas, 30)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bannerTab])

  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const r = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top)  * (canvas.height / r.height),
    }
  }

  function getTouchCanvasPos(e: React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const r = canvas.getBoundingClientRect()
    const t = e.touches[0]
    return {
      x: (t.clientX - r.left) * (canvas.width / r.width),
      y: (t.clientY - r.top)  * (canvas.height / r.height),
    }
  }

  function paintLine(from: { x: number; y: number }, to: { x: number; y: number }) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = isEraser ? CANVAS_BG_FROM : brushColor
    ctx.lineWidth   = isEraser ? brushSize * 2.5 : brushSize
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    drawingRef.current = true
    lastPos.current = getCanvasPos(e)
  }
  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !lastPos.current) return
    const pos = getCanvasPos(e)
    paintLine(lastPos.current, pos)
    lastPos.current = pos
  }
  function onMouseUp()    { drawingRef.current = false; lastPos.current = null }
  function onMouseLeave() { drawingRef.current = false; lastPos.current = null }

  function onTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    drawingRef.current = true
    lastPos.current = getTouchCanvasPos(e)
  }
  function onTouchMove(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (!drawingRef.current || !lastPos.current) return
    const pos = getTouchCanvasPos(e)
    paintLine(lastPos.current, pos)
    lastPos.current = pos
  }
  function onTouchEnd() { drawingRef.current = false; lastPos.current = null }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    fillCanvasBg(canvas.getContext('2d')!, canvas)
  }

  async function saveColorBanner(type: 'default' | 'gradient' | 'color', value = '') {
    setBannerStatus('saving')
    await supabase.auth.updateUser({ data: { bannerType: type, bannerValue: value } })
    setBannerType(type)
    setBannerValue(value)
    setBannerStatus('saved')
    setTimeout(() => setBannerStatus('idle'), 2000)
  }

  async function saveCanvasBanner() {
    const canvas = canvasRef.current
    if (!canvas) return
    setBannerStatus('saving')
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    await supabase.auth.updateUser({ data: { bannerType: 'canvas', bannerValue: dataUrl } })
    setBannerType('canvas')
    setBannerValue(dataUrl)
    setBannerStatus('saved')
    setTimeout(() => setBannerStatus('idle'), 2000)
  }

  function handleBannerPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBannerStatus('saving')
    const reader = new FileReader()
    reader.onload = async ev => {
      const dataUrl = ev.target?.result as string
      await supabase.auth.updateUser({ data: { bannerType: 'photo', bannerValue: dataUrl } })
      setBannerType('photo')
      setBannerValue(dataUrl)
      setBannerStatus('saved')
      setTimeout(() => setBannerStatus('idle'), 2000)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // current banner CSS for live preview
  const bannerPreviewStyle: React.CSSProperties =
    (bannerType === 'canvas' || bannerType === 'photo') && bannerValue
      ? { backgroundImage: `url(${bannerValue})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : (bannerType === 'gradient' || bannerType === 'color') && bannerValue
      ? { background: bannerValue }
      : { background: 'linear-gradient(180deg, #001a3d 0%, #002855 100%)' }

  async function saveProfile() {
    setProfileStatus('saving')
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName.trim(), gender, dob, club_team: clubTeam.trim(), high_school: highSchool.trim() },
    })
    if (error) { setProfileStatus('error'); return }
    setProfileStatus('saved')
    setTimeout(() => setProfileStatus('idle'), 2500)
  }

  async function saveUsername() {
    setUsernameStatus('saving')
    const { error } = await supabase.auth.updateUser({ data: { username } })
    if (error) { setUsernameStatus('error'); return }
    setUsernameStatus('saved')
    setTimeout(() => setUsernameStatus('idle'), 2500)
  }

  async function saveEmail() {
    setEmailStatus('saving')
    const { error } = await supabase.auth.updateUser({ email })
    if (error) { setEmailStatus('error'); return }
    setEmailStatus('saved')
    setTimeout(() => setEmailStatus('idle'), 4000)
  }

  async function savePhone() {
    setPhoneStatus('saving')
    const { error } = await supabase.auth.updateUser({ data: { phone } })
    if (error) { setPhoneStatus('error'); return }
    setPhoneStatus('saved')
    setTimeout(() => setPhoneStatus('idle'), 2500)
  }

  async function saveNotifPrefs() {
    setNotifStatus('saving')
    const { error } = await supabase.auth.updateUser({ data: { notifPrefs } })
    if (error) { setNotifStatus('error'); return }
    setNotifStatus('saved')
    setTimeout(() => setNotifStatus('idle'), 2500)
  }

  function toggleNotif(key: keyof typeof notifPrefs) {
    setNotifPrefs(p => ({ ...p, [key]: !p[key] }))
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setAvatarStatus('uploading')

    // Resize to 256×256 JPEG via canvas — no Storage bucket required
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 256; canvas.height = 256
        const ctx = canvas.getContext('2d')!
        // Crop to square from center
        const side = Math.min(img.width, img.height)
        const sx = (img.width  - side) / 2
        const sy = (img.height - side) / 2
        ctx.drawImage(img, sx, sy, side, side, 0, 0, 256, 256)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })

    setAvatarPreview(dataUrl)
    const { error: updateErr } = await supabase.auth.updateUser({ data: { avatar_url: dataUrl } })
    if (updateErr) { console.error('Avatar save error:', updateErr); setAvatarStatus('error'); return }
    setAvatarUrl(dataUrl)
    setAvatarStatus('saved')
    setTimeout(() => setAvatarStatus('idle'), 2500)
  }

  async function sendResetEmail() {
    setResetStatus('loading')
    setResetError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    })
    if (error) { setResetError(error.message); setResetStatus('error'); return }
    setResetStep('code_sent')
    setResetStatus('idle')
  }

  async function changePassword() {
    if (newPassword !== confirmPass) { setResetError('Passwords do not match.'); return }
    if (newPassword.length < 6) { setResetError('Password must be at least 6 characters.'); return }
    setResetStatus('loading')
    setResetError('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setResetError(error.message); setResetStatus('error'); return }
    setResetStatus('success')
    setResetStep('idle')
    setNewPassword('')
    setConfirmPass('')
  }

  async function deleteAccount() {
    setDeleteStatus('loading')
    setDeleteError('')
    const { error } = await supabase.rpc('delete_user')
    if (error) {
      setDeleteError(error.message)
      setDeleteStatus('error')
      return
    }
    await supabase.auth.signOut()
    navigate('/')
  }

  const displayAvatar = avatarPreview || avatarUrl

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div className="settings-header-top">
          <button className="settings-back" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={16} />
            Dashboard
          </button>
          <h1 className="settings-title">Settings</h1>
          <img src="/logos/scs.svg" alt="Southern California Swimming" className="scs-logo-corner" />
        </div>
        <div className="settings-tabs">
          <button
            className={`settings-tab${settingsTab === 'profile' ? ' active' : ''}`}
            onClick={() => setSettingsTab('profile')}
          >
            Profile
          </button>
          <button
            className={`settings-tab${settingsTab === 'account' ? ' active' : ''}`}
            onClick={() => setSettingsTab('account')}
          >
            Account &amp; Security
          </button>
          <button
            className={`settings-tab${settingsTab === 'tutorial' ? ' active' : ''}`}
            onClick={() => setSettingsTab('tutorial')}
          >
            Tutorial
          </button>
        </div>
      </div>

      <div className="settings-body">

        {settingsTab === 'profile' && <>

        {/* ── Profile Picture ── */}
        <section className="settings-card">
          <h2 className="settings-section-title">Profile Picture</h2>
          <div className="avatar-section">
            <button className="avatar-picker" onClick={() => fileInput.current?.click()}>
              {displayAvatar
                ? <img src={displayAvatar} alt="Profile" className="avatar-img" />
                : <User size={36} className="avatar-icon" />
              }
              <div className="avatar-overlay">
                <Camera size={18} />
                <span>Change</span>
              </div>
            </button>
            <input ref={fileInput} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
            <div className="avatar-meta">
              <p className="settings-hint">Click your photo to choose a new one from your library.</p>
              <p className="settings-hint muted">JPG, PNG, GIF — max 5 MB</p>
              {avatarStatus === 'uploading' && <p className="status-info">Uploading…</p>}
              {avatarStatus === 'saved'     && <p className="status-success">Photo updated!</p>}
              {avatarStatus === 'error'     && (
                <p className="status-error">
                  Could not save photo. Please try again or choose a smaller image.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Banner Customization ── */}
        <section className="settings-card">
          <h2 className="settings-section-title">Dashboard Banner</h2>

          {/* Live preview */}
          <div className="banner-preview" style={bannerPreviewStyle}>
            <span className="banner-preview-label">Welcome, {fullName || 'You'}</span>
          </div>

          {/* Mode tabs */}
          <div className="banner-mode-tabs">
            <button
              className={`banner-mode-tab${bannerTab === 'colors' ? ' active' : ''}`}
              onClick={() => setBannerTab('colors')}
            >Color &amp; Gradients</button>
            <button
              className={`banner-mode-tab${bannerTab === 'paint' ? ' active' : ''}`}
              onClick={() => setBannerTab('paint')}
            >Paint Your Own</button>
            <button
              className={`banner-mode-tab${bannerTab === 'photo' ? ' active' : ''}`}
              onClick={() => setBannerTab('photo')}
            >Upload Photo</button>
          </div>

          {/* ── Colors tab ── */}
          {bannerTab === 'colors' && (
            <div className="banner-colors-panel">
              <div className="banner-sub-label">Gradient Presets</div>
              <div className="banner-gradient-grid">
                {GRADIENT_PRESETS.map(p => (
                  <button
                    key={p.value}
                    className={`banner-gradient-swatch${bannerType === 'gradient' && bannerValue === p.value ? ' selected' : ''}`}
                    style={{ background: p.value }}
                    title={p.label}
                    onClick={() => saveColorBanner('gradient', p.value)}
                  />
                ))}
              </div>

              <div className="banner-sub-label" style={{ marginTop: 16 }}>Solid Colors</div>
              <div className="banner-solid-row">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c}
                    className={`banner-solid-swatch${bannerType === 'color' && bannerValue === c ? ' selected' : ''}`}
                    style={{ background: c }}
                    title={c}
                    onClick={() => saveColorBanner('color', c)}
                  />
                ))}
                {/* Custom color wheel */}
                <label className="banner-color-wheel-btn" title="Pick any color">
                  🎨
                  <input
                    type="color"
                    value={bannerType === 'color' && bannerValue.startsWith('#') ? bannerValue : '#002855'}
                    onChange={e => saveColorBanner('color', e.target.value)}
                    hidden
                  />
                </label>
              </div>

              <button
                className="banner-reset-btn"
                onClick={() => saveColorBanner('default')}
              >
                <RotateCcw size={13} />
                Reset to Default
              </button>
            </div>
          )}

          {/* ── Paint tab ── */}
          {bannerTab === 'paint' && (
            <div className="banner-paint-panel">
              <canvas
                ref={canvasRef}
                className="banner-canvas"
                width={800}
                height={180}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseLeave}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              />

              <div className="banner-paint-toolbar">
                <label className="banner-tool-group">
                  <span className="banner-tool-label">Color</span>
                  <input
                    type="color"
                    value={brushColor}
                    onChange={e => { setBrushColor(e.target.value); setIsEraser(false) }}
                    className="banner-brush-color"
                  />
                </label>

                <label className="banner-tool-group">
                  <span className="banner-tool-label">Size&nbsp;{brushSize}px</span>
                  <input
                    type="range"
                    min={3}
                    max={48}
                    value={brushSize}
                    onChange={e => setBrushSize(Number(e.target.value))}
                    className="banner-size-slider"
                  />
                </label>

                <button
                  className={`banner-tool-btn${isEraser ? ' active' : ''}`}
                  onClick={() => setIsEraser(e => !e)}
                >
                  <Eraser size={14} />
                  Eraser
                </button>

                <button className="banner-tool-btn" onClick={clearCanvas}>
                  <RotateCcw size={14} />
                  Clear
                </button>

                <button
                  className="banner-save-canvas-btn"
                  onClick={saveCanvasBanner}
                  disabled={bannerStatus === 'saving'}
                >
                  <Save size={14} />
                  {bannerStatus === 'saving' ? 'Saving…' : bannerStatus === 'saved' ? 'Saved!' : 'Save Banner'}
                </button>
              </div>
              <p className="banner-paint-hint">Draw on the canvas above — this will become your dashboard banner.</p>
            </div>
          )}

          {/* ── Photo tab ── */}
          {bannerTab === 'photo' && (
            <div className="banner-photo-panel">
              <input
                ref={bannerPhotoRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleBannerPhoto}
              />

              {bannerType === 'photo' && bannerValue ? (
                <div className="banner-photo-current">
                  <img src={bannerValue} alt="Current banner" className="banner-photo-thumb" />
                  <div className="banner-photo-actions">
                    <button
                      className="banner-photo-upload-btn"
                      onClick={() => bannerPhotoRef.current?.click()}
                      disabled={bannerStatus === 'saving'}
                    >
                      Replace Photo
                    </button>
                    <button
                      className="banner-reset-btn"
                      onClick={() => saveColorBanner('default')}
                    >
                      <RotateCcw size={13} />
                      Remove
                    </button>
                  </div>
                  {bannerStatus === 'saved' && <p className="status-success">Banner saved!</p>}
                  {bannerStatus === 'saving' && <p className="status-info">Saving…</p>}
                </div>
              ) : (
                <button
                  className="banner-photo-drop-btn"
                  onClick={() => bannerPhotoRef.current?.click()}
                  disabled={bannerStatus === 'saving'}
                >
                  <span className="banner-photo-drop-icon">🖼️</span>
                  <span>{bannerStatus === 'saving' ? 'Saving…' : 'Choose a photo from your library'}</span>
                  <span className="banner-photo-drop-hint">JPG, PNG, WEBP — recommended 1200 × 280 px</span>
                </button>
              )}
            </div>
          )}

          {bannerTab === 'colors' && bannerStatus === 'saved' && (
            <p className="status-success" style={{ marginTop: 10 }}>Banner saved!</p>
          )}
        </section>

        {/* ── Profile Info ── */}
        <section className="settings-card">
          <h2 className="settings-section-title">Profile</h2>

          <div className="settings-row" style={{ alignItems: 'flex-start', gap: 16 }}>
            <div className="settings-field" style={{ flex: 1, marginBottom: 0 }}>
              <label className="settings-label">Full Name</label>
              <input
                className="settings-input"
                value={fullName}
                placeholder="e.g. Michael Phelps"
                onChange={e => setFullName(e.target.value)}
              />
            </div>
            <div className="settings-field" style={{ flex: '0 0 140px', marginBottom: 0 }}>
              <label className="settings-label">Gender</label>
              <div className="gender-toggle">
                <button
                  type="button"
                  className={`gender-btn${gender === 'male' ? ' active' : ''}`}
                  onClick={() => setGender('male')}
                >♂ Male</button>
                <button
                  type="button"
                  className={`gender-btn${gender === 'female' ? ' active' : ''}`}
                  onClick={() => setGender('female')}
                >♀ Female</button>
              </div>
            </div>
          </div>

          <div className="settings-field">
            <label className="settings-label">Birthday</label>
            <input
              className="settings-input"
              type="date"
              value={dob}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setDob(e.target.value)}
            />
            {dob && (
              <p className="settings-birthday-display">
                🎂 {formatBirthday(dob)}
              </p>
            )}
          </div>

          <div className="settings-team-row">
            <div className="settings-field" style={{ flex: 1, marginBottom: 0 }}>
              <label className="settings-label">
                Club Team <span className="settings-optional">(optional)</span>
              </label>
              <input
                className="settings-input"
                value={clubTeam}
                placeholder="e.g. Irvine Novaquatics"
                onChange={e => setClubTeam(e.target.value)}
              />
            </div>
            <div className="settings-field" style={{ flex: 1, marginBottom: 0 }}>
              <label className="settings-label">
                High School <span className="settings-optional">(optional)</span>
              </label>
              <input
                className="settings-input"
                value={highSchool}
                placeholder="e.g. Newport Harbor HS"
                onChange={e => setHighSchool(e.target.value)}
              />
            </div>
          </div>

          <div className="settings-profile-footer">
            <button
              className={`settings-save${profileStatus === 'saved' ? ' --saved' : ''}`}
              onClick={saveProfile}
              disabled={profileStatus === 'saving'}
            >
              {profileStatus === 'saving' ? 'Saving…' : profileStatus === 'saved' ? 'Saved!' : 'Save Profile'}
            </button>
            {profileStatus === 'error' && <p className="status-error">Could not save profile.</p>}
          </div>
        </section>

        </>}

        {settingsTab === 'account' && <>

        {/* ── Account ── */}
        <section className="settings-card">
          <h2 className="settings-section-title">Account</h2>

          <div className="settings-field">
            <label className="settings-label">Username</label>
            <div className="settings-row">
              <input
                className="settings-input"
                value={username}
                placeholder="Your username"
                onChange={e => setUsername(e.target.value)}
              />
              <button
                className={`settings-save${usernameStatus === 'saved' ? ' --saved' : ''}`}
                onClick={saveUsername}
                disabled={usernameStatus === 'saving'}
              >
                {usernameStatus === 'saving' ? 'Saving…' : usernameStatus === 'saved' ? 'Saved!' : 'Save'}
              </button>
            </div>
            {usernameStatus === 'error' && <p className="status-error">Could not update username.</p>}
          </div>

          <div className="settings-field">
            <label className="settings-label">Email Address</label>
            <div className="settings-row">
              <input
                className="settings-input"
                type="email"
                value={email}
                placeholder="you@email.com"
                onChange={e => setEmail(e.target.value)}
              />
              <button
                className={`settings-save${emailStatus === 'saved' ? ' --saved' : ''}`}
                onClick={saveEmail}
                disabled={emailStatus === 'saving'}
              >
                {emailStatus === 'saving' ? 'Saving…' : emailStatus === 'saved' ? 'Check inbox' : 'Save'}
              </button>
            </div>
            {emailStatus === 'saved' && (
              <p className="status-info">A confirmation link was sent to your new email address.</p>
            )}
            {emailStatus === 'error' && <p className="status-error">Could not update email.</p>}
          </div>
        </section>

        {/* ── Contact ── */}
        <section className="settings-card">
          <h2 className="settings-section-title">Contact</h2>
          <div className="settings-field">
            <label className="settings-label">Phone Number</label>
            <div className="settings-row">
              <input
                className="settings-input"
                type="tel"
                value={phone}
                placeholder="+1 (555) 000-0000"
                onChange={e => setPhone(e.target.value)}
              />
              <button
                className={`settings-save${phoneStatus === 'saved' ? ' --saved' : ''}`}
                onClick={savePhone}
                disabled={phoneStatus === 'saving'}
              >
                {phoneStatus === 'saving' ? 'Saving…' : phoneStatus === 'saved' ? 'Saved!' : 'Save'}
              </button>
            </div>
            {phoneStatus === 'error' && <p className="status-error">Could not save phone number.</p>}
          </div>
        </section>

        {/* ── Password ── */}
        <section className="settings-card">
          <h2 className="settings-section-title">Password</h2>

          {resetStep === 'idle' && resetStatus !== 'success' && (
            <div className="reset-idle">
              <p className="settings-hint">
                We'll send a password reset link to <strong>{email || 'your email'}</strong>.
                Open the link, then enter your new password below.
              </p>
              <button
                className="settings-action-btn"
                onClick={sendResetEmail}
                disabled={resetStatus === 'loading'}
              >
                {resetStatus === 'loading' ? 'Sending…' : 'Send Reset Email'}
              </button>
            </div>
          )}

          {resetStep === 'code_sent' && (
            <div className="reset-verify">
              <p className="status-info">
                Reset link sent to <strong>{email}</strong>. After clicking it, enter your new password below.
              </p>
              <div className="settings-field">
                <label className="settings-label">New Password</label>
                <input
                  className="settings-input"
                  type="password"
                  placeholder="New password (min. 6 characters)"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
              </div>
              <div className="settings-field">
                <label className="settings-label">Confirm Password</label>
                <input
                  className="settings-input"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPass}
                  onChange={e => setConfirmPass(e.target.value)}
                />
              </div>
              <div className="reset-actions">
                <button
                  className="settings-action-btn"
                  onClick={changePassword}
                  disabled={resetStatus === 'loading'}
                >
                  {resetStatus === 'loading' ? 'Updating…' : 'Change Password'}
                </button>
                <button
                  className="settings-cancel-btn"
                  onClick={() => { setResetStep('idle'); setResetError(''); setResetStatus('idle') }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {resetStatus === 'success' && <p className="status-success">Password updated successfully!</p>}
          {resetError && <p className="status-error">{resetError}</p>}
        </section>

        {/* ── Notifications ── */}
        <section className="settings-card">
          <h2 className="settings-section-title">Notifications</h2>
          <p className="settings-hint" style={{ marginBottom: 20 }}>
            Choose which alerts you'd like to receive inside the app.
          </p>

          <div className="notif-list">
            {([
              { key: 'personalBests',    label: 'New personal bests',         desc: 'Alert when you beat your own record in any event' },
              { key: 'swimMeetReminder', label: 'Upcoming swim meet reminders', desc: 'Remind you before a meet is approaching' },
              { key: 'weeklyProgress',   label: 'Weekly progress summary',    desc: 'A recap of your training and times each week' },
              { key: 'goalAchieved',     label: 'Goal achieved',              desc: 'Celebrate when you hit a cut or target time' },
              { key: 'streakMilestone',  label: 'Streak milestones',          desc: 'Recognition when you hit login or training streaks' },
              { key: 'trainingTips',     label: 'Training tips',              desc: 'Occasional tips on technique and race strategy' },
              { key: 'newFeatures',      label: 'New features & updates',     desc: 'Know when SwimSCPlan adds something new' },
              { key: 'motivationalQuotes', label: 'Motivational quotes',       desc: 'Get an inspiring quote once or twice a week to keep you going' },
            ] as { key: keyof typeof notifPrefs; label: string; desc: string }[]).map(({ key, label, desc }) => (
              <div key={key} className="notif-row">
                <div className="notif-row-text">
                  <span className="notif-row-label">{label}</span>
                  <span className="notif-row-desc">{desc}</span>
                </div>
                <button
                  role="switch"
                  aria-checked={notifPrefs[key]}
                  className={`notif-toggle${notifPrefs[key] ? ' on' : ''}`}
                  onClick={() => toggleNotif(key)}
                >
                  <span className="notif-toggle-thumb" />
                </button>
              </div>
            ))}
          </div>

          <div className="settings-footer" style={{ marginTop: 24 }}>
            <button className="settings-save-btn" onClick={saveNotifPrefs} disabled={notifStatus === 'saving'}>
              <Save size={15} />
              {notifStatus === 'saving' ? 'Saving…' : 'Save Preferences'}
            </button>
            {notifStatus === 'saved'  && <span className="status-saved">Saved!</span>}
            {notifStatus === 'error'  && <span className="status-error">Error saving.</span>}
          </div>
        </section>

        {/* ── Delete Account ── */}
        <section className="settings-card settings-card--danger">
          <h2 className="settings-section-title settings-section-title--danger">Delete Account</h2>

          {!deleteConfirm ? (
            <div className="danger-idle">
              <p className="settings-hint">
                Permanently delete your account and all your data. This cannot be undone.
              </p>
              <button className="settings-delete-btn" onClick={() => setDeleteConfirm(true)}>
                Delete Account
              </button>
            </div>
          ) : (
            <div className="danger-confirm">
              <p className="danger-warning">
                Are you sure? Your times, profile, and all data will be permanently erased.
              </p>
              <div className="reset-actions">
                <button
                  className="settings-delete-btn--confirm"
                  onClick={deleteAccount}
                  disabled={deleteStatus === 'loading'}
                >
                  {deleteStatus === 'loading' ? 'Deleting…' : 'Yes, delete my account'}
                </button>
                <button
                  className="settings-cancel-btn"
                  onClick={() => { setDeleteConfirm(false); setDeleteError('') }}
                >
                  Cancel
                </button>
              </div>
              {deleteError && (
                <p className="status-error" style={{ marginTop: 10 }}>
                  {deleteError.includes('delete_user') || deleteError.includes('function')
                    ? 'Setup required — run the SQL function in Supabase first (see instructions above).'
                    : deleteError}
                </p>
              )}
            </div>
          )}
        </section>

        </>}

        {settingsTab === 'tutorial' && (() => {
          const TUT_SLIDES = [
            { label: 'Dashboard',       color: 'blue'   },
            { label: 'Calendar',        color: 'green'  },
            { label: 'Media Library',   color: 'purple' },
            { label: 'Progress',        color: 'teal'   },
            { label: 'Goals',           color: 'orange' },
            { label: 'Qualifications',  color: 'gold'   },
            { label: 'Event Planning',  color: 'blue'   },
            { label: 'Settings',        color: 'gray'   },
            { label: 'Time Converter',  color: 'teal'   },
          ]
          const total = TUT_SLIDES.length
          const prev  = () => setTutSlide(s => (s - 1 + total) % total)
          const next  = () => setTutSlide(s => (s + 1) % total)
          return (
          <div className="tutorial-wrap">

            {/* ── Carousel nav ── */}
            <div className="tut-carousel-nav">
              <button className="tut-arrow tut-arrow--prev" onClick={prev} aria-label="Previous">&#8592;</button>
              <div className="tut-carousel-center">
                <span className="tut-slide-label">{TUT_SLIDES[tutSlide].label}</span>
                <div className="tut-dots">
                  {TUT_SLIDES.map((_, i) => (
                    <button
                      key={i}
                      className={`tut-dot${tutSlide === i ? ' active' : ''}`}
                      onClick={() => setTutSlide(i)}
                      aria-label={TUT_SLIDES[i].label}
                    />
                  ))}
                </div>
                <span className="tut-slide-count">{tutSlide + 1} / {total}</span>
              </div>
              <button className="tut-arrow tut-arrow--next" onClick={next} aria-label="Next">&#8594;</button>
            </div>

            {/* ── Slides ── */}
            <div className="tut-slides-viewport">

            {tutSlide === 0 && (
            <div className="tut-section">
              <div className="tut-section-header tut-header--blue">🏠 Dashboard — Your Home Screen</div>
              <div className="tut-body">
                <p className="tut-desc">The Dashboard is where you land after signing in. It's your personal command center showing everything at a glance.</p>

                {/* Dashboard mockup */}
                <div className="tut-mockup">
                  <div className="tut-mockup-bar"><span className="tmb-dot r"/><span className="tmb-dot g"/><span className="tmb-dot y"/><span className="tmb-title">Dashboard</span></div>
                  <div className="tut-mockup-body mock-dash-layout">
                    <div className="mock-rail">
                      <div className="mock-rail-logo"/>
                      {['⇌ Compare','🏆 Quals','🎯 Goals','📈 Progress','📅 Calendar','📚 Media','👥 Friends'].map((ic,i) => <div key={i} className={`mock-rail-btn${i===0?' active':''}`} style={{fontSize:'9px',padding:'3px 4px'}}>{ic}</div>)}
                    </div>
                    <div className="mock-dash-main">
                      <div className="mock-banner">
                        <div className="mock-avatar"/>
                        <div className="mock-banner-text">
                          <div className="mock-bar mock-bar--white mock-bar--lg"/>
                          <div className="mock-bar mock-bar--white mock-bar--sm"/>
                        </div>
                      </div>
                      <div className="mock-stats-row">
                        {['100 Free','200 Free','100 Fly'].map(ev => (
                          <div key={ev} className="mock-stat-card">
                            <div className="mock-bar mock-bar--xs mock-bar--gray"/>
                            <div className="mock-bar mock-bar--md mock-bar--blue"/>
                          </div>
                        ))}
                      </div>
                      <div className="mock-quote-card">
                        <div className="mock-bar mock-bar--full mock-bar--gray"/>
                        <div className="mock-bar mock-bar--75 mock-bar--gray"/>
                      </div>
                    </div>
                  </div>
                </div>

                <ul className="tut-list">
                  <li><strong>Profile Banner:</strong> The colored bar at the top shows your name and profile photo. <em>Tap the photo circle to change your picture</em> — a sheet will appear with "Upload Photo" and "Remove Current Photo" options.</li>
                  <li><strong>Welcome message:</strong> Below the banner shows your display name and current age (calculated from your birthday in Settings).</li>
                  <li><strong>Quick Stats:</strong> Your best logged times for your main events appear here. These update automatically when you add times in the Progress page.</li>
                  <li><strong>Sidebar (left):</strong> On desktop, the left panel has buttons to navigate the entire app. On mobile, a nav bar appears at the bottom of the screen.</li>
                  <li><strong>Upcoming meets:</strong> Any meets you've added in the Calendar show up as upcoming events.</li>
                  <li><strong>Motivational quotes:</strong> A new quote rotates every few days to keep you inspired.</li>
                </ul>
                <div className="tut-tip">💡 Customize your banner color or paint your own in Settings → Profile tab.</div>
              </div>
            </div>
            )}

            {tutSlide === 1 && (
            <div className="tut-section">
              <div className="tut-section-header tut-header--green">📅 Practice Calendar</div>
              <div className="tut-body">
                <p className="tut-desc">Log every practice, track your attendance patterns, and analyze your training trends month by month.</p>

                {/* Calendar mockup */}
                <div className="tut-mockup">
                  <div className="tut-mockup-bar"><span className="tmb-dot r"/><span className="tmb-dot g"/><span className="tmb-dot y"/><span className="tmb-title">Practice Calendar — June 2026</span></div>
                  <div className="tut-mockup-body mock-cal-layout">
                    <div className="mock-cal-controls">
                      <span className="mock-cal-nav">‹</span>
                      <span className="mock-cal-month">June 2026</span>
                      <span className="mock-cal-nav">›</span>
                      <span className="mock-cal-tab active">Month</span>
                      <span className="mock-cal-tab">Year</span>
                      <span className="mock-cal-tab">Career</span>
                      <span className="mock-cal-addbtn">+ Meet</span>
                    </div>
                    <div className="mock-cal-grid">
                      {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} className="mock-cal-dow">{d}</div>)}
                      {[
                        {e:true},{at:true},{at:true},{e:true},{at:true},{m:true},{},
                        {at:true},{ab:true},{e:true},{at:true},{at:true},{e:true},{at:true},
                        {at:true},{at:true},{e:true},{at:true},{ab:true},{at:true},{},
                        {e:true},{at:true},{at:true},{e:true},{at:true},{at:true},{at:true},
                      ].map((cell,i) => (
                        <div key={i} className={`mock-cal-cell${cell.m?' mock-cal-cell--meet':''}`}>
                          <span className="mock-cal-num">{i < 7 ? '' : i - 5}</span>
                          {cell.at && <span className="mock-dot-green"/>}
                          {cell.ab && <span className="mock-dot-red"/>}
                          {cell.m  && <span className="mock-meet-chip">🏊 SCS Invite</span>}
                        </div>
                      ))}
                    </div>
                    <div className="mock-cal-legend">
                      <span className="mock-dot-green"/> Attended &nbsp;
                      <span className="mock-dot-amber"/> Late &nbsp;
                      <span className="mock-dot-red"/> Absent &nbsp;
                      <span className="mock-dot-gray"/> Cancelled &nbsp;
                      <span className="mock-dot-gold">★</span> Meet
                    </div>
                  </div>
                </div>

                <h4 className="tut-sub">Logging a Practice</h4>
                <ul className="tut-list">
                  <li>Tap any practice day on the calendar grid. A panel slides up from the bottom.</li>
                  <li>Choose a <strong>session status</strong>: <em>Attended</em> (green dot), <em>Late</em> (amber dot — enter how many minutes late), <em>Absent</em> (red dot), or <em>Cancelled</em> (gray).</li>
                  <li>If attended, rate your <strong>mood</strong> from 😣 (1) to 😄 (5) — this feeds the monthly mood chart.</li>
                  <li>If absent, enter a <strong>reason</strong> (e.g., "sick", "school event") — it appears in your monthly Absence Reasons list so you can spot patterns.</li>
                  <li>Tap <strong>"Add 2nd Session"</strong> if you had both morning and afternoon practice that day.</li>
                  <li><strong>Dryland:</strong> Toggle On if you did strength training, stretching, yoga, etc. Pick the type — these feed the Dryland Types pie chart.</li>
                </ul>
                <h4 className="tut-sub">Adding a Meet</h4>
                <ul className="tut-list">
                  <li>Tap <strong>"Add Meet"</strong> in the top-right of the calendar. Enter the meet name and date — it appears as a gold chip on that day.</li>
                  <li>Tap a meet chip to open its analysis form: overall mood, confidence (1–5), weather/conditions (1–5), any injuries, and performance notes.</li>
                </ul>
                <h4 className="tut-sub">Views</h4>
                <ul className="tut-list">
                  <li><strong>Month:</strong> Full calendar grid. Colored dots on each day show session status at a glance (green=attended, red=absent, gray=cancelled, purple square=dryland).</li>
                  <li><strong>Year:</strong> 12 month cards showing attendance rate as a colored bar. Click any month to jump to it.</li>
                  <li><strong>Career:</strong> All-time attendance percentage and a year-by-year breakdown table.</li>
                </ul>
                <h4 className="tut-sub">Monthly Analysis (scroll below the grid)</h4>
                <ul className="tut-list">
                  <li>Three donut pie charts: <em>Attendance</em>, <em>Practice Mood</em>, and <em>Dryland Types</em>. Hover (or tap) a slice to see the percentage.</li>
                  <li><em>Absence Reasons</em> list — all the reasons you entered when marking yourself absent.</li>
                  <li><em>Meet Analysis</em> cards — a summary of mood, confidence, weather, injuries, and notes for each meet that month.</li>
                </ul>
                <h4 className="tut-sub">Edit Schedule</h4>
                <ul className="tut-list">
                  <li>Tap <strong>"Edit Schedule"</strong> in the left sidebar to set which days of the week you normally have practice, which days have two sessions by default, and what time practice starts.</li>
                  <li>Setting this up makes the calendar highlight the right days automatically.</li>
                </ul>
                <div className="tut-tip">💡 The dots in each calendar cell use mood color when you rated a practice — a bright green dot means a great session!</div>
              </div>
            </div>

            )}

            {tutSlide === 2 && (
            <div className="tut-section">
              <div className="tut-section-header tut-header--purple">📚 Media Library</div>
              <div className="tut-body">
                <p className="tut-desc">Your personal swim scrapbook. Store race results, videos, split sheets, group photos, awards, and certificates — all organized by month.</p>

                {/* Media Library mockup */}
                <div className="tut-mockup">
                  <div className="tut-mockup-bar"><span className="tmb-dot r"/><span className="tmb-dot g"/><span className="tmb-dot y"/><span className="tmb-title">Media Library</span></div>
                  <div className="tut-mockup-body mock-lib-layout">
                    <div className="mock-lib-header">
                      <div>
                        <div className="mock-bar mock-bar--lg mock-bar--white"/>
                        <div className="mock-bar mock-bar--sm mock-bar--white-60"/>
                      </div>
                      <div className="mock-addbtn">+ Add Media</div>
                    </div>
                    <div className="mock-lib-body">
                      <div className="mock-month-label">June 2026</div>
                      <div className="mock-media-card">
                        <div className="mock-thumb mock-thumb--race"/>
                        <div className="mock-card-info">
                          <div className="mock-bar mock-bar--md mock-bar--dark"/>
                          <div className="mock-bar mock-bar--sm mock-bar--gray"/>
                          <div className="mock-tags"><span className="mock-tag mock-tag--race">Race</span><span className="mock-tag mock-tag--video">Video</span></div>
                        </div>
                      </div>
                      <div className="mock-media-card">
                        <div className="mock-thumb mock-thumb--photo"/>
                        <div className="mock-card-info">
                          <div className="mock-bar mock-bar--lg mock-bar--dark"/>
                          <div className="mock-bar mock-bar--sm mock-bar--gray"/>
                          <div className="mock-tags"><span className="mock-tag mock-tag--media">Media</span><span className="mock-tag mock-tag--photo">2 photos</span></div>
                        </div>
                      </div>
                      <div className="mock-month-label">May 2026</div>
                      <div className="mock-media-card mock-media-card--faded">
                        <div className="mock-thumb mock-thumb--race"/>
                        <div className="mock-card-info">
                          <div className="mock-bar mock-bar--md mock-bar--dark"/>
                          <div className="mock-bar mock-bar--sm mock-bar--gray"/>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <h4 className="tut-sub">Adding a Race / Swim</h4>
                <ul className="tut-list">
                  <li>Tap <strong>"Add Media"</strong> → <strong>"Race / Swim"</strong>.</li>
                  <li>Choose the event (e.g., 100 Freestyle), course (SCY/LCM/SCM), date, and your final time.</li>
                  <li><strong>Splits:</strong> Fields appear automatically — one box per 50 yards/meters. Fill them in from your result sheet.</li>
                  <li><strong>Race video:</strong> Paste a YouTube or Vimeo link to attach the video to this entry.</li>
                  <li><strong>Notes:</strong> How did the race feel? What went well? What do you want to fix?</li>
                  <li><strong>Coach Feedback:</strong> What did your coach tell you after the race?</li>
                  <li><strong>Photos:</strong> Upload photos of your result sheet or the scoreboard.</li>
                </ul>
                <h4 className="tut-sub">Adding Photos &amp; Awards</h4>
                <ul className="tut-list">
                  <li>Tap <strong>"Add Media"</strong> → <strong>"Photos &amp; Awards"</strong>.</li>
                  <li>Give it a title, pick a category (Group Photo, Award, Certificate, Team Event, Other), and add a description.</li>
                  <li>Upload photos and optionally attach a video link.</li>
                </ul>
                <h4 className="tut-sub">Browsing Your Library</h4>
                <ul className="tut-list">
                  <li>Entries are grouped by <strong>month</strong> — just like the iPhone Photos app — making it easy to find anything by when it happened.</li>
                  <li>Each card shows a thumbnail, the event/title, time or category, and tags.</li>
                  <li>Tap any card to open the full detail view. Tap <strong>Edit</strong> to update any field.</li>
                </ul>
                <div className="tut-tip">💡 Photos are stored securely in your account — no extra setup needed. They're linked to the entry and viewable any time you open the entry card.</div>
              </div>
            </div>

            )}

            {tutSlide === 3 && (
            <div className="tut-section">
              <div className="tut-section-header tut-header--teal">📈 Progress</div>
              <div className="tut-body">
                <p className="tut-desc">Track how your times have changed over your career with an interactive chart for every event.</p>

                {/* Progress mockup */}
                <div className="tut-mockup">
                  <div className="tut-mockup-bar"><span className="tmb-dot r"/><span className="tmb-dot g"/><span className="tmb-dot y"/><span className="tmb-title">Progress — 100 Free SCY</span></div>
                  <div className="tut-mockup-body mock-prog-layout">
                    <div className="mock-prog-sidebar">
                      <div className="mock-bar mock-bar--xs mock-bar--gray" style={{marginBottom:6}}/>
                      <div className="mock-prog-pill active">100 Free</div>
                      <div className="mock-prog-pill">200 Free</div>
                      <div className="mock-prog-pill">100 Fly</div>
                      <div className="mock-prog-pill">50 Free</div>
                    </div>
                    <div className="mock-prog-chart">
                      <div className="mock-chart-ylabel">slower ↑</div>
                      <svg className="mock-chart-svg" viewBox="0 0 240 90" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0891b2" stopOpacity="0.25"/>
                            <stop offset="100%" stopColor="#0891b2" stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        <path d="M10,72 L50,60 L90,50 L130,38 L170,25 L210,14" fill="none" stroke="#0891b2" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
                        <path d="M10,72 L50,60 L90,50 L130,38 L170,25 L210,14 L210,90 L10,90 Z" fill="url(#chartGrad)"/>
                        {[[10,72],[50,60],[90,50],[130,38],[170,25],[210,14]].map(([x,y],i) => (
                          <g key={i}>
                            {i === 5 ? (
                              <>
                                <circle cx={x} cy={y} r="7" fill="#f59e0b" opacity="0.3"/>
                                <circle cx={x} cy={y} r="5" fill="#f59e0b" stroke="#d97706" strokeWidth="1.5"/>
                                <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="5" fill="#fff" fontWeight="bold">★</text>
                              </>
                            ) : (
                              <circle cx={x} cy={y} r="3.5" fill="#fff" stroke="#0891b2" strokeWidth="1.5"/>
                            )}
                          </g>
                        ))}
                        <rect x="170" y="2" width="66" height="22" rx="4" fill="#0f172a" opacity="0.85"/>
                        <text x="203" y="11" textAnchor="middle" fill="#fff" fontSize="6" fontWeight="bold">47.89</text>
                        <text x="203" y="20" textAnchor="middle" fill="#67e8f9" fontSize="5">Jun 2026 · age 17</text>
                      </svg>
                      <div className="mock-chart-xlabel">
                        <span>2022</span><span>2023</span><span>2024</span><span>2025</span><span>2026</span>
                      </div>
                      <div className="mock-chart-pb"><span className="mock-pb-badge">★ PB 47.89</span></div>
                    </div>
                  </div>
                </div>

                <ul className="tut-list">
                  <li><strong>Select an event:</strong> In the left sidebar, pick a course (SCY/LCM/SCM), then a stroke and distance. The chart updates immediately.</li>
                  <li><strong>Reading the chart:</strong> Time flows left to right (oldest → newest). The vertical axis is speed — <em>lower on the chart = faster time</em>. A dot moving down and to the right means improvement.</li>
                  <li><strong>Hover a dot:</strong> On desktop, hover over any dot to see a tooltip with the exact date, your time, and how old you were at that swim. On mobile, tap the dot.</li>
                  <li><strong>Adding/editing times:</strong> Switch to the <em>Times</em> tab in the sidebar. Enter a date and time, then tap the checkmark to save. Tap any existing time to edit or delete it.</li>
                  <li><strong>Personal Bests:</strong> Your fastest entry is highlighted with a <span style={{background:'#f59e0b',color:'#fff',padding:'1px 5px',borderRadius:3,fontSize:'0.85em',fontWeight:800}}>★ PB</span> gold badge on the entry list and a gold star dot on the chart.</li>
                </ul>
                <div className="tut-tip">💡 Add times as far back as you can remember — the more history you enter, the better the chart shows your progression over your career.</div>
              </div>
            </div>

            )}

            {tutSlide === 4 && (
            <div className="tut-section">
              <div className="tut-section-header tut-header--orange">🎯 Goals</div>
              <div className="tut-body">
                <p className="tut-desc">Set a target time for any event and watch your progress toward it in real time.</p>

                {/* Goals mockup */}
                <div className="tut-mockup">
                  <div className="tut-mockup-bar"><span className="tmb-dot r"/><span className="tmb-dot g"/><span className="tmb-dot y"/><span className="tmb-title">My Goals</span></div>
                  <div className="tut-mockup-body mock-goals-layout">
                    <div className="mock-goal-card mock-goal-card--achieved">
                      <div className="mock-goal-top">
                        <div>
                          <div className="mock-goal-event">100 Free SCY</div>
                          <div className="mock-goal-course">Short Course Yards</div>
                        </div>
                        <div className="mock-goal-badge">✓ Achieved!</div>
                      </div>
                      <div className="mock-goal-times">
                        <div className="mock-time-block"><div className="mock-time-label">Current</div><div className="mock-time-val mock-time-val--green">47.89</div></div>
                        <div className="mock-time-arrow">→</div>
                        <div className="mock-time-block"><div className="mock-time-label">Target</div><div className="mock-time-val">48.00</div></div>
                      </div>
                      <div className="mock-goal-slider-wrap"><div className="mock-goal-slider-fill" style={{width:'100%'}}/><div className="mock-goal-slider-marker" style={{left:'100%'}}/></div>
                      <div className="mock-goal-slider-labels"><span>49.20</span><span style={{color:'#059669',fontWeight:700}}>100% there</span><span style={{color:'#059669'}}>48.00</span></div>
                    </div>
                    <div className="mock-goal-card">
                      <div className="mock-goal-top">
                        <div>
                          <div className="mock-goal-event">200 Free SCY</div>
                          <div className="mock-goal-course">Short Course Yards</div>
                        </div>
                        <div className="mock-goal-days">32 days left</div>
                      </div>
                      <div className="mock-goal-times">
                        <div className="mock-time-block"><div className="mock-time-label">Current</div><div className="mock-time-val">1:48.33</div></div>
                        <div className="mock-time-arrow">→</div>
                        <div className="mock-time-block"><div className="mock-time-label">Target</div><div className="mock-time-val">1:45.00</div></div>
                      </div>
                      <div className="mock-goal-slider-wrap"><div className="mock-goal-slider-fill" style={{width:'62%'}}/><div className="mock-goal-slider-marker" style={{left:'62%'}}/></div>
                      <div className="mock-goal-slider-labels"><span>1:51.20</span><span style={{color:'#0077b6',fontWeight:700}}>62% there</span><span style={{color:'#0077b6'}}>1:45.00</span></div>
                    </div>
                  </div>
                </div>

                <ul className="tut-list">
                  <li><strong>Create a goal:</strong> Tap "Create your first goal" (or "Add another goal"). Select an event, your starting time, the target time, and an optional deadline.</li>
                  <li><strong>Goal cards:</strong> Each card shows your current best time (pulled live from your Progress logs) vs. your target, and how many days until your deadline.</li>
                  <li><strong>Achieved:</strong> When your logged time beats the target, the card turns green with a "✓ Achieved!" badge.</li>
                  <li><strong>Archive:</strong> When goals are achieved, an "Archive Completed Goals" button appears at the top. Tap it to move finished goals to a history section at the bottom. Use the ▼ chevron to expand and view your archive.</li>
                  <li><strong>Goal Help:</strong> Tap the <em>Help</em> button in the sidebar for SMART goal-setting advice tailored to swimming.</li>
                </ul>
                <div className="tut-tip">💡 Set goals around qualifying cuts (visible in the Qualifications page) — e.g., "hit a BB cut in 100 Free by December".</div>
              </div>
            </div>

            )}

            {tutSlide === 5 && (
            <div className="tut-section">
              <div className="tut-section-header tut-header--gold">🏆 Qualifications</div>
              <div className="tut-body">
                <p className="tut-desc">See where your times stand against USA Swimming qualifying standards for every age group.</p>

                {/* Qualifications mockup */}
                <div className="tut-mockup">
                  <div className="tut-mockup-bar"><span className="tmb-dot r"/><span className="tmb-dot g"/><span className="tmb-dot y"/><span className="tmb-title">Qualifications — 17-18 · SCY</span></div>
                  <div className="tut-mockup-body mock-quals-layout">
                    <div className="mock-quals-filters">
                      <div className="mock-select">17-18 ▾</div>
                      <div className="mock-select">SCY ▾</div>
                    </div>
                    <div className="mock-quals-table">
                      <div className="mock-quals-head">
                        <span>Event</span><span>Your PR</span><span>B</span><span>BB</span><span>A</span><span>AA</span>
                      </div>
                      {[
                        { ev:'100 Free', pr:'47.89', cuts:['✓','✓','✓','✓'], next:null },
                        { ev:'200 Free', pr:'1:48.3', cuts:['✓','✓','✓',''], next:'AA: 1:45.09' },
                        { ev:'100 Fly',  pr:'51.44', cuts:['✓','✓','',''],  next:'A: 49.79' },
                        { ev:'50 Free',  pr:'21.80', cuts:['✓','✓','✓',''], next:'AA: 20.69' },
                      ].map(row => (
                        <div key={row.ev} className="mock-quals-row">
                          <span className="mock-quals-event">{row.ev}</span>
                          <span className="mock-quals-pr">{row.pr}</span>
                          {row.cuts.map((c,i) => (
                            <span key={i} className={`mock-cut-badge${c==='✓'?' mock-cut-badge--made':' mock-cut-badge--miss'}`}>{c||'-'}</span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <ul className="tut-list">
                  <li>Filter by <strong>age group</strong> (10-Under through Senior) and <strong>course</strong> (SCY or LCM) using the dropdowns at the top.</li>
                  <li>Your current best times are automatically compared against <strong>B, BB, A, AA, AAA, and Sectional</strong> cuts.</li>
                  <li>Events where you've made a cut show a colored badge. Events still within reach show the gap to the next cut.</li>
                  <li>Use this page to figure out which goals to set in the Goals page — aim for the next cut above where you are now.</li>
                </ul>
              </div>
            </div>

            )}

            {tutSlide === 6 && (
            <div className="tut-section">
              <div className="tut-section-header tut-header--blue">📋 Event Planning</div>
              <div className="tut-body">
                <p className="tut-desc">Plan which events you'll swim at an upcoming meet and strategize your race schedule.</p>
                <ul className="tut-list">
                  <li>Select the events you plan to enter — they'll show your current best time and the qualifying standard side by side.</li>
                  <li>See at a glance how far you are from the qualifying cut for each event.</li>
                  <li>Add notes for your race strategy — what splits to hit, what to focus on mentally, etc.</li>
                  <li>Access Event Planning from the Calendar page sidebar.</li>
                </ul>
              </div>
            </div>

            )}

            {tutSlide === 7 && (
            <div className="tut-section">
              <div className="tut-section-header tut-header--gray">⚙️ Settings</div>
              <div className="tut-body">
                <p className="tut-desc">Personalize your account, appearance, and notification preferences.</p>

                {/* Settings mockup */}
                <div className="tut-mockup">
                  <div className="tut-mockup-bar"><span className="tmb-dot r"/><span className="tmb-dot g"/><span className="tmb-dot y"/><span className="tmb-title">Settings</span></div>
                  <div className="tut-mockup-body mock-settings-layout">
                    <div className="mock-settings-header">
                      <div className="mock-settings-tabs">
                        <div className="mock-stab active">Profile</div>
                        <div className="mock-stab">Account &amp; Security</div>
                        <div className="mock-stab">Tutorial</div>
                      </div>
                    </div>
                    <div className="mock-settings-body">
                      <div className="mock-settings-card">
                        <div className="mock-settings-row">
                          <div className="mock-avatar mock-avatar--sm"/>
                          <div style={{flex:1}}>
                            <div className="mock-bar mock-bar--xs mock-bar--gray" style={{marginBottom:4}}/>
                            <div className="mock-bar mock-bar--full mock-bar--gray"/>
                          </div>
                        </div>
                      </div>
                      <div className="mock-settings-card">
                        <div className="mock-bar mock-bar--xs mock-bar--gray" style={{marginBottom:6}}/>
                        <div className="mock-banner-swatches">
                          {['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#0891b2'].map(c => (
                            <div key={c} className="mock-swatch" style={{background:c}}/>
                          ))}
                        </div>
                      </div>
                      <div className="mock-settings-card">
                        <div className="mock-field"><div className="mock-bar mock-bar--xs mock-bar--gray"/><div className="mock-input"/></div>
                        <div className="mock-field"><div className="mock-bar mock-bar--xs mock-bar--gray"/><div className="mock-gender-row"><div className="mock-gbtn active">♂ Male</div><div className="mock-gbtn">♀ Female</div></div></div>
                        <div className="mock-field"><div className="mock-bar mock-bar--xs mock-bar--gray"/><div className="mock-input"/></div>
                      </div>
                    </div>
                  </div>
                </div>

                <h4 className="tut-sub">Profile Tab</h4>
                <ul className="tut-list">
                  <li><strong>Profile Picture:</strong> Click/tap your avatar to upload a new photo. It's automatically cropped to a square and compressed — no storage setup needed.</li>
                  <li><strong>Dashboard Banner:</strong> Choose from 10 gradient presets, 8 solid colors, pick any custom color, or tap "Paint Your Own" to draw a custom banner using a brush tool. Your drawing becomes the banner background on your Dashboard.</li>
                  <li><strong>Profile Info:</strong> Full name, gender (♂/♀), birthday (used to calculate your age on the Dashboard and Qualifications), club team, and high school.</li>
                  <li>Tap <strong>Save Profile</strong> when done — it confirms with a green "Saved!" message.</li>
                </ul>
                <h4 className="tut-sub">Account &amp; Security Tab</h4>
                <ul className="tut-list">
                  <li><strong>Username:</strong> Your display name — tap Save after changing it.</li>
                  <li><strong>Email:</strong> Changing your email sends a confirmation to the new address first. You must click the link in that email to confirm the change.</li>
                  <li><strong>Phone:</strong> Optional — saved to your profile but not used for authentication.</li>
                  <li><strong>Password:</strong> Tap "Send Reset Email" to receive a password reset link. After clicking that link, enter and confirm your new password on this page.</li>
                  <li><strong>Notifications:</strong> Toggle which in-app alerts you receive. Tap "Save Preferences" to apply your choices.</li>
                  <li><strong>Delete Account:</strong> Permanently erases your account and all data. A confirmation step prevents accidental deletion.</li>
                </ul>
              </div>
            </div>

            )}

            {tutSlide === 8 && (
            <div className="tut-section">
              <div className="tut-section-header tut-header--teal">⇄ Time Converter</div>
              <div className="tut-body">
                <p className="tut-desc">Instantly convert swimming times between Short Course Yards (SCY), Long Course Meters (LCM), and Short Course Meters (SCM).</p>

                {/* Time Converter mockup */}
                <div className="tut-mockup">
                  <div className="tut-mockup-bar"><span className="tmb-dot r"/><span className="tmb-dot g"/><span className="tmb-dot y"/><span className="tmb-title">Time Converter</span></div>
                  <div className="tut-mockup-body mock-tc-layout">
                    <div className="mock-tc-card">
                      <div className="mock-tc-row">
                        <div className="mock-tc-field">
                          <div className="mock-bar mock-bar--xs mock-bar--gray" style={{marginBottom:4}}/>
                          <div className="mock-select">100 Freestyle ▾</div>
                        </div>
                      </div>
                      <div className="mock-tc-courses">
                        {[
                          {course:'SCY', time:'47.89', active:true},
                          {course:'LCM', time:'51.42', active:false},
                          {course:'SCM', time:'50.11', active:false},
                        ].map(({course,time,active}) => (
                          <div key={course} className={`mock-tc-course${active?' mock-tc-course--active':''}`}>
                            <span className="mock-tc-label">{course}</span>
                            <input className="mock-tc-input" readOnly value={time}/>
                          </div>
                        ))}
                      </div>
                      <div className="mock-tc-hint">← Enter a time in any field to convert</div>
                    </div>
                  </div>
                </div>

                <ul className="tut-list">
                  <li>Access it from the sidebar on the <strong>Calendar, Progress, Goals, or Media Library</strong> pages — look for the ⇄ icon.</li>
                  <li>Select your event, enter a time in one course, and the conversion appears instantly.</li>
                  <li>Useful when comparing times swum in different courses (e.g., your SCY time vs. what the LCM standard is).</li>
                </ul>
              </div>
            </div>

            )}

            </div>{/* end tut-slides-viewport */}

            {/* ── Bottom nav ── */}
            <div className="tut-bottom-nav">
              {tutSlide > 0 && (
                <button className="tut-bottom-btn" onClick={() => setTutSlide(s => s - 1)}>
                  ← {['Dashboard','Calendar','Media Library','Progress','Goals','Qualifications','Event Planning','Settings','Time Converter'][tutSlide - 1]}
                </button>
              )}
              <span className="tut-bottom-spacer" />
              {tutSlide < 8 && (
                <button className="tut-bottom-btn tut-bottom-btn--next" onClick={() => setTutSlide(s => s + 1)}>
                  {['Dashboard','Calendar','Media Library','Progress','Goals','Qualifications','Event Planning','Settings','Time Converter'][tutSlide + 1]} →
                </button>
              )}
              {tutSlide === 8 && (
                <button className="tut-bottom-btn tut-bottom-btn--done" onClick={() => setTutSlide(0)}>
                  Start over ↺
                </button>
              )}
            </div>

          </div>
          )
        })()}

      </div>
    </div>
  )
}
