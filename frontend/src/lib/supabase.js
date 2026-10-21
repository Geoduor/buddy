import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  console.warn('Supabase env variables are missing. Check frontend/.env.local')
}

export const supabase =
  url && key && url.startsWith('http') ? createClient(url, key) : null