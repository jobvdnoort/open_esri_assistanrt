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
} from '../lib/webmap'
import { JsonViewer } from './JsonViewer'
import { LayerTree } from './LayerTree'

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
                Selecteer een laag/groep en kopieer. Selecteer op de andere kant een groep om erín te
                plakken; anders komt het op root-niveau.
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
            Kopieer groepen en lagen zonder JSON te bewerken. IDs worden automatisch vernieuwd.
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
