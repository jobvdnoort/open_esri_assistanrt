import { describe, expect, it } from 'vitest'
import type { OperationalLayer } from '../types/arcgis'
import {
  buildLayerTree,
  getLayerAtPath,
  insertLayer,
  moveLayer,
  regenerateLayerIds,
  removeLayerAtPath,
  reorderSibling,
} from './webmap'

const sample: OperationalLayer[] = [
  {
    id: 'g1',
    layerType: 'GroupLayer',
    title: 'Groep A',
    layers: [
      { id: 'l1', layerType: 'ArcGISFeatureLayer', title: 'Laag 1' },
      { id: 'l2', layerType: 'ArcGISFeatureLayer', title: 'Laag 2' },
    ],
  },
  { id: 'l3', layerType: 'ArcGISFeatureLayer', title: 'Losse laag' },
]

describe('webmap helpers', () => {
  it('builds a tree with group children', () => {
    const tree = buildLayerTree(sample)
    expect(tree).toHaveLength(2)
    expect(tree[0].isGroup).toBe(true)
    expect(tree[0].children).toHaveLength(2)
    expect(tree[1].isGroup).toBe(false)
  })

  it('gets nested layers by path', () => {
    expect(getLayerAtPath(sample, [0, 1])?.title).toBe('Laag 2')
  })

  it('regenerates ids recursively', () => {
    const cloned = regenerateLayerIds(sample[0])
    expect(cloned.id).not.toBe('g1')
    expect(cloned.layers?.[0].id).not.toBe('l1')
    expect(cloned.title).toBe('Groep A')
  })

  it('copies a group into another group', () => {
    const group = sample[0]
    const next = insertLayer(sample, group, [0], 'into')
    expect(next[0].layers).toHaveLength(3)
    expect(next[0].layers?.[2].title).toBe('Groep A')
    expect(next[0].layers?.[2].id).not.toBe('g1')
  })

  it('copies a layer to root', () => {
    const layer = getLayerAtPath(sample, [0, 0])!
    const next = insertLayer(sample, layer, null, 'root')
    expect(next).toHaveLength(3)
    expect(next[2].title).toBe('Laag 1')
  })

  it('removes a nested layer', () => {
    const next = removeLayerAtPath(sample, [0, 0])
    expect(next[0].layers).toHaveLength(1)
    expect(next[0].layers?.[0].title).toBe('Laag 2')
  })

  it('moves a layer into another group without regenerating ids', () => {
    const withSecondGroup: OperationalLayer[] = [
      ...sample,
      {
        id: 'g2',
        layerType: 'GroupLayer',
        title: 'Groep B',
        layers: [],
      },
    ]
    const next = moveLayer(withSecondGroup, [0, 0], [2], 'into')
    expect(next[0].layers).toHaveLength(1)
    expect(next[0].layers?.[0].id).toBe('l2')
    expect(next[2].layers).toHaveLength(1)
    expect(next[2].layers?.[0].id).toBe('l1')
  })

  it('moves a nested layer to root', () => {
    const next = moveLayer(sample, [0, 1], null, 'root')
    expect(next[0].layers).toHaveLength(1)
    expect(next).toHaveLength(3)
    expect(next[2].id).toBe('l2')
  })

  it('reorders siblings', () => {
    const next = reorderSibling(sample, [0, 0], 1)
    expect(next[0].layers?.[0].id).toBe('l2')
    expect(next[0].layers?.[1].id).toBe('l1')
  })

  it('does not move a group into itself', () => {
    const next = moveLayer(sample, [0], [0, 0], 'into')
    expect(next).toEqual(sample)
  })
})
