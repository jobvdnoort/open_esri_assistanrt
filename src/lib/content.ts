import { getUserContent, searchGroups, searchItems } from '@esri/arcgis-rest-portal'
import type { ArcGISIdentityManager } from '@esri/arcgis-rest-request'
import type { PortalItem, PortalSelf } from '../types/arcgis'

export type ContentScope = 'mine' | 'favorites' | 'org' | 'groups'

export interface PortalFolder {
  id: string
  title: string
  created?: number
}

export interface PortalGroup {
  id: string
  title: string
  owner: string
  access?: string
  isInvitationOnly?: boolean
  description?: string
  snippet?: string
  modified?: number
  created?: number
  numItems?: number
  thumbnail?: string
}

export interface ContentResult {
  results: PortalItem[]
  total: number
  queryUsed: string
  username?: string
}

function filterByType(items: PortalItem[], type?: string): PortalItem[] {
  if (!type) return items
  return items.filter((item) => item.type === type)
}

function sortByModified(items: PortalItem[]): PortalItem[] {
  return [...items].sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0))
}

async function fetchFolderPage(
  auth: ArcGISIdentityManager,
  owner: string,
  options?: { folderId?: string; start?: number; num?: number },
): Promise<{ items: PortalItem[]; total: number; nextStart: number }> {
  const page = await getUserContent({
    owner,
    folderId: options?.folderId,
    start: options?.start ?? 1,
    num: options?.num ?? 60,
    authentication: auth,
  })
  const items = (page.items ?? []) as PortalItem[]
  return {
    items,
    // getUserContent total is not always present; approximate from page
    total: typeof (page as { total?: number }).total === 'number'
      ? (page as { total: number }).total
      : items.length,
    nextStart: page.nextStart && page.nextStart > 0 ? page.nextStart : -1,
  }
}

function safeFilterQuery(items: PortalItem[], query?: string, type?: string): PortalItem[] {
  let results = filterByType(items, type)
  const q = query?.trim().toLowerCase()
  if (!q) return sortByModified(results)
  results = results.filter((item) => {
    const title = (item.title ?? '').toLowerCase()
    const id = (item.id ?? '').toLowerCase()
    const itemType = (item.type ?? '').toLowerCase()
    const snippet = (item.snippet ?? '').toLowerCase()
    const tags = item.tags ?? []
    return (
      title.includes(q) ||
      id.includes(q) ||
      itemType.includes(q) ||
      snippet.includes(q) ||
      tags.some((t) => (t ?? '').toLowerCase().includes(q))
    )
  })
  return sortByModified(results)
}

export async function listMyFolders(auth: ArcGISIdentityManager): Promise<PortalFolder[]> {
  const username = await auth.getUsername()
  const root = await getUserContent({
    owner: username,
    start: 1,
    num: 1,
    authentication: auth,
  })
  return (root.folders ?? []).map((f) => ({
    id: f.id,
    title: f.title,
    created: f.created,
  }))
}

/**
 * List items the signed-in user owns — one page at a time.
 * "All my content" uses portal search (fast). A folder uses getUserContent for that folder only.
 * Never crawls every folder (that froze Enterprise accounts with thousands of items).
 */
export async function listMyContent(
  auth: ArcGISIdentityManager,
  options?: {
    type?: string
    query?: string
    folderId?: string | null
    start?: number
    num?: number
  },
): Promise<ContentResult> {
  const username = await auth.getUsername()
  const start = options?.start ?? 1
  const num = options?.num ?? 60

  // Specific folder (or root when folderId === null)
  if (options?.folderId || options?.folderId === null) {
    const page = await fetchFolderPage(auth, username, {
      folderId: options.folderId || undefined,
      start,
      num,
    })
    const results = safeFilterQuery(page.items, options?.query, options?.type)
    return {
      results,
      total: options?.query || options?.type ? results.length : Math.max(page.total, results.length),
      queryUsed:
        options.folderId === null
          ? `content/users/${username}`
          : `content/users/${username}/${options.folderId}`,
      username,
    }
  }

  // All my content — search API, single page
  const parts = [`owner:"${username}"`]
  if (options?.query?.trim()) parts.push(`(${options.query.trim()})`)
  if (options?.type) parts.push(`type:"${options.type}"`)
  const q = parts.join(' AND ')
  const response = await searchItems({
    q,
    start,
    num,
    sortField: 'modified',
    sortOrder: 'desc',
    authentication: auth,
  })
  return {
    results: (response.results ?? []) as PortalItem[],
    total: response.total ?? 0,
    queryUsed: q,
    username,
  }
}

