import {
  ArrowLeft,
  Eye,
  FolderInput,
  Redo2,
  RotateCcw,
  Save,
  Undo2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useHistoryStack } from '../hooks/useHistoryStack'
import type { PaneSide } from '../lib/dnd'
import {
  countLayers,
  ensureWebMapShape,
  getLayerAtPath,
  insertLayer,
  isGroupLayer,
  moveLayer,
  removeLayerAtPath,
  reorderSibling,
} from '../lib/webmap'
import type { LayerPath, OperationalLayer, PortalItem, WebMapData } from '../types/arcgis'
import { ItemPicker } from './ItemPicker'
import { JsonViewer } from './JsonViewer'
import { LayerEditor } from './LayerEditor'
import { LayerTree, type DropPosition, type TreeDropEvent } from './LayerTree'
import { MapPreview } from './MapPreview'

interface WebmapCompareProps {
  initialLeftId?: string
  initialRightId?: string
  onBack: () => void
}

interface PaneMeta {
  itemId: string
  item: PortalItem | null
  selected: LayerPath | null
  loading: boolean
  error: string | null
  baseline: string
}

const emptyMeta = (itemId = ''): PaneMeta => ({
  itemId,
  item: null,
  selected: null,
  loading: false,
  error: null,
  baseline: '',
})

function snapshot(data: WebMapData | null): string {
  return JSON.stringify(data?.operationalLayers ?? [])
}

