import {
  ArrowLeft,
  ArrowLeftRight,
  FolderInput,
  RotateCcw,
  Save,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import type { LayerPath, PortalItem, WebMapData } from '../types/arcgis'
import {
  countLayers,
  ensureWebMapShape,
  getLayerAtPath,
  insertLayer,
  moveLayer,
  reorderSibling,
} from '../lib/webmap'
import { JsonViewer } from './JsonViewer'
import { LayerTree, type DropPosition } from './LayerTree'

interface WebmapCompareProps {
  initialLeftId?: string
  initialRightId?: string
  onBack: () => void
}

interface PaneState {
  itemId: string
  item: PortalItem | null
  data: WebMapData | null
  selected: LayerPath | null
  dirty: boolean
  loading: boolean
  error: string | null
}

const emptyPane = (itemId = ''): PaneState => ({
  itemId,
  item: null,
  data: null,
  selected: null,
  dirty: false,
  loading: false,
  error: null,
})

export function WebmapCompare({ initialLeftId, initialRightId, onBack }: WebmapCompareProps) {
  const { searchItems, getWebMap, saveWebMap, mode, resetDemo } = useAuth()
  const [webMaps, setWebMaps] = useState<PortalItem[]>([])
  const [left, setLeft] = useState<PaneState>(() => emptyPane(initialLeftId ?? ''))
  const [right, setRight] = useState<PaneState>(() => emptyPane(initialRightId ?? ''))
  const [status, setStatus] = useState<string | null>(null)
  const [savingSide, setSavingSide] = useState<'left' | 'right' | null>(null)
  const [preview, setPreview] = useState<'left' | 'right' | null>(null)

  useEffect(() => {
    void searchItems('', 'Web Map').then((r) => setWebMaps(r.results))
  }, [searchItems])

  const loadPane = async (
    side: 'left' | 'right',
    itemId: string,
  ) => {
    const setter = side === 'left' ? setLeft : setRight
    if (!itemId) {
      setter(emptyPane())
      return
    }
    setter((prev) => ({ ...emptyPane(itemId), loading: true, dirty: prev.dirty && prev.itemId === itemId }))
    try {
      const { item, data } = await getWebMap(itemId)
      setter({
        itemId,
        item,
        data: ensureWebMapShape(data),
        selected: null,
        dirty: false,
        loading: false,
        error: null,
      })
    } catch (err) {
      setter({
        ...emptyPane(itemId),
        loading: false,
        error: err instanceof Error ? err.message : 'Laden mislukt',
      })
    }
  }

  useEffect(() => {
    if (initialLeftId) void loadPane('left', initialLeftId)
    if (initialRightId) void loadPane('right', initialRightId)
    // only on mount / initial ids
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLeftId, initialRightId])

  const copyFromTo = (
    from: PaneState,
    to: PaneState,
    setTo: typeof setRight,
    directionLabel: string,
    sourcePath?: LayerPath | null,
  ) => {
    const path = sourcePath ?? from.selected
    if (!from.data || !to.data || !path) {
      setStatus('Selecteer eerst een laag of groep om te kopiëren.')
      return
    }
    const layer = getLayerAtPath(from.data.operationalLayers ?? [], path)
    if (!layer) {
      setStatus('Geselecteerde laag niet gevonden.')
      return
    }

    const targetPath = to.selected
    const targetLayer = targetPath
      ? getLayerAtPath(to.data.operationalLayers ?? [], targetPath)
      : null
    const position =
      targetLayer?.layerType === 'GroupLayer' || Array.isArray(targetLayer?.layers)
        ? 'into'
        : 'root'

    const nextLayers = insertLayer(
      to.data.operationalLayers ?? [],
      layer,
      position === 'into' ? targetPath : null,
      position,
    )

    setTo((prev) => ({
      ...prev,
      data: { ...prev.data!, operationalLayers: nextLayers },
      dirty: true,
    }))

    const name = layer.title || layer.id || 'item'
    const kind = layer.layerType === 'GroupLayer' ? 'groep' : 'laag'
    const into =
      position === 'into' && targetLayer
        ? ` in “${targetLayer.title || targetLayer.id}”`
        : ' naar de root'
    setStatus(`${kind[0].toUpperCase()}${kind.slice(1)} “${name}” gekopieerd ${directionLabel}${into}. Vergeet niet op te slaan.`)
  }

  const moveWithin = (
    side: 'left' | 'right',
    from: LayerPath,
    to: LayerPath | null,
    position: DropPosition | 'root',
  ) => {
    const setter = side === 'left' ? setLeft : setRight
    setter((prev) => {
      if (!prev.data) return prev
      const layers = prev.data.operationalLayers ?? []
      const source = getLayerAtPath(layers, from)
      const targetTitle =
        to && position === 'into' ? getLayerAtPath(layers, to)?.title || 'groep' : null
      const nextLayers = moveLayer(layers, from, to, position)
      const name = source?.title || source?.id || 'item'
      const dest =
        position === 'root'
          ? 'naar root'
          : position === 'into'
            ? `in “${targetTitle}”`
            : position === 'before'
              ? 'vóór doel'
              : 'ná doel'
      queueMicrotask(() =>
        setStatus(`“${name}” verplaatst ${dest} in deze webmap. Vergeet niet op te slaan.`),
      )
      return {
        ...prev,
        data: { ...prev.data, operationalLayers: nextLayers },
        selected: null,
        dirty: true,
      }
    })
  }

  const reorderWithin = (side: 'left' | 'right', path: LayerPath, direction: -1 | 1) => {
    const setter = side === 'left' ? setLeft : setRight
    const index = path[path.length - 1]
    if (index === undefined) return
    setter((prev) => {
      if (!prev.data) return prev
      const nextLayers = reorderSibling(prev.data.operationalLayers ?? [], path, direction)
      return {
        ...prev,
        data: { ...prev.data, operationalLayers: nextLayers },
        selected: [...path.slice(0, -1), index + direction],
        dirty: true,
      }
    })
  }

  const saveSide = async (side: 'left' | 'right') => {
    const pane = side === 'left' ? left : right
    const setter = side === 'left' ? setLeft : setRight
    if (!pane.data || !pane.itemId) return
    setSavingSide(side)
    setStatus(null)
    try {
      await saveWebMap(pane.itemId, ensureWebMapShape(pane.data))
      setter((prev) => ({ ...prev, dirty: false }))
      setStatus(
        mode === 'demo'
          ? `${pane.item?.title ?? 'Webmap'} lokaal opgeslagen.`
          : `${pane.item?.title ?? 'Webmap'} opgeslagen in het portaal.`,
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Opslaan mislukt')
    } finally {
      setSavingSide(null)
    }
  }

  const renderPane = (
    side: 'left' | 'right',
    pane: PaneState,
    setPane: typeof setLeft,
    copyLabel: string,
    onCopy: (path: LayerPath) => void,
  ) => {
    const counts = pane.data ? countLayers(pane.data.operationalLayers) : null
    return (
      <section className="compare-pane">
        <div className="compare-pane__toolbar">
          <label>
            Webmap
            <select
              value={pane.itemId}
              onChange={(e) => void loadPane(side, e.target.value)}
            >
              <option value="">Kies een webmap…</option>
              {webMaps.map((wm) => (
                <option key={wm.id} value={wm.id}>
                  {wm.title}
                </option>
              ))}
            </select>
          </label>
          <div className="compare-pane__stats">
            {counts && (
              <span>
                {counts.layers} lagen · {counts.groups} groepen
              </span>
            )}
            {pane.dirty && <span className="dirty-dot">Niet opgeslagen</span>}
          </div>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={!pane.dirty || savingSide === side}
            onClick={() => void saveSide(side)}
          >
            <Save size={14} />
            {savingSide === side ? 'Opslaan…' : 'Opslaan'}
          </button>
        </div>

        {pane.loading && <p className="muted empty-panel">Webmap laden…</p>}
        {pane.error && <p className="form-error">{pane.error}</p>}

        {pane.data && !pane.loading && (
          <>
            <div className="compare-pane__hint">
              <FolderInput size={14} />
              <span>
                Binnen deze webmap: sleep lagen/groepen, of ↑↓ / verplaats-icoon. Tussen webmaps:
                knop {copyLabel}. Selecteer op de andere kant een groep om erín te plakken.
              </span>
            </div>
            <LayerTree
              layers={pane.data.operationalLayers ?? []}
              selectedPath={pane.selected}
              onSelect={(path) => setPane((prev) => ({ ...prev, selected: path }))}
              onCopy={(path) => {
                setPane((prev) => ({ ...prev, selected: path }))
                onCopy(path)
              }}
              copyLabel={copyLabel}
              enableReorder
              onReorder={(path, direction) => reorderWithin(side, path, direction)}
              onMove={(from, to, position) => moveWithin(side, from, to, position)}
            />
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setPreview(preview === side ? null : side)}
            >
              {preview === side ? 'Verberg JSON' : 'Toon geselecteerde JSON'}
            </button>
            {preview === side && pane.selected && (
              <JsonViewer
                value={getLayerAtPath(pane.data.operationalLayers ?? [], pane.selected)}
                label="Selectie"
              />
            )}
          </>
        )}
      </section>
    )
  }

  return (
    <div className="compare">
      <header className="compare__header">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          <ArrowLeft size={16} />
          Terug
        </button>
        <div>
          <h2>Webmaps naast elkaar</h2>
          <p className="muted">
            Verplaats lagen binnen een webmap, of kopieer tussen webmaps — zonder JSON te bewerken.
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
          <button
            type="button"
            className="btn btn--secondary"
            disabled={!left.selected || !right.data}
            onClick={() => copyFromTo(left, right, setRight, 'naar rechts')}
          >
            <ArrowLeftRight size={16} />
            Links → rechts
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            disabled={!right.selected || !left.data}
            onClick={() => copyFromTo(right, left, setLeft, 'naar links')}
          >
            Rechts → links
          </button>
        </div>
      </header>

      {status && <p className="form-ok compare__status">{status}</p>}

      <div className="compare__grid">
        {renderPane('left', left, setLeft, '→', (path) =>
          copyFromTo(left, right, setRight, 'naar rechts', path),
        )}
        {renderPane('right', right, setRight, '←', (path) =>
          copyFromTo(right, left, setLeft, 'naar links', path),
        )}
      </div>
    </div>
  )
}