export async function listFavoriteContent(
  auth: ArcGISIdentityManager,
  options?: { type?: string; query?: string },
): Promise<ContentResult> {
  const username = await auth.getUsername()
  const parts = [`owner:"${username}"`, 'typekeywords:"Favorite"']
  if (options?.query?.trim()) parts.push(`(${options.query.trim()})`)
  if (options?.type) parts.push(`type:"${options.type}"`)
  const q = parts.join(' AND ')
  const response = await searchItems({
    q,
    num: 100,
    sortField: 'modified',
    sortOrder: 'desc',
    authentication: auth,
  })
  return {
    results: response.results as PortalItem[],
    total: response.total,
    queryUsed: q,
    username,
  }
}

/** Portal item search with explicit username / orgid (avoid bare owner:me). */
export async function searchPortalContent(
  auth: ArcGISIdentityManager,
  portal: PortalSelf | null,
  options: {
    scope: ContentScope
    query?: string
    type?: string
    start?: number
    num?: number
    folderId?: string | null
  },
): Promise<ContentResult> {
  const username = await auth.getUsername()
  const text = options.query?.trim() ?? ''
  const start = options.start ?? 1
  const num = options.num ?? 60

  if (options.scope === 'favorites') {
    return listFavoriteContent(auth, { type: options.type, query: options.query })
  }

  if (options.scope === 'mine') {
    return listMyContent(auth, {
      type: options.type,
      query: options.query,
      folderId: options.folderId,
      start,
      num,
    })
  }

  const parts: string[] = []

  if (options.scope === 'org') {
    if (portal?.id) {
      parts.push(`orgid:${portal.id}`)
    } else {
      parts.push(`owner:"${username}"`)
    }
  }

  if (text) {
    parts.push(`(${text})`)
  }

  if (options.type) {
    parts.push(`type:"${options.type}"`)
  }

  if (parts.length === 0) {
    parts.push(`owner:"${username}"`)
  }

  const q = parts.join(' AND ')
  const response = await searchItems({
    q,
    start,
    num,
    sortField: 'modified',
    sortOrder: 'desc',
    authentication: auth,
  })

  return {
    results: (response.results ?? []) as PortalItem[],
    total: response.total ?? 0,
    queryUsed: q,
    username,
  }
}

function mapGroup(g: {
  id: string
  title: string
  owner: string
  access?: string
  description?: string
  snippet?: string
  modified?: number
  created?: number
  isInvitationOnly?: boolean
  thumbnail?: string
}): PortalGroup {
  return {
    id: g.id,
    title: g.title,
    owner: g.owner,
    access: g.access,
    description: g.description,
    snippet: g.snippet,
    modified: g.modified,
    created: g.created,
    isInvitationOnly: g.isInvitationOnly,
    thumbnail: g.thumbnail,
  }
}

export async function listUserGroups(auth: ArcGISIdentityManager): Promise<PortalGroup[]> {
  const user = await auth.getUser()
  if (user.groups?.length) {
    return user.groups.map((g) => mapGroup(g))
  }

  const username = user.username || (await auth.getUsername())
  const response = await searchGroups({
    q: `member:"${username}" OR owner:"${username}"`,
    num: 100,
    sortField: 'title',
    sortOrder: 'asc',
    authentication: auth,
  })

  return response.results.map((g) => mapGroup(g))
}

export async function listOrgGroups(
  auth: ArcGISIdentityManager,
  portal: PortalSelf | null,
  options?: { query?: string },
): Promise<PortalGroup[]> {
  const parts: string[] = []
  if (portal?.id) parts.push(`orgid:${portal.id}`)
  else {
    const username = await auth.getUsername()
    parts.push(`owner:"${username}"`)
  }
  if (options?.query?.trim()) parts.push(`(${options.query.trim()})`)
  const response = await searchGroups({
    q: parts.join(' AND '),
    num: 100,
    sortField: 'title',
    sortOrder: 'asc',
    authentication: auth,
  })
  return response.results.map((g) => mapGroup(g))
}

export async function searchGroupItems(
  auth: ArcGISIdentityManager,
  groupId: string,
  options?: { type?: string; query?: string },
): Promise<ContentResult> {
  const parts: string[] = [`group:"${groupId}"`]
  if (options?.query?.trim()) parts.push(`(${options.query.trim()})`)
  if (options?.type) parts.push(`type:"${options.type}"`)
  const q = parts.join(' AND ')

  const response = await searchItems({
    q,
    num: 60,
    sortField: 'modified',
    sortOrder: 'desc',
    authentication: auth,
  })

  return {
    results: (response.results ?? []) as PortalItem[],
    total: response.total ?? 0,
    queryUsed: q,
  }
}
