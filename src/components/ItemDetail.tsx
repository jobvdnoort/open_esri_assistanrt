import { ArrowLeft, ArrowRightLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import type { LayerPath, PortalItem, WebMapData } from '../types/arcgis'
import { countLayers, getLayerAtPath } from '../lib/webmap'
import { JsonViewer } from './JsonViewer'
import { LayerTree } from './LayerTree'

interface ItemDetailProps {
  itemId: string
  onBack: () => void
  onCompare: (id: string) => void
}

type Tab = 'meta' | 'data' | 'layers'

export function ItemDetail({ itemId, onBack, onCompare }: ItemDetailProps) {
  const { getItem, getItemData, getWebMap } = useAuth()
  const [item, setItem] = useState<PortalItem | null>(null)
  const [data, setData] = useState<unknown>(null)
  const [webMap, setWebMap] = useState<WebMapData | null>(null)
  const [tab, setTab] = useState<Tab>('meta')
  const [selectedPath, setSelectedPath] = useState<LayerPath | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const meta = await getItem(itemId)
        if (cancelled) return
        setItem(meta)
        if (meta.type === 'Web Map') {
          const wm = await getWebMap(itemId)
          if (cancelled) return
          setWebMap(wm.data)
          setData(wm.data)
          setTab('layers')
        } else {
          const raw = await getItemData(itemId)
          if (cancelled) return
          setData(raw)
          setWebMap(null)
          setTab('data')
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Laden mislukt')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [itemId, getItem, getItemData, getWebMap])

  const selectedLayer =
    webMap && selectedPath
      ? getLayerAtPath(webMap.operationalLayers ?? [], selectedPath)
      : null

  const counts = webMap ? countLayers(webMap.operationalLayers) : null

  if (loading) {
    return <div className="panel-card"><p className="muted">Item laden…</p></div>
  }

  if (!item) {
    return (
      <div className="panel-card">
        <p className="form-error">{error || 'Item niet gevonden'}</p>
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          Terug
        </button>
      </div>
    )
  }

  return (
    <div className="detail">
      <header className="detail__header">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          <ArrowLeft size={16} />
          Terug
        </button>
        <div className="detail__titles">
          <h2>{item.title}</h2>
          <p className="muted">
            {item.type} · {item.owner} · {item.id}
          </p>
        </div>
        <div className="detail__actions">
          {item.type === 'Web Map' && (
            <button type="button" className="btn btn--secondary" onClick={() => onCompare(item.id)}>
              <ArrowRightLeft size={16} />
              Vergelijk
            </button>
          )}
        </div>
      </header>

      {error && <p className="form-error">{error}</p>}

      <div className="tabs">
        <button
          type="button"
          className={`tabs__btn ${tab === 'meta' ? 'is-active' : ''}`}
          onClick={() => setTab('meta')}
        >
          Metadata
        </button>
        <button
          type="button"
          className={`tabs__btn ${tab === 'data' ? 'is-active' : ''}`}
          onClick={() => setTab('data')}
        >
          Item JSON
        </button>
        {webMap && (
          <button
            type="button"
            className={`tabs__btn ${tab === 'layers' ? 'is-active' : ''}`}
            onClick={() => setTab('layers')}
          >
            Lagen ({counts?.layers ?? 0} / {counts?.groups ?? 0} groepen)
          </button>
        )}
      </div>

      {tab === 'meta' && <JsonViewer value={item} label="Item metadata" />}

      {tab === 'data' && (
        <JsonViewer
          value={webMap ?? data}
          label={webMap ? 'Webmap data JSON' : 'Item data JSON'}
        />
      )}

      {tab === 'layers' && webMap && (
        <div className="detail__layers">
          <div className="panel-card">
            <div className="panel-card__head">
              <h3>Operationele lagen</h3>
              <p className="muted">Selecteer een laag of groep om de JSON te bekijken.</p>
            </div>
            <LayerTree
              layers={webMap.operationalLayers ?? []}
              selectedPath={selectedPath}
              onSelect={setSelectedPath}
            />
          </div>
          <div className="panel-card">
            <div className="panel-card__head">
              <h3>{selectedLayer ? selectedLayer.title || selectedLayer.id : 'Selectie'}</h3>
              <p className="muted">
                {selectedLayer
                  ? selectedLayer.layerType || 'Laag'
                  : 'Klik op een laag of groep links.'}
              </p>
            </div>
            {selectedLayer ? (
              <JsonViewer value={selectedLayer} label="Geselecteerde laag / groep" />
            ) : (
              <p className="muted empty-panel">Nog niets geselecteerd.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
