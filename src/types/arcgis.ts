export interface PortalItem {
  id: string
  title: string
  type: string
  typeKeywords?: string[]
  description?: string
  snippet?: string
  tags?: string[]
  owner: string
  created: number
  modified: number
  access: string
  url?: string
  thumbnail?: string
  numViews?: number
  size?: number
  ownerFolder?: string
}

export interface PortalSelf {
  id: string
  name: string
  portalHostname: string
  urlKey?: string
  customBaseUrl?: string
  user?: {
    username: string
    fullName?: string
    email?: string
  }
}

export interface OperationalLayer {
  id?: string
  title?: string
  layerType?: string
  url?: string
  itemId?: string
  visibility?: boolean
  opacity?: number
  layers?: OperationalLayer[]
  [key: string]: unknown
}

export interface WebMapData {
  operationalLayers?: OperationalLayer[]
  baseMap?: {
    baseMapLayers?: OperationalLayer[]
    title?: string
  }
  version?: string
  [key: string]: unknown
}

export type LayerPath = number[]

export interface LayerNode {
  path: LayerPath
  layer: OperationalLayer
  depth: number
  isGroup: boolean
  children: LayerNode[]
}
