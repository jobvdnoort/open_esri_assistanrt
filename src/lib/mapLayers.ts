/** Helpers to add layers to an ArcGIS JS Map (via esri-loader modules). */

export type LayerKind =
  | 'Feature Service'
  | 'Map Service'
  | 'CSV'
  | 'GeoJSON'
  | 'WMS'
  | 'WMTS'
  | 'auto'

export interface AddedLayerInfo {
  id: string
  title: string
  url?: string
  kind: string
}

type EsriMap = {
  add: (layer: unknown) => void
  remove: (layer: unknown) => void
  layers: { items: unknown[] }
}

type EsriView = {
  map: EsriMap
  goTo: (target: unknown) => Promise<unknown>
  whenLayerView?: (layer: unknown) => Promise<unknown>
}

function guessKind(url: string, explicit?: LayerKind): LayerKind {
  if (explicit && explicit !== 'auto') return explicit
  const u = url.toLowerCase()
  if (u.includes('featureserver') || u.includes('/featureServer'.toLowerCase())) {
    return 'Feature Service'
  }
  if (u.includes('mapserver') || u.includes('/mapServer'.toLowerCase())) return 'Map Service'
  if (u.endsWith('.geojson') || u.includes('geojson')) return 'GeoJSON'
  if (u.endsWith('.csv') || u.includes('csv')) return 'CSV'
  if (u.includes('wms')) return 'WMS'
  if (u.includes('wmts')) return 'WMTS'
  return 'Feature Service'
}

export async function createLayerFromUrl(
  url: string,
  options?: { title?: string; kind?: LayerKind },
): Promise<{ layer: { id?: string; title?: string; load: () => Promise<unknown>; fullExtent?: unknown }; info: AddedLayerInfo }> {
  const { loadModules } = await import('esri-loader')
  const kind = guessKind(url, options?.kind)
  const title = options?.title || url.split('/').filter(Boolean).slice(-2).join('/') || 'Layer'
  const id = `lyr_${Date.now().toString(36)}`

  if (kind === 'Map Service') {
    const [MapImageLayer] = await loadModules(['esri/layers/MapImageLayer'])
    const layer = new MapImageLayer({ url, id, title })
    return { layer, info: { id, title, url, kind } }
  }
  if (kind === 'CSV') {
    const [CSVLayer] = await loadModules(['esri/layers/CSVLayer'])
    const layer = new CSVLayer({ url, id, title })
    return { layer, info: { id, title, url, kind } }
  }
  if (kind === 'GeoJSON') {
    const [GeoJSONLayer] = await loadModules(['esri/layers/GeoJSONLayer'])
    const layer = new GeoJSONLayer({ url, id, title })
    return { layer, info: { id, title, url, kind } }
  }
  if (kind === 'WMS') {
    const [WMSLayer] = await loadModules(['esri/layers/WMSLayer'])
    const layer = new WMSLayer({ url, id, title })
    return { layer, info: { id, title, url, kind } }
  }
  if (kind === 'WMTS') {
    const [WMTSLayer] = await loadModules(['esri/layers/WMTSLayer'])
    const layer = new WMTSLayer({ url, id, title })
    return { layer, info: { id, title, url, kind } }
  }

  const [FeatureLayer] = await loadModules(['esri/layers/FeatureLayer'])
  const layer = new FeatureLayer({ url, id, title })
  return { layer, info: { id, title, url, kind: 'Feature Service' } }
}

export async function createLayerFromPortalItem(
  itemId: string,
  options?: { title?: string; url?: string; type?: string },
): Promise<{ layer: { id?: string; title?: string; load: () => Promise<unknown>; fullExtent?: unknown }; info: AddedLayerInfo }> {
  // Prefer service URL when available (works without portal item auth quirks).
  if (options?.url) {
    const kind =
      options.type === 'Map Service'
        ? 'Map Service'
        : options.type === 'Feature Service'
          ? 'Feature Service'
          : 'auto'
    return createLayerFromUrl(options.url, { title: options.title, kind })
  }

  const { loadModules } = await import('esri-loader')
  const [Layer] = await loadModules(['esri/layers/Layer'])
  const layer = await Layer.fromPortalItem({
    portalItem: { id: itemId },
  })
  const id = layer.id || `lyr_${itemId}`
  const title = options?.title || layer.title || itemId
  layer.id = id
  layer.title = title
  return {
    layer,
    info: { id, title, kind: options?.type || 'Portal item' },
  }
}

export async function createLayerFromFile(
  file: File,
): Promise<{ layer: { id?: string; title?: string; load: () => Promise<unknown>; fullExtent?: unknown }; info: AddedLayerInfo }> {
  const name = file.name.replace(/\.[^.]+$/, '')
  const id = `lyr_${Date.now().toString(36)}`
  const lower = file.name.toLowerCase()
  const { loadModules } = await import('esri-loader')

  if (lower.endsWith('.geojson') || lower.endsWith('.json')) {
    const text = await file.text()
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const [GeoJSONLayer] = await loadModules(['esri/layers/GeoJSONLayer'])
    const layer = new GeoJSONLayer({ url, id, title: name })
    return { layer, info: { id, title: name, kind: 'GeoJSON' } }
  }

  if (lower.endsWith('.csv')) {
    const text = await file.text()
    const blob = new Blob([text], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const [CSVLayer] = await loadModules(['esri/layers/CSVLayer'])
    const layer = new CSVLayer({ url, id, title: name })
    return { layer, info: { id, title: name, kind: 'CSV' } }
  }

  throw new Error('Ondersteunde bestanden: .geojson, .json, .csv')
}

export async function addLayerToView(
  view: EsriView,
  layer: { load: () => Promise<unknown>; fullExtent?: unknown },
  zoomTo = true,
) {
  view.map.add(layer)
  await layer.load()
  if (zoomTo && layer.fullExtent) {
    try {
      await view.goTo(layer.fullExtent)
    } catch {
      /* ignore zoom failures */
    }
  }
}

export const LAYER_SEARCH_TYPES = [
  { value: '', label: 'All layer types' },
  { value: 'Feature Service', label: 'Feature layer' },
  { value: 'Map Service', label: 'Map image layer' },
  { value: 'Scene Service', label: 'Scene layer' },
  { value: 'Image Service', label: 'Imagery layer' },
  { value: 'Vector Tile Service', label: 'Vector tile layer' },
] as const
