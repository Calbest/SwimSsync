import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://dwagdpivqnovtzihyfxn.supabase.co'

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3YWdkcGl2cW5vdnR6aWh5ZnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1ODk2MzUsImV4cCI6MjA5ODE2NTYzNX0.TomXs95M6REIF8x2K9yT_-sJPNVY2gm_vqNRjdDb1NA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Sessions expire after 1 hour of inactivity
    storageKey: 'sw_session',
  },
})
