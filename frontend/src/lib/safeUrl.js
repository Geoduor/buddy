// Only ever link to Microsoft Learn over HTTPS. Content comes from the database, so we never trust it blindly:
// a value such as "javascript:alert(1)" or a link to another site must not become a clickable link.
export function learnUrl(value) {
  try {
    const u = new URL(String(value ?? ''))
    return u.protocol === 'https:' && u.hostname === 'learn.microsoft.com' ? u.href : null
  } catch {
    return null
  }
}
