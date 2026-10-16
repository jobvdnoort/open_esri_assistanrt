import {
  getItem,
  getItemData,
  getUserContent,
  searchItems,
  updateItem,
  type ISearchResult,
} from '@esri/arcgis-rest-portal'
import { ArcGISIdentityManager, request } from '@esri/arcgis-rest-request'
import type { PortalItem, PortalSelf, WebMapData } from '../types/arcgis'
import { ensureWebMapShape } from './webmap'

export function normalizePortalUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, '')
  if (!url) return 'https://www.arcgis.com/sharing/rest'
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`
  }
  if (!url.includes('/sharing/rest')) {
    url = `${url}/sharing/rest`
  }
  return url
}

export function getOAuthRedirectUri(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:5173/'
  return `${window.location.origin}/`
}

const OAUTH_PENDING_KEY = 'oea-oauth-pending'

export interface OAuthPending {
  clientId: string
  portal: string
  redirectUri: string
}

export function saveOAuthPending(pending: OAuthPending) {
  sessionStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify(pending))
}

export function loadOAuthPending(): OAuthPending | null {
  try {
    const raw = sessionStorage.getItem(OAUTH_PENDING_KEY)
    return raw ? (JSON.parse(raw) as OAuthPending) : null
  } catch {
    return null
  }
}

export function clearOAuthPending() {
  sessionStorage.removeItem(OAUTH_PENDING_KEY)
}

/** True when this window loaded as an OAuth redirect target. */
export function isOAuthCallbackUrl(href = typeof window !== 'undefined' ? window.location.href : ''): boolean {
  return /[?#].*(?:code=|access_token=)/.test(href)
}

export async function signInWithPassword(
  portalUrl: string,
  username: string,
  password: string,
): Promise<ArcGISIdentityManager> {
  const portal = normalizePortalUrl(portalUrl)
  return ArcGISIdentityManager.signIn({
    username,
    password,
    portal,
    referer: typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
  })
}

export async function beginPortalOAuth(
  portalUrl: string,
  clientId: string,
): Promise<ArcGISIdentityManager | undefined> {
  const portal = normalizePortalUrl(portalUrl)
  const redirectUri = getOAuthRedirectUri()
  saveOAuthPending({ clientId: clientId.trim(), portal, redirectUri })
  return ArcGISIdentityManager.beginOAuth2({
    clientId: clientId.trim(),
    portal,
    redirectUri,
    popup: true,
    pkce: true,
  })
}

export async function completePortalOAuth(
  pending: OAuthPending = loadOAuthPending()!,
): Promise<ArcGISIdentityManager> {
  if (!pending?.clientId) {
    throw new Error('OAuth-config ontbreekt. Start opnieuw via Inloggen met OAuth.')
  }
  const manager = await ArcGISIdentityManager.completeOAuth2({
    clientId: pending.clientId,
    portal: pending.portal,
    redirectUri: pending.redirectUri,
    popup: true,
    pkce: true,
  })
  clearOAuthPending()
  return manager
}

export async function signInWithToken(
  portalUrl: string,
  token: string,
  username?: string,
): Promise<ArcGISIdentityManager> {
  const portal = normalizePortalUrl(portalUrl)
  return ArcGISIdentityManager.fromToken({
    token: token.trim(),
    portal,
    username: username?.trim() || undefined,
  })
}

export async function getPortalSelf(auth: ArcGISIdentityManager): Promise<PortalSelf> {
  return request(`${auth.portal}/portals/self`, {
    authentication: auth,
    httpMethod: 'GET',
  }) as Promise<PortalSelf>
}

export async function searchPortalItems(
  auth: ArcGISIdentityManager,
  query: string,
  options?: { start?: number; num?: number; type?: string },
): Promise<ISearchResult<PortalItem>> {
  const parts = [query.trim() || 'owner:me']
  if (options?.type) {
    parts.push(`type:"${options.type}"`)
  }
  return searchItems({
    q: parts.join(' AND '),
    start: options?.start ?? 1,
    num: options?.num ?? 50,
    sortField: 'modified',
    sortOrder: 'desc',
    authentication: auth,
  }) as Promise<ISearchResult<PortalItem>>
}

export async function fetchUserFolders(auth: ArcGISIdentityManager, username: string) {
  return getUserContent({
    owner: username,
    authentication: auth,
  })
}

export async function fetchItem(auth: ArcGISIdentityManager, id: string): Promise<PortalItem> {
  return getItem(id, { authentication: auth }) as Promise<PortalItem>
}

export async function fetchItemData(auth: ArcGISIdentityManager, id: string): Promise<unknown> {
  return getItemData(id, { authentication: auth })
}

export async function fetchWebMap(
  auth: ArcGISIdentityManager,
  id: string,
): Promise<{ item: PortalItem; data: WebMapData }> {
  const [item, raw] = await Promise.all([fetchItem(auth, id), fetchItemData(auth, id)])
  return { item, data: ensureWebMapShape(raw) }
}

export async function saveWebMapData(
  auth: ArcGISIdentityManager,
  itemId: string,
  data: WebMapData,
): Promise<void> {
  await updateItem({
    item: {
      id: itemId,
      text: data,
    },
    authentication: auth,
  })
}

export function itemThumbnailUrl(
  portalUrl: string,
  item: PortalItem,
  token?: string,
): string | null {
  if (!item.thumbnail) return null
  const base = `${portalUrl}/content/items/${item.id}/info/${item.thumbnail}`
  return token ? `${base}?token=${encodeURIComponent(token)}` : base
}

export const WEBMAP_TYPES = ['Web Map', 'Web Scene'] as const
