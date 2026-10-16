import { getItem, getItemData, updateItem } from '@esri/arcgis-rest-portal'
import type { ArcGISIdentityManager } from '@esri/arcgis-rest-request'
import type { PortalItem, WebMapData } from '../types/arcgis'
import { ensureWebMapShape } from './webmap'

export {
  beginPortalOAuth,
  clearOAuthPending,
  completePortalOAuth,
  getOAuthRedirectUri,
  getPortalSelf,
  isOAuthCallbackUrl,
  loadOAuthPending,
  normalizePortalUrl,
  saveOAuthPending,
  signInWithPassword,
  signInWithToken,
  type OAuthPending,
} from './portalAuth'

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
