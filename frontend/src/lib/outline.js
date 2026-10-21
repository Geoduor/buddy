// The official exam outline (domains and groups) comes from the database, never hard-coded.
import { supabase } from './supabase'
import { ensureSession } from './session'

let cache = null

export async function loadOutline() {
  if (cache) return cache
  await ensureSession()
  const [d, o] = await Promise.all([
    supabase.from('domains').select('id, title, weight_min, weight_max').order('id'),
    supabase.from('objectives').select('id, domain_id, group_id, group_title').order('id'),
  ])
  if (d.error) throw d.error
  if (o.error) throw o.error
  const domains = d.data.map((dom) => {
    const groups = []
    for (const row of o.data.filter((x) => x.domain_id === dom.id)) {
      if (!groups.find((g) => g.id === row.group_id)) groups.push({ id: row.group_id, title: row.group_title })
    }
    return { ...dom, groups }
  })
  cache = domains
  return domains
}

export function scopeLabel(scope, domains) {
  if (!scope || scope === 'all') return 'All topics'
  for (const d of domains) {
    if (d.id === scope) return d.title
    const g = d.groups.find((x) => x.id === scope)
    if (g) return g.title
  }
  return scope
}
