export function formatPortalDate(ms?: number) {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatPortalDateTime(ms?: number) {
  if (!ms) return '—'
  const d = new Date(ms)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return formatPortalDate(ms)
}

export function initials(name?: string | null) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function itemTypeLabel(type: string) {
  if (type === 'Feature Service') return 'Feature layer'
  if (type === 'Map Service') return 'Map image layer'
  if (type === 'Web Mapping Application') return 'Web mapping application'
  return type
}

export function typeIconClass(type: string) {
  const t = type.toLowerCase()
  if (t.includes('web map') && !t.includes('app')) return 'type-icon--webmap'
  if (t.includes('web scene') || t.includes('scene')) return 'type-icon--scene'
  if (t.includes('feature')) return 'type-icon--feature'
  if (t.includes('map service') || t.includes('map image')) return 'type-icon--mapimage'
  if (t.includes('app') || t.includes('dashboard')) return 'type-icon--app'
  return 'type-icon--default'
}
