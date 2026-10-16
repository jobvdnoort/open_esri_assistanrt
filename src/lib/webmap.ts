import type { LayerNode, LayerPath, OperationalLayer, WebMapData } from '../types/arcgis'

export function isGroupLayer(layer: OperationalLayer): boolean {
  return layer.layerType === 'GroupLayer' || Array.isArray(layer.layers)
}

export function buildLayerTree(layers: OperationalLayer[] = [], parentPath: LayerPath = [], depth = 0): LayerNode[] {
  return layers.map((layer, index) => {
    const path = [...parentPath, index]
    const children = isGroupLayer(layer)
      ? buildLayerTree(layer.layers ?? [], path, depth + 1)
      : []
    return {
      path,
      layer,
      depth,
      isGroup: isGroupLayer(layer),
      children,
    }
  })
}

export function getLayerAtPath(layers: OperationalLayer[], path: LayerPath): OperationalLayer | null {
  if (path.length === 0) return null
  let current: OperationalLayer | undefined
  let list = layers
  for (const index of path) {
    current = list[index]
    if (!current) return null
    list = current.layers ?? []
  }
  return current ?? null
}

export function cloneLayerDeep<T>(value: T): T {
  return structuredClone(value)
}

export function pathsEqual(a: LayerPath | null | undefined, b: LayerPath | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

/** True if `ancestor` is a strict prefix of `path` (moving a group into itself). */
export function isAncestorPath(ancestor: LayerPath, path: LayerPath): boolean {
  if (ancestor.length >= path.length) return false
  return ancestor.every((v, i) => v === path[i])
}

/** Regenerate layer ids so pasted layers don't collide with existing ones. */
export function regenerateLayerIds(layer: OperationalLayer): OperationalLayer {
  const clone = cloneLayerDeep(layer)
  const stamp = Date.now().toString(36)
  let counter = 0

  const walk = (node: OperationalLayer) => {
    const base = (node.id ?? node.title ?? 'layer').toString().replace(/\s+/g, '_')
    node.id = `${base}_${stamp}_${counter++}`
    if (node.layers?.length) {
      node.layers.forEach(walk)
    }
  }

  walk(clone)
  return clone
}

/**
 * After removing `fromPath`, adjust `targetPath` indices that shifted.
 */
export function adjustPathAfterRemoval(fromPath: LayerPath, targetPath: LayerPath): LayerPath {
  const depth = fromPath.length - 1
  if (depth < 0) return targetPath
  if (targetPath.length <= depth) return targetPath
  if (!fromPath.slice(0, depth).every((v, i) => v === targetPath[i])) return targetPath
  if (targetPath[depth] > fromPath[depth]) {
    const next = [...targetPath]
    next[depth] -= 1
    return next
  }
  return targetPath
}

export function insertLayer(
  layers: OperationalLayer[],
  layer: OperationalLayer,
  targetPath: LayerPath | null,
  position: 'into' | 'before' | 'after' | 'root' = 'root',
  options?: { regenerateIds?: boolean },
): OperationalLayer[] {
  const next = cloneLayerDeep(layers)
  const toInsert =
    options?.regenerateIds === false ? cloneLayerDeep(layer) : regenerateLayerIds(layer)

  if (position === 'root' || !targetPath || targetPath.length === 0) {
    next.push(toInsert)
    return next
  }

  if (position === 'into') {
    const parent = getLayerAtPath(next, targetPath)
    if (!parent || !isGroupLayer(parent)) {
      next.push(toInsert)
      return next
    }
    parent.layers = [...(parent.layers ?? []), toInsert]
    return next
  }

  const parentPath = targetPath.slice(0, -1)
  const index = targetPath[targetPath.length - 1]
  const siblings =
    parentPath.length === 0
      ? next
      : (getLayerAtPath(next, parentPath)?.layers ?? null)

  if (!siblings || index === undefined) {
    next.push(toInsert)
    return next
  }

  const insertAt = position === 'before' ? index : index + 1
  siblings.splice(insertAt, 0, toInsert)
  return next
}

export function removeLayerAtPath(layers: OperationalLayer[], path: LayerPath): OperationalLayer[] {
  const next = cloneLayerDeep(layers)
  if (path.length === 0) return next

  if (path.length === 1) {
    next.splice(path[0], 1)
    return next
  }

  const parentPath = path.slice(0, -1)
  const index = path[path.length - 1]
  const parent = getLayerAtPath(next, parentPath)
  if (parent?.layers) {
    parent.layers.splice(index, 1)
  }
  return next
}

export function moveLayer(
  layers: OperationalLayer[],
  fromPath: LayerPath,
  toPath: LayerPath | null,
  position: 'into' | 'before' | 'after' | 'root' = 'root',
): OperationalLayer[] {
  const source = getLayerAtPath(layers, fromPath)
  if (!source) return layers

  if (toPath && (pathsEqual(fromPath, toPath) || isAncestorPath(fromPath, toPath))) {
    return layers
  }

  const without = removeLayerAtPath(layers, fromPath)
  const adjustedTarget =
    toPath && toPath.length > 0 ? adjustPathAfterRemoval(fromPath, toPath) : toPath

  return insertLayer(without, source, adjustedTarget, position, { regenerateIds: false })
}

/** Move one step up/down among siblings. */
export function reorderSibling(
  layers: OperationalLayer[],
  path: LayerPath,
  direction: -1 | 1,
): OperationalLayer[] {
  if (path.length === 0) return layers
  const next = cloneLayerDeep(layers)
  const parentPath = path.slice(0, -1)
  const index = path[path.length - 1]
  const siblings =
    parentPath.length === 0 ? next : getLayerAtPath(next, parentPath)?.layers
  if (!siblings) return layers

  const target = index + direction
  if (target < 0 || target >= siblings.length) return layers
  ;[siblings[index], siblings[target]] = [siblings[target], siblings[index]]
  return next
}

export function canReorder(
  layers: OperationalLayer[],
  path: LayerPath,
  direction: -1 | 1,
): boolean {
  if (path.length === 0) return false
  const parentPath = path.slice(0, -1)
  const index = path[path.length - 1]
  const siblings =
    parentPath.length === 0 ? layers : getLayerAtPath(layers, parentPath)?.layers
  if (!siblings) return false
  const target = index + direction
  return target >= 0 && target < siblings.length
}

export function countLayers(layers: OperationalLayer[] = []): { layers: number; groups: number } {
  let layerCount = 0
  let groupCount = 0
  const walk = (list: OperationalLayer[]) => {
    for (const layer of list) {
      if (isGroupLayer(layer)) {
        groupCount += 1
        walk(layer.layers ?? [])
      } else {
        layerCount += 1
      }
    }
  }
  walk(layers)
  return { layers: layerCount, groups: groupCount }
}

/** Count nested layers/groups under a node (excluding the node itself). */
export function countDescendants(layer: OperationalLayer): { layers: number; groups: number } {
  if (!isGroupLayer(layer)) return { layers: 0, groups: 0 }
  return countLayers(layer.layers ?? [])
}

export function ensureWebMapShape(data: unknown): WebMapData {
  if (!data || typeof data !== 'object') {
    return { operationalLayers: [], version: '2.31' }
  }
  const map = data as WebMapData
  if (!Array.isArray(map.operationalLayers)) {
    map.operationalLayers = []
  }
  return map
}