export function WebmapCompare({ initialLeftId, initialRightId, onBack }: WebmapCompareProps) {
  const { getWebMap, saveWebMap, mode, resetDemo, auth, portalUrl } = useAuth()
  const {
    present: leftData,
    push: pushLeft,
    undo: undoLeft,
    redo: redoLeft,
    reset: resetLeft,
    canUndo: canUndoLeft,
    canRedo: canRedoLeft,
  } = useHistoryStack<WebMapData | null>(null)
  const {
    present: rightData,
    push: pushRight,
    undo: undoRight,
    redo: redoRight,
    reset: resetRight,
    canUndo: canUndoRight,
    canRedo: canRedoRight,
  } = useHistoryStack<WebMapData | null>(null)
  const [left, setLeft] = useState<PaneMeta>(() => emptyMeta(initialLeftId ?? ''))
  const [right, setRight] = useState<PaneMeta>(() => emptyMeta(initialRightId ?? ''))
  const [status, setStatus] = useState<string | null>(null)
  const [savingSide, setSavingSide] = useState<PaneSide | null>(null)
  const [previewSide, setPreviewSide] = useState<PaneSide | null>(null)
  const [activeEditor, setActiveEditor] = useState<PaneSide>('left')
  const [showJson, setShowJson] = useState(false)

  const leftDirty = left.baseline !== '' && snapshot(leftData) !== left.baseline
  const rightDirty = right.baseline !== '' && snapshot(rightData) !== right.baseline

  const loadPane = async (side: PaneSide, itemId: string) => {
    const setter = side === 'left' ? setLeft : setRight
    const reset = side === 'left' ? resetLeft : resetRight
    if (!itemId) {
      setter(emptyMeta())
      reset(null)
      return
    }
    setter({ ...emptyMeta(itemId), loading: true })
    try {
      const { item, data } = await getWebMap(itemId)
      const shaped = ensureWebMapShape(data)
      reset(shaped)
      setter({
        itemId,
        item,
        selected: null,
        loading: false,
        error: null,
        baseline: snapshot(shaped),
      })
    } catch (err) {
      reset(null)
      setter({
        ...emptyMeta(itemId),
        loading: false,
        error: err instanceof Error ? err.message : 'Laden mislukt',
      })
    }
  }

  useEffect(() => {
    if (initialLeftId) void loadPane('left', initialLeftId)
    if (initialRightId) void loadPane('right', initialRightId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLeftId, initialRightId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (activeEditor === 'left' ? canUndoLeft : canUndoRight) {
          ;(activeEditor === 'left' ? undoLeft : undoRight)()
          setStatus('Ongedaan gemaakt')
        }
      }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault()
        if (activeEditor === 'left' ? canRedoLeft : canRedoRight) {
          ;(activeEditor === 'left' ? redoLeft : redoRight)()
          setStatus('Opnieuw uitgevoerd')
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    activeEditor,
    canUndoLeft,
    canUndoRight,
    canRedoLeft,
    canRedoRight,
    undoLeft,
    undoRight,
    redoLeft,
    redoRight,
  ])

  const commitLayers = (
    side: PaneSide,
    nextLayers: OperationalLayer[],
    message: string,
    selected: LayerPath | null = null,
  ) => {
    const current = side === 'left' ? leftData : rightData
    const push = side === 'left' ? pushLeft : pushRight
    const setter = side === 'left' ? setLeft : setRight
    if (!current) return
    push({ ...current, operationalLayers: nextLayers })
    setter((prev) => ({ ...prev, selected }))
    setStatus(message)
  }

  const handleDrop = (side: PaneSide, event: TreeDropEvent) => {
    const data = side === 'left' ? leftData : rightData
    if (!data) return
    const layers = data.operationalLayers ?? []

    if (event.samePane) {
      commitLayers(
        side,
        moveLayer(layers, event.payloadPath, event.targetPath, event.position),
        'Laag verplaatst binnen deze webmap.',
      )
      return
    }

    let position: DropPosition | 'root' = event.position
    if (event.position === 'into' && event.targetPath) {
      const target = getLayerAtPath(layers, event.targetPath)
      if (!target || !isGroupLayer(target)) position = 'after'
    }

    commitLayers(
      side,
      insertLayer(
        layers,
        event.payloadLayer,
        position === 'root' ? null : event.targetPath,
        position,
      ),
      `Laag “${event.payloadLayer.title || event.payloadLayer.id}” gekopieerd vanuit de andere webmap.`,
    )
  }

  const updateSelectedLayer = (side: PaneSide, nextLayer: OperationalLayer) => {
    const meta = side === 'left' ? left : right
    const data = side === 'left' ? leftData : rightData
    if (!data || !meta.selected) return
    const layers = structuredClone(data.operationalLayers ?? [])
    const parentPath = meta.selected.slice(0, -1)
    const index = meta.selected[meta.selected.length - 1]
    if (index === undefined) return
    if (parentPath.length === 0) layers[index] = nextLayer
    else {
      const parent = getLayerAtPath(layers, parentPath)
      if (!parent?.layers) return
      parent.layers[index] = nextLayer
    }
    commitLayers(side, layers, 'Laageigenschappen bijgewerkt.', meta.selected)
  }

  const saveSide = async (side: PaneSide) => {
    const meta = side === 'left' ? left : right
    const data = side === 'left' ? leftData : rightData
    const setter = side === 'left' ? setLeft : setRight
    if (!data || !meta.itemId) return
    setSavingSide(side)
    try {
      const shaped = ensureWebMapShape(data)
      await saveWebMap(meta.itemId, shaped)
      setter((prev) => ({ ...prev, baseline: snapshot(shaped) }))
      setStatus(
        mode === 'demo'
          ? `${meta.item?.title ?? 'Webmap'} lokaal opgeslagen.`
          : `${meta.item?.title ?? 'Webmap'} opgeslagen in het portaal.`,
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Opslaan mislukt')
    } finally {
      setSavingSide(null)
    }
  }

  const renderPane = (
    side: PaneSide,
    meta: PaneMeta,
    data: WebMapData | null,
    dirty: boolean,
    canUndo: boolean,
    canRedo: boolean,
    onUndo: () => void,
    onRedo: () => void,
  ) => {
    const counts = data ? countLayers(data.operationalLayers) : null
    const selectedLayer =
      data && meta.selected ? getLayerAtPath(data.operationalLayers ?? [], meta.selected) : null

    return (
      <section
        className={`compare-pane ${activeEditor === side ? 'compare-pane--active' : ''}`}
        onMouseDown={() => setActiveEditor(side)}
      >
        <div className="compare-pane__toolbar">
          <ItemPicker
            label={side === 'left' ? 'Webmap links' : 'Webmap rechts'}
            value={meta.itemId}
            itemTypes={['Web Map', 'Web Scene']}
            placeholder="Zoek webmap of scene…"
            onChange={(id) => void loadPane(side, id)}
          />
          <div className="compare-pane__stats">
            {counts && (
              <span>
                {counts.layers} lagen · {counts.groups} groepen
              </span>
            )}
            {dirty && <span className="dirty-dot">Niet opgeslagen</span>}
          </div>
          <div className="compare-pane__history">
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              disabled={!canUndo}
              title="Ongedaan maken (Ctrl+Z)"
              onClick={() => {
                onUndo()
                setStatus('Ongedaan gemaakt')
              }}
            >
              <Undo2 size={15} />
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              disabled={!canRedo}
              title="Opnieuw (Ctrl+Y)"
              onClick={() => {
                onRedo()
                setStatus('Opnieuw uitgevoerd')
              }}
            >
              <Redo2 size={15} />
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={!data}
              onClick={() => setPreviewSide(side)}
            >
              <Eye size={14} />
              Preview
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={!dirty || savingSide === side}
              onClick={() => void saveSide(side)}
            >
              <Save size={14} />
              {savingSide === side ? 'Opslaan…' : 'Opslaan'}
            </button>
          </div>
        </div>

        {meta.loading && <p className="muted empty-panel">Webmap laden…</p>}
        {meta.error && <p className="form-error">{meta.error}</p>}

        {data && !meta.loading && (
          <>
            <div className="compare-pane__hint">
              <FolderInput size={14} />
              <span>
                Sleep lagen tussen groepen of naar de andere webmap. Ctrl+Z / Ctrl+Y voor undo/redo.
              </span>
            </div>
            <LayerTree
              layers={data.operationalLayers ?? []}
              selectedPath={meta.selected}
              side={side}
              onSelect={(path) => {
                setActiveEditor(side)
                ;(side === 'left' ? setLeft : setRight)((prev) => ({ ...prev, selected: path }))
              }}
              enableReorder
              onReorder={(path, direction) => {
                const next = reorderSibling(data.operationalLayers ?? [], path, direction)
                const index = path[path.length - 1]
                if (index === undefined) return
                commitLayers(
                  side,
                  next,
                  'Volgorde aangepast.',
                  [...path.slice(0, -1), index + direction],
                )
              }}
              onMove={(from, to, position) => {
                commitLayers(
                  side,
                  moveLayer(data.operationalLayers ?? [], from, to, position),
                  'Laag verplaatst.',
                )
              }}
              onDropLayer={(event) => handleDrop(side, event)}
              onDelete={(path) => {
                const source = getLayerAtPath(data.operationalLayers ?? [], path)
                const kind = source && isGroupLayer(source) ? 'Groep' : 'Laag'
                commitLayers(
                  side,
                  removeLayerAtPath(data.operationalLayers ?? [], path),
                  `${kind} “${source?.title || source?.id || 'item'}” verwijderd.`,
                )
              }}
            />
            {showJson && selectedLayer && (
              <JsonViewer value={selectedLayer} label="Geselecteerde laag" />
            )}
          </>
        )}
      </section>
    )
  }

  const editorMeta = activeEditor === 'left' ? left : right
  const editorData = activeEditor === 'left' ? leftData : rightData
  const editorLayer =
    editorData && editorMeta.selected
      ? getLayerAtPath(editorData.operationalLayers ?? [], editorMeta.selected)
      : null

  const previewMeta = previewSide === 'left' ? left : right
  const previewData = previewSide === 'left' ? leftData : rightData
  const previewDirty = previewSide === 'left' ? leftDirty : rightDirty

  return (
    <div className="compare">
      <header className="compare__header">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          <ArrowLeft size={16} />
          Terug
        </button>
        <div>
          <h2>Webmaps vergelijken</h2>
          <p className="muted">
            Sleep lagen tussen kaarten, bewerk popups/queries, preview en undo altijd bij de hand.
          </p>
        </div>
        <div className="compare__actions">
          {mode === 'demo' && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                resetDemo()
                if (left.itemId) void loadPane('left', left.itemId)
                if (right.itemId) void loadPane('right', right.itemId)
                setStatus('Demodata gereset.')
              }}
            >
              <RotateCcw size={15} />
              Reset demo
            </button>
          )}
          <button type="button" className="btn btn--secondary" onClick={() => setShowJson((v) => !v)}>
            {showJson ? 'Verberg JSON' : 'Toon JSON'}
          </button>
        </div>
      </header>

      {status && <p className="form-ok compare__status">{status}</p>}

      <div className="compare__workspace">
        <div className="compare__grid">
          {renderPane(
            'left',
            left,
            leftData,
            leftDirty,
            canUndoLeft,
            canRedoLeft,
            undoLeft,
            redoLeft,
          )}
          {renderPane(
            'right',
            right,
            rightData,
            rightDirty,
            canUndoRight,
            canRedoRight,
            undoRight,
            redoRight,
          )}
        </div>
        <aside className="compare__inspector">
          <div className="compare__inspector-head">
            <h3>Laageigenschappen</h3>
            <p className="muted">
              Actieve kant: {activeEditor === 'left' ? 'links' : 'rechts'}
              {editorMeta.item ? ` · ${editorMeta.item.title}` : ''}
            </p>
          </div>
          <LayerEditor
            layer={editorLayer}
            onChange={(next) => updateSelectedLayer(activeEditor, next)}
          />
        </aside>
      </div>

      <MapPreview
        open={Boolean(previewSide)}
        title={previewMeta.item?.title || 'Webmap preview'}
        itemId={previewMeta.itemId || undefined}
        portalHomeUrl={portalUrl}
        webMapData={previewData}
        dirty={previewDirty}
        token={auth?.token}
        onClose={() => setPreviewSide(null)}
      />
    </div>
  )
}
