// One shared anonymous sign-in for the whole app (API_CONTRACTS section 1).
import { supabase } from './supabase'

let pending = null

export function ensureSession() {
  if (!supabase) return Promise.reject(new Error('Supabase is not configured.'))
  if (!pending) {
    pending = (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) return session
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      return data.session
    })().catch((e) => {
      pending = null
      throw e
    })
  }
  return pending
}

// Used when the server says the session is no longer valid (401).
export async function resetSession() {
  pending = null
  if (supabase) await supabase.auth.signOut({ scope: 'local' })
  return ensureSession()
}

export async function accessToken() {
  await ensureSession()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}
