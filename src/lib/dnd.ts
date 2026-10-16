import type { LayerPath, OperationalLayer } from '../types/arcgis'

export const OEA_DND_MIME = 'application/x-oea-layer'

export type PaneSide = 'left' | 'right'

export interface LayerDragPayload {
  source: PaneSide | 'local'
  path: LayerPath
  layer: OperationalLayer
  /** When true, drop on same pane moves; cross-pane always copies. */
  mode: 'move' | 'copy'
}

export function serializeDragPayload(payload: LayerDragPayload): string {
  return JSON.stringify(payload)
}

export function parseDragPayload(raw: string | undefined | null): LayerDragPayload | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as LayerDragPayload
    if (!data?.layer || !Array.isArray(data.path)) return null
    return data
  } catch {
    return null
  }
}
