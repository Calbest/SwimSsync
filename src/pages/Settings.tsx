import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, User, RotateCcw, Eraser, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './Settings.css'

type SaveStatus  = 'idle' | 'saving' | 'saved' | 'error'
type ResetStep   = 'idle' | 'code_sent'
type ResetStatus = 'idle' | 'loading' | 'success' | 'error'
type BannerType  = 'default' | 'gradient' | 'color' | 'canvas'

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
  const fileInput  = useRef<HTMLInputElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
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
  const [bannerTab,    setBannerTab]    = useState<'colors' | 'paint'>('colors')
  const [bannerStatus, setBannerStatus] = useState<SaveStatus>('idle')
  const [brushColor,   setBrushColor]   = useState('#7ee8ff')
  const [brushSize,    setBrushSize]    = useState(12)
  const [isEraser,     setIsEraser]     = useState(false)

  // Active tab
  const [settingsTab, setSettingsTab] = useState<'profile' | 'account'>('profile')

  // Notifications
  const [notifPrefs, setNotifPrefs] = useState({
    personalBests:    true,
    swimMeetReminder: true,
    weeklyProgress:   true,
    goalAchieved:     true,
    streakMilestone:  true,
    trainingTips:     false,
    newFeatures:      true,
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

  // current banner CSS for live preview
  const bannerPreviewStyle: React.CSSProperties =
    bannerType === 'canvas' && bannerValue
      ? { backgroundImage: `url(${bannerValue})`, backgroundSize: 'cover', backgroundPosition: 'center top' }
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
    setAvatarPreview(URL.createObjectURL(file))
    setAvatarStatus('uploading')

    const ext  = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadErr) { setAvatarStatus('error'); setAvatarPreview(''); return }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: updateErr } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } })
    if (updateErr) { setAvatarStatus('error'); return }
    setAvatarUrl(publicUrl)
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
        <button className="settings-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} />
          Dashboard
        </button>
        <h1 className="settings-title">Settings</h1>
        <img src="/logos/scs.svg" alt="Southern California Swimming" className="scs-logo-corner" />
      </div>

      <div className="settings-body">

        {/* ── Tab nav ── */}
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
        </div>

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
                  Upload failed. Make sure the <strong>avatars</strong> bucket exists in
                  Supabase → Storage → Buckets (set it to public).
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
                >Male</button>
                <button
                  type="button"
                  className={`gender-btn${gender === 'female' ? ' active' : ''}`}
                  onClick={() => setGender('female')}
                >Female</button>
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

      </div>
    </div>
  )
}
