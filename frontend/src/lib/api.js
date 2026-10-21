// Study Buddy call, exactly as documented in docs/API_CONTRACTS.md section 5.
import { accessToken, resetSession } from './session'

async function call(question) {
  const token = await accessToken()
  const res = await fetch('/api/study-buddy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question }),
  })
  let data
  try {
    data = await res.json()
  } catch {
    data = null
  }
  return { status: res.status, data }
}

export async function askBuddy(question) {
  let r = await call(question)
  if (r.status === 401) {
    await resetSession()
    r = await call(question)
  }
  return r
}

export function friendlyError(status, data) {
  if (status === 404 || !data) {
    return 'The Study Buddy is not reachable here. It runs on the deployed site or a Vercel preview, not in the local dev server.'
  }
  if (data.message) return data.message
  return 'Something went wrong. Try again shortly.'
}
