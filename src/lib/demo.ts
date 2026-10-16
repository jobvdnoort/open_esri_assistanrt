import type { PortalItem, PortalSelf, WebMapData } from '../types/arcgis'

export const DEMO_PORTAL: PortalSelf = {
  id: 'demo-org',
  name: 'Open Esri Assistant (Demo)',
  portalHostname: 'demo.local',
  user: {
    username: 'demo.user',
    fullName: 'Demo Gebruiker',
    email: 'demo@example.com',
  },
}

export const DEMO_ITEMS: PortalItem[] = [
  {
    id: 'demo-webmap-a',
    title: 'Stadsplan Centrum',
    type: 'Web Map',
    owner: 'demo.user',
    created: Date.now() - 1000 * 60 * 60 * 24 * 30,
    modified: Date.now() - 1000 * 60 * 60 * 2,
    access: 'private',
    snippet: 'Operationele lagen voor het stadscentrum, inclusief groepen voor verkeer en groen.',
    tags: ['demo', 'centrum'],
    description: 'Demo webmap A voor side-by-side kopiëren.',
  },
  {
    id: 'demo-webmap-b',
    title: 'Stadsplan Noord',
    type: 'Web Map',
    owner: 'demo.user',
    created: Date.now() - 1000 * 60 * 60 * 24 * 14,
    modified: Date.now() - 1000 * 60 * 30,
    access: 'private',
    snippet: 'Doelkaart waar je groepen naartoe kunt kopiëren.',
    tags: ['demo', 'noord'],
    description: 'Demo webmap B — ontvangende kaart.',
  },
  {
    id: 'demo-feature-layer',
    title: 'Bomen inventarisatie',
    type: 'Feature Service',
    owner: 'demo.user',
    created: Date.now() - 1000 * 60 * 60 * 24 * 60,
    modified: Date.now() - 1000 * 60 * 60 * 24,
    access: 'org',
    snippet: 'Voorbeeld Feature Service item (alleen metadata/JSON).',
    tags: ['demo', 'bomen'],
    url: 'https://sampleserver6.arcgisonline.com/arcgis/rest/services/Census/MapServer',
  },
]

const webmapA: WebMapData = {
  version: '2.31',
  operationalLayers: [
    {
      id: 'group_verkeer',
      layerType: 'GroupLayer',
      title: 'Verkeer',
      visibility: true,
      opacity: 1,
      layers: [
        {
          id: 'wegen_hoofd',
          layerType: 'ArcGISFeatureLayer',
          title: 'Hoofdwegen',
          url: 'https://sampleserver6.arcgisonline.com/arcgis/rest/services/Recreation/MapServer/0',
          visibility: true,
          opacity: 1,
        },
        {
          id: 'fietsroutes',
          layerType: 'ArcGISFeatureLayer',
          title: 'Fietsroutes',
          url: 'https://sampleserver6.arcgisonline.com/arcgis/rest/services/Recreation/MapServer/1',
          visibility: true,
          opacity: 0.9,
        },
      ],
    },
    {
      id: 'group_groen',
      layerType: 'GroupLayer',
      title: 'Groen & water',
      visibility: true,
      opacity: 1,
      layers: [
        {
          id: 'parken',
          layerType: 'ArcGISFeatureLayer',
          title: 'Parken',
          url: 'https://sampleserver6.arcgisonline.com/arcgis/rest/services/Census/MapServer/2',
          visibility: true,
        },
        {
          id: 'watergangen',
          layerType: 'ArcGISFeatureLayer',
          title: 'Watergangen',
          url: 'https://sampleserver6.arcgisonline.com/arcgis/rest/services/Census/MapServer/3',
          visibility: false,
        },
      ],
    },
    {
      id: 'adressen',
      layerType: 'ArcGISFeatureLayer',
      title: 'Adressen',
      url: 'https://sampleserver6.arcgisonline.com/arcgis/rest/services/Census/MapServer/0',
      visibility: true,
    },
  ],
  baseMap: {
    title: 'Topografisch',
    baseMapLayers: [
      {
        id: 'basemap',
        layerType: 'ArcGISTiledMapServiceLayer',
        title: 'World Topo',
        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer',
        visibility: true,
      },
    ],
  },
}

const webmapB: WebMapData = {
  version: '2.31',
  operationalLayers: [
    {
      id: 'group_basis',
      layerType: 'GroupLayer',
      title: 'Basislagen Noord',
      visibility: true,
      layers: [
        {
          id: 'wijken',
          layerType: 'ArcGISFeatureLayer',
          title: 'Wijken',
          url: 'https://sampleserver6.arcgisonline.com/arcgis/rest/services/Census/MapServer/1',
          visibility: true,
        },
      ],
    },
  ],
  baseMap: {
    title: 'Topografisch',
    baseMapLayers: [
      {
        id: 'basemap',
        layerType: 'ArcGISTiledMapServiceLayer',
        title: 'World Topo',
        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer',
        visibility: true,
      },
    ],
  },
}

const featureServiceData = {
  layers: [
    { id: 0, name: 'Trees', type: 'Feature Layer' },
    { id: 1, name: 'Species lookup', type: 'Table' },
  ],
}

const store = new Map<string, unknown>([
  ['demo-webmap-a', structuredClone(webmapA)],
  ['demo-webmap-b', structuredClone(webmapB)],
  ['demo-feature-layer', structuredClone(featureServiceData)],
])

export function demoSearch(query: string, type?: string) {
  const q = query.trim().toLowerCase()
  let results = DEMO_ITEMS.filter((item) => {
    if (type && item.type !== type) return false
    if (!q) return true
    return (
      item.title.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q) ||
      (item.tags ?? []).some((t) => t.toLowerCase().includes(q))
    )
  })
  return {
    total: results.length,
    start: 1,
    num: results.length,
    nextStart: -1,
    results,
  }
}

export function demoGetItem(id: string): PortalItem {
  const item = DEMO_ITEMS.find((i) => i.id === id)
  if (!item) throw new Error(`Demo item niet gevonden: ${id}`)
  return item
}

export function demoGetData(id: string): unknown {
  if (!store.has(id)) throw new Error(`Demo data niet gevonden: ${id}`)
  return structuredClone(store.get(id))
}

export function demoSaveWebMap(id: string, data: WebMapData): void {
  store.set(id, structuredClone(data))
  const item = DEMO_ITEMS.find((i) => i.id === id)
  if (item) item.modified = Date.now()
}

export function resetDemoData(): void {
  store.set('demo-webmap-a', structuredClone(webmapA))
  store.set('demo-webmap-b', structuredClone(webmapB))
  store.set('demo-feature-layer', structuredClone(featureServiceData))
}
