import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Folder,
  FolderInput,
  Layers,
  Move,
  Trash2,
} from 'lucide-react'
import { useState, type DragEvent } from 'react'
import type { LayerNode, LayerPath, OperationalLayer } from '../types/arcgis'
import { OEA_DND_MIME, parseDragPayload, serializeDragPayload, type PaneSide } from '../lib/dnd'
import { buildLayerTree, canReorder, countDescendants, getLayerAtPath, pathsEqual } from '../lib/webmap'
import { ConfirmDialog } from './ConfirmDialog'

export type DropPosition = 'into' | 'before' | 'after'

export interface TreeDropEvent {
  position: DropPosition | 'root'
  targetPath: LayerPath | null
  payloadPath: LayerPath
  payloadLayer: OperationalLayer
  fromSide: PaneSide | 'local'
  samePane: boolean
}

interface LayerTreeProps {
  layers: OperationalLayer[]
  selectedPath: LayerPath | null
  onSelect: (path: LayerPath) => void
  onCopy?: (path: LayerPath) => void
  copyLabel?: string
  emptyLabel?: string
  enableReorder?: boolean
  /** Identifies this tree for cross-pane drag-and-drop. */
  side?: PaneSide
  onReorder?: (path: LayerPath, direction: -1 | 1) => void
  onMove?: (from: LayerPath, to: LayerPath | null, position: DropPosition | 'root') => void
  onDropLayer?: (event: TreeDropEvent) => void
  onDelete?: (path: LayerPath) => void
}

function pathKey(path: LayerPath) {
  return path.join('.')
}

function resolveDropPosition(
  e: DragEvent,
  isGroup: boolean,
): DropPosition {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const ratio = (e.clientY - rect.top) / rect.height
  if (isGroup && ratio > 0.25 && ratio < 0.75) return 'into'
  if (ratio < 0.35) return 'before'
  return 'after'
}

