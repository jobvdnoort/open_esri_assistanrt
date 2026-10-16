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

async function fetchFolderItems(
  auth: ArcGISIdentityManager,
  owner: string,
  folderId?: string,
): Promise<PortalItem[]> {
  const items: PortalItem[] = []
  let start = 1

  while (start > 0) {
    const page = await getUserContent({
      owner,
      folderId,
      start,
      num: 100,
      authentication: auth,
    })
    items.push(...(page.items as PortalItem[]))
    start = page.nextStart && page.nextStart > 0 ? page.nextStart : -1
  }

  return items
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

/** List items the signed-in user owns. Pass folderId for one folder; omit for all (root + folders). */
export async function listMyContent(
  auth: ArcGISIdentityManager,
  options?: { type?: string; query?: string; folderId?: string | null },
): Promise<ContentResult> {
  const username = await auth.getUsername()

  if (options?.folderId) {
    const folderItems = await fetchFolderItems(auth, username, options.folderId)
    let results = sortByModified(filterByType(folderItems, options?.type))
    const q = options?.query?.trim().toLowerCase()
    if (q) {
      results = results.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q) ||
          (item.tags ?? []).some((t) => t.toLowerCase().includes(q)) ||
          (item.snippet ?? '').toLowerCase().includes(q),
      )
    }
    return {
      results,
      total: results.length,
      queryUsed: `content/users/${username}/${options.folderId}`,
      username,
    }
  }

  if (options?.folderId === null) {
    // Explicit root-only folder
    const items = await fetchFolderItems(auth, username, undefined)
    let results = sortByModified(filterByType(items, options?.type))
    const q = options?.query?.trim().toLowerCase()
    if (q) {
      results = results.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q) ||
          (item.tags ?? []).some((t) => t.toLowerCase().includes(q)) ||
          (item.snippet ?? '').toLowerCase().includes(q),
      )
    }
    return {
      results,
      total: results.length,
      queryUsed: `content/users/${username}`,
      username,
    }
  }

  const root = await getUserContent({
    owner: username,
    start: 1,
    num: 100,
    authentication: auth,
  })

  const items: PortalItem[] = [...(root.items as PortalItem[])]
  let start = root.nextStart && root.nextStart > 0 ? root.nextStart : -1
  while (start > 0) {
    const page = await getUserContent({
      owner: username,
      start,
      num: 100,
      authentication: auth,
    })
    items.push(...(page.items as PortalItem[]))
    start = page.nextStart && page.nextStart > 0 ? page.nextStart : -1
  }

  for (const folder of root.folders ?? []) {
    const folderItems = await fetchFolderItems(auth, username, folder.id)
    items.push(...folderItems)
  }

  let results = sortByModified(filterByType(items, options?.type))
  const q = options?.query?.trim().toLowerCase()
  if (q) {
    results = results.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        (item.tags ?? []).some((t) => t.toLowerCase().includes(q)) ||
        (item.snippet ?? '').toLowerCase().includes(q),
    )
  }

  return {
    results,
    total: results.length,
    queryUsed: `content/users/${username}` + (options?.type ? ` type:${options.type}` : ''),
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

  if (options.scope === 'favorites') {
    return listFavoriteContent(auth, { type: options.type, query: options.query })
  }

  if (options.scope === 'mine' && !text) {
    return listMyContent(auth, {
      type: options.type,
      folderId: options.folderId,
    })
  }

  if (options.scope === 'mine' && options.folderId !== undefined) {
    return listMyContent(auth, {
      type: options.type,
      query: options.query,
      folderId: options.folderId,
    })
  }

  const parts: string[] = []

  if (options.scope === 'mine') {
    parts.push(`owner:"${username}"`)
  } else if (options.scope === 'org') {
    if (portal?.id) {
      parts.push(`orgid:${portal.id}`)
    } else {
      parts.push(`owner:"${username}"`)
    }
  }

  if (text) {
    // Free text: match title/tags etc. Keep it simple for Enterprise Lucene.
    parts.push(`(${text})`)
  }

  if (options.type) {
    parts.push(`type:"${options.type}"`)
  }

  // Fallback so we never hit the portal with an empty q (returns everything public / restricted).
  if (parts.length === 0) {
    parts.push(`owner:"${username}"`)
  }

  const q = parts.join(' AND ')
  const response = await searchItems({
    q,
    start: options.start ?? 1,
    num: options.num ?? 100,
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
    num: 100,
    sortField: 'modified',
    sortOrder: 'desc',
    authentication: auth,
  })

  return {
    results: response.results as PortalItem[],
    total: response.total,
    queryUsed: q,
  }
}
