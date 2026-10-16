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
import { buildLayerTree, canReorder, countDescendants, pathsEqual } from '../lib/webmap'
import { ConfirmDialog } from './ConfirmDialog'

export type DropPosition = 'into' | 'before' | 'after'

interface LayerTreeProps {
  layers: OperationalLayer[]
  selectedPath: LayerPath | null
  onSelect: (path: LayerPath) => void
  onCopy?: (path: LayerPath) => void
  copyLabel?: string
  emptyLabel?: string
  /** Enable within-map reorder / move-between-groups. */
  enableReorder?: boolean
  onReorder?: (path: LayerPath, direction: -1 | 1) => void
  onMove?: (from: LayerPath, to: LayerPath | null, position: DropPosition | 'root') => void
  onDelete?: (path: LayerPath) => void
}

function pathKey(path: LayerPath) {
  return path.join('.')
}

function NodeRow({
  node,
  layers,
  selectedPath,
  onSelect,
  onCopy,
  copyLabel,
  expanded,
  onToggle,
  enableReorder,
  onReorder,
  onMove,
  onDelete,
  draggingPath,
  setDraggingPath,
  dropTarget,
  setDropTarget,
}: {
  node: LayerNode
  layers: OperationalLayer[]
  selectedPath: LayerPath | null
  onSelect: (path: LayerPath) => void
  onCopy?: (path: LayerPath) => void
  copyLabel?: string
  expanded: Set<string>
  onToggle: (key: string) => void
  enableReorder?: boolean
  onReorder?: (path: LayerPath, direction: -1 | 1) => void
  onMove?: (from: LayerPath, to: LayerPath | null, position: DropPosition | 'root') => void
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

  const onDragStart = (e: DragEvent) => {
    if (!enableReorder || !onMove) return
    e.dataTransfer.setData('text/plain', pathKey(node.path))
    e.dataTransfer.effectAllowed = 'move'
    setDraggingPath(node.path)
  }

  const onDragOver = (e: DragEvent) => {
    if (!enableReorder || !onMove || !draggingPath) return
    if (pathsEqual(draggingPath, node.path)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    const ratio = y / rect.height
    let position: DropPosition = 'after'
    if (node.isGroup && ratio > 0.25 && ratio < 0.75) position = 'into'
    else if (ratio < 0.35) position = 'before'
    else position = 'after'
    setDropTarget({ path: node.path, position })
  }

  const onDrop = (e: DragEvent) => {
    if (!enableReorder || !onMove || !draggingPath || !dropTarget) return
    e.preventDefault()
    if (!pathsEqual(dropTarget.path, node.path)) return
    onMove(draggingPath, node.path, dropTarget.position)
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
        draggable={Boolean(enableReorder && onMove)}
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

        {enableReorder && onMove && node.isGroup && draggingPath && !pathsEqual(draggingPath, node.path) && (
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
            title="Sleep of markeer om te verplaatsen binnen deze webmap"
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
              selectedPath={selectedPath}
              onSelect={onSelect}
              onCopy={onCopy}
              copyLabel={copyLabel}
              expanded={expanded}
              onToggle={onToggle}
              enableReorder={enableReorder}
              onReorder={onReorder}
              onMove={onMove}
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
  onReorder,
  onMove,
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

  const pendingLayer = pendingDelete ? getLayerFromTree(tree, pendingDelete) : null
  const pendingDesc =
    pendingLayer && pendingLayer.isGroup
      ? countDescendants(pendingLayer.layer)
      : { layers: 0, groups: 0 }

  const requestDelete = (path: LayerPath) => {
    setPendingDelete(path)
  }

  const confirmDelete = () => {
    if (pendingDelete && onDelete) onDelete(pendingDelete)
    setPendingDelete(null)
  }

  const onToggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (tree.length === 0) {
    return <p className="muted empty-panel">{emptyLabel}</p>
  }

  const deleteTitle = pendingLayer?.isGroup ? 'Groep verwijderen?' : 'Laag / service verwijderen?'
  const deleteName = pendingLayer?.layer.title || pendingLayer?.layer.id || 'dit item'
  const nestedSummary =
    pendingDesc.layers + pendingDesc.groups > 0
      ? ` Dit verwijdert ook ${pendingDesc.layers} onderliggende laag${pendingDesc.layers === 1 ? '' : 'en'} en ${pendingDesc.groups} geneste groep${pendingDesc.groups === 1 ? '' : 'en'}.`
      : ''
  const deleteMessage = pendingLayer?.isGroup
    ? `Weet je zeker dat je de groep “${deleteName}” wilt verwijderen?${nestedSummary} Dit wordt pas definitief na Opslaan.`
    : `Weet je zeker dat je “${deleteName}” (${pendingLayer?.layer.layerType || 'laag'}) wilt verwijderen uit deze webmap? De service zelf in het portaal blijft bestaan. Dit wordt pas definitief na Opslaan.`

  return (
    <div className="layer-tree">
      {enableReorder && draggingPath && (
        <div className="layer-tree__move-bar">
          <Move size={14} />
          <span>Verplaatsen… sleep naar een groep of laag, of:</span>
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
      <ul
        className="layer-tree__list layer-tree__list--root"
        onDragOver={(e) => {
          if (!enableReorder || !onMove || !draggingPath) return
          // Allow dropping on empty root area below list via the bar only
          e.preventDefault()
        }}
      >
        {tree.map((node) => (
          <NodeRow
            key={pathKey(node.path)}
            node={node}
            layers={layers}
            selectedPath={selectedPath}
            onSelect={onSelect}
            onCopy={onCopy}
            copyLabel={copyLabel}
            expanded={expanded}
            onToggle={onToggle}
            enableReorder={enableReorder}
            onReorder={onReorder}
            onMove={onMove}
            onDelete={onDelete ? requestDelete : undefined}
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
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

function getLayerFromTree(nodes: LayerNode[], path: LayerPath): LayerNode | null {
  let list = nodes
  let found: LayerNode | null = null
  for (const index of path) {
    found = list[index] ?? null
    if (!found) return null
    list = found.children
  }
  return found
}