function NodeRow({
  node,
  layers,
  side,
  selectedPath,
  onSelect,
  onCopy,
  copyLabel,
  expanded,
  onToggle,
  enableReorder,
  onReorder,
  onMove,
  onDropLayer,
  onDelete,
  draggingPath,
  setDraggingPath,
  dropTarget,
  setDropTarget,
}: {
  node: LayerNode
  layers: OperationalLayer[]
  side?: PaneSide
  selectedPath: LayerPath | null
  onSelect: (path: LayerPath) => void
  onCopy?: (path: LayerPath) => void
  copyLabel?: string
  expanded: Set<string>
  onToggle: (key: string) => void
  enableReorder?: boolean
  onReorder?: (path: LayerPath, direction: -1 | 1) => void
  onMove?: (from: LayerPath, to: LayerPath | null, position: DropPosition | 'root') => void
  onDropLayer?: (event: TreeDropEvent) => void
  onDelete?: (path: LayerPath) => void
  draggingPath: LayerPath | null
  setDraggingPath: (path: LayerPath | null) => void
  dropTarget: { path: LayerPath; position: DropPosition } | null
  setDropTarget: (value: { path: LayerPath; position: DropPosition } | null) => void
}) {
  const key = pathKey(node.path)
  const isOpen = expanded.has(key)
  const selected = selectedPath && pathKey(selectedPath) === key
  const visible = node.layer.visibility !== false
  const isDragging = draggingPath && pathsEqual(draggingPath, node.path)
  const isDropInto =
    dropTarget && pathsEqual(dropTarget.path, node.path) && dropTarget.position === 'into'
  const isDropBefore =
    dropTarget && pathsEqual(dropTarget.path, node.path) && dropTarget.position === 'before'
  const isDropAfter =
    dropTarget && pathsEqual(dropTarget.path, node.path) && dropTarget.position === 'after'

  const dndEnabled = Boolean(enableReorder && (onMove || onDropLayer))

  const onDragStart = (e: DragEvent) => {
    if (!dndEnabled) return
    const payload = serializeDragPayload({
      source: side ?? 'local',
      path: node.path,
      layer: node.layer,
      mode: 'move',
    })
    e.dataTransfer.setData(OEA_DND_MIME, payload)
    e.dataTransfer.setData('text/plain', pathKey(node.path))
    e.dataTransfer.effectAllowed = 'copyMove'
    setDraggingPath(node.path)
  }

  const onDragOver = (e: DragEvent) => {
    if (!dndEnabled) return
    const types = Array.from(e.dataTransfer.types)
    if (!types.includes(OEA_DND_MIME) && !draggingPath) return
    if (draggingPath && pathsEqual(draggingPath, node.path)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = types.includes(OEA_DND_MIME) ? 'copy' : 'move'
    setDropTarget({ path: node.path, position: resolveDropPosition(e, node.isGroup) })
  }

  const onDrop = (e: DragEvent) => {
    if (!dndEnabled || !dropTarget || !pathsEqual(dropTarget.path, node.path)) return
    e.preventDefault()
    const raw = e.dataTransfer.getData(OEA_DND_MIME)
    const payload = parseDragPayload(raw)

    if (payload && onDropLayer) {
      onDropLayer({
        position: dropTarget.position,
        targetPath: node.path,
        payloadPath: payload.path,
        payloadLayer: payload.layer,
        fromSide: payload.source,
        samePane: payload.source === side || payload.source === 'local',
      })
    } else if (draggingPath && onMove) {
      onMove(draggingPath, node.path, dropTarget.position)
    }

    setDraggingPath(null)
    setDropTarget(null)
  }

  return (
    <li>
      <div
        className={[
          'layer-row',
          selected ? 'layer-row--selected' : '',
          isDragging ? 'layer-row--dragging' : '',
          isDropInto ? 'layer-row--drop-into' : '',
          isDropBefore ? 'layer-row--drop-before' : '',
          isDropAfter ? 'layer-row--drop-after' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ paddingLeft: `${0.65 + node.depth * 1.1}rem` }}
        draggable={dndEnabled}
        onDragStart={onDragStart}
        onDragEnd={() => {
          setDraggingPath(null)
          setDropTarget(null)
        }}
        onDragOver={onDragOver}
        onDragLeave={() => {
          if (dropTarget && pathsEqual(dropTarget.path, node.path)) setDropTarget(null)
        }}
        onDrop={onDrop}
      >
        {node.isGroup ? (
          <button
            type="button"
            className="layer-row__twist"
            onClick={() => onToggle(key)}
            aria-label={isOpen ? 'Inklappen' : 'Uitklappen'}
          >
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="layer-row__twist layer-row__twist--spacer" />
        )}

        <button type="button" className="layer-row__main" onClick={() => onSelect(node.path)}>
          <span className={`layer-row__icon ${node.isGroup ? 'is-group' : 'is-layer'}`}>
            {node.isGroup ? <Folder size={15} /> : <Layers size={15} />}
          </span>
          <span className="layer-row__title">{node.layer.title || node.layer.id || 'Naamloos'}</span>
          <span className="layer-row__meta">
            {node.isGroup ? 'Groep' : node.layer.layerType?.replace(/^ArcGIS/, '') || 'Laag'}
          </span>
          <span className="layer-row__vis" title={visible ? 'Zichtbaar' : 'Verborgen'}>
            {visible ? <Eye size={13} /> : <EyeOff size={13} />}
          </span>
        </button>

        {enableReorder && onReorder && (
          <div className="layer-row__reorder">
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              disabled={!canReorder(layers, node.path, -1)}
              onClick={() => onReorder(node.path, -1)}
              title="Omhoog"
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              disabled={!canReorder(layers, node.path, 1)}
              onClick={() => onReorder(node.path, 1)}
              title="Omlaag"
            >
              <ArrowDown size={14} />
            </button>
          </div>
        )}

        {enableReorder &&
          onMove &&
          node.isGroup &&
          draggingPath &&
          !pathsEqual(draggingPath, node.path) && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                onMove(draggingPath, node.path, 'into')
                setDraggingPath(null)
                setDropTarget(null)
              }}
              title="Verplaats hierheen"
            >
              <FolderInput size={14} />
              Hier
            </button>
          )}

        {enableReorder && onMove && (
          <button
            type="button"
            className={`btn btn--ghost btn--icon ${isDragging ? 'is-active' : ''}`}
            onClick={() => setDraggingPath(isDragging ? null : node.path)}
            title="Markeer om te verplaatsen"
          >
            <Move size={14} />
          </button>
        )}

        {onCopy && (
          <button
            type="button"
            className="btn btn--ghost btn--sm layer-row__copy"
            onClick={() => onCopy(node.path)}
            title={copyLabel}
          >
            <Copy size={14} />
            <span>{copyLabel ?? 'Kopieer'}</span>
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            className="btn btn--ghost btn--icon layer-row__delete"
            onClick={() => onDelete(node.path)}
            title={node.isGroup ? 'Groep verwijderen' : 'Laag / service verwijderen'}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {node.isGroup && isOpen && node.children.length > 0 && (
        <ul className="layer-tree__list">
          {node.children.map((child) => (
            <NodeRow
              key={pathKey(child.path)}
              node={child}
              layers={layers}
              side={side}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onCopy={onCopy}
              copyLabel={copyLabel}
              expanded={expanded}
              onToggle={onToggle}
              enableReorder={enableReorder}
              onReorder={onReorder}
              onMove={onMove}
              onDropLayer={onDropLayer}
              onDelete={onDelete}
              draggingPath={draggingPath}
              setDraggingPath={setDraggingPath}
              dropTarget={dropTarget}
              setDropTarget={setDropTarget}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function LayerTree({
  layers,
  selectedPath,
  onSelect,
  onCopy,
  copyLabel = 'Kopieer →',
  emptyLabel = 'Geen operationele lagen',
  enableReorder,
  side,
  onReorder,
  onMove,
  onDropLayer,
  onDelete,
}: LayerTreeProps) {
  const tree = buildLayerTree(layers)
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    tree.forEach((n) => {
      if (n.isGroup) initial.add(pathKey(n.path))
    })
    return initial
  })
  const [draggingPath, setDraggingPath] = useState<LayerPath | null>(null)
  const [dropTarget, setDropTarget] = useState<{ path: LayerPath; position: DropPosition } | null>(
    null,
  )
  const [pendingDelete, setPendingDelete] = useState<LayerPath | null>(null)

  const pendingLayer = pendingDelete ? getLayerAtPath(layers, pendingDelete) : null
  const pendingIsGroup = pendingLayer
    ? pendingLayer.layerType === 'GroupLayer' || Array.isArray(pendingLayer.layers)
    : false
  const pendingDesc = pendingLayer && pendingIsGroup ? countDescendants(pendingLayer) : { layers: 0, groups: 0 }

  const onToggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (tree.length === 0) {
    return (
      <div
        className="layer-tree layer-tree--empty"
        onDragOver={(e) => {
          if (!onDropLayer) return
          if (!Array.from(e.dataTransfer.types).includes(OEA_DND_MIME)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={(e) => {
          if (!onDropLayer) return
          const payload = parseDragPayload(e.dataTransfer.getData(OEA_DND_MIME))
          if (!payload) return
          e.preventDefault()
          onDropLayer({
            position: 'root',
            targetPath: null,
            payloadPath: payload.path,
            payloadLayer: payload.layer,
            fromSide: payload.source,
            samePane: payload.source === side || payload.source === 'local',
          })
        }}
      >
        <p className="muted empty-panel">{emptyLabel}</p>
      </div>
    )
  }

  const deleteTitle = pendingIsGroup ? 'Groep verwijderen?' : 'Laag / service verwijderen?'
  const deleteName = pendingLayer?.title || pendingLayer?.id || 'dit item'
  const nestedSummary =
    pendingDesc.layers + pendingDesc.groups > 0
      ? ` Dit verwijdert ook ${pendingDesc.layers} onderliggende laag${pendingDesc.layers === 1 ? '' : 'en'} en ${pendingDesc.groups} geneste groep${pendingDesc.groups === 1 ? '' : 'en'}.`
      : ''
  const deleteMessage = pendingIsGroup
    ? `Weet je zeker dat je de groep “${deleteName}” wilt verwijderen?${nestedSummary} Dit wordt pas definitief na Opslaan.`
    : `Weet je zeker dat je “${deleteName}” (${pendingLayer?.layerType || 'laag'}) wilt verwijderen uit deze webmap? De service zelf in het portaal blijft bestaan. Dit wordt pas definitief na Opslaan.`

  return (
    <div className="layer-tree">
      {enableReorder && draggingPath && (
        <div className="layer-tree__move-bar">
          <Move size={14} />
          <span>Sleep naar een groep/laag, of naar de andere webmap:</span>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => {
              onMove?.(draggingPath, null, 'root')
              setDraggingPath(null)
            }}
          >
            Naar root
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setDraggingPath(null)}
          >
            Annuleren
          </button>
        </div>
      )}
      <ul className="layer-tree__list layer-tree__list--root">
        {tree.map((node) => (
          <NodeRow
            key={pathKey(node.path)}
            node={node}
            layers={layers}
            side={side}
            selectedPath={selectedPath}
            onSelect={onSelect}
            onCopy={onCopy}
            copyLabel={copyLabel}
            expanded={expanded}
            onToggle={onToggle}
            enableReorder={enableReorder}
            onReorder={onReorder}
            onMove={onMove}
            onDropLayer={onDropLayer}
            onDelete={onDelete ? (path) => setPendingDelete(path) : undefined}
            draggingPath={draggingPath}
            setDraggingPath={setDraggingPath}
            dropTarget={dropTarget}
            setDropTarget={setDropTarget}
          />
        ))}
      </ul>

      <ConfirmDialog
        open={Boolean(pendingDelete && pendingLayer)}
        title={deleteTitle}
        message={deleteMessage}
        confirmLabel="Ja, verwijderen"
        cancelLabel="Annuleren"
        onConfirm={() => {
          if (pendingDelete) onDelete?.(pendingDelete)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
