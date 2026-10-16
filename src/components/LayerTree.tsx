import {
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Folder,
  Layers,
} from 'lucide-react'
import { useState } from 'react'
import type { LayerNode, LayerPath, OperationalLayer } from '../types/arcgis'
import { buildLayerTree } from '../lib/webmap'

interface LayerTreeProps {
  layers: OperationalLayer[]
  selectedPath: LayerPath | null
  onSelect: (path: LayerPath) => void
  onCopy?: (path: LayerPath) => void
  copyLabel?: string
  emptyLabel?: string
}

function pathKey(path: LayerPath) {
  return path.join('.')
}

function NodeRow({
  node,
  selectedPath,
  onSelect,
  onCopy,
  copyLabel,
  expanded,
  onToggle,
}: {
  node: LayerNode
  selectedPath: LayerPath | null
  onSelect: (path: LayerPath) => void
  onCopy?: (path: LayerPath) => void
  copyLabel?: string
  expanded: Set<string>
  onToggle: (key: string) => void
}) {
  const key = pathKey(node.path)
  const isOpen = expanded.has(key)
  const selected = selectedPath && pathKey(selectedPath) === key
  const visible = node.layer.visibility !== false

  return (
    <li>
      <div
        className={`layer-row ${selected ? 'layer-row--selected' : ''}`}
        style={{ paddingLeft: `${0.65 + node.depth * 1.1}rem` }}
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
      </div>

      {node.isGroup && isOpen && node.children.length > 0 && (
        <ul className="layer-tree__list">
          {node.children.map((child) => (
            <NodeRow
              key={pathKey(child.path)}
              node={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onCopy={onCopy}
              copyLabel={copyLabel}
              expanded={expanded}
              onToggle={onToggle}
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
}: LayerTreeProps) {
  const tree = buildLayerTree(layers)
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    tree.forEach((n) => {
      if (n.isGroup) initial.add(pathKey(n.path))
    })
    return initial
  })

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

  return (
    <ul className="layer-tree__list layer-tree__list--root">
      {tree.map((node) => (
        <NodeRow
          key={pathKey(node.path)}
          node={node}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onCopy={onCopy}
          copyLabel={copyLabel}
          expanded={expanded}
          onToggle={onToggle}
        />
      ))}
    </ul>
  )
}
