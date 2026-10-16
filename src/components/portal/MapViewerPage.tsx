import {
  BookMarked,
  ChevronLeft,
  ChevronRight,
  FormInput,
  Home,
  Layers,
  List,
  Map as MapIcon,
  Maximize2,
  Minus,
  Plus,
  Printer,
  Search,
  Settings,
  Share2,
  Table2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { PortalItem } from '../../types/arcgis'

interface MapViewerPageProps {
  itemId?: string
  onOpenItem?: (id: string) => void
}

export function MapViewerPage({ itemId, onOpenItem }: MapViewerPageProps) {
  const { getItem, getWebMap, searchItems } = useAuth()
  const [item, setItem] = useState<PortalItem | null>(null)
  const [layerTitles, setLayerTitles] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const mapRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<{ destroy?: () => void } | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        let id = itemId
        if (!id) {
          const found = await searchItems('', 'Web Map')
          id = found.results[0]?.id
        }
        if (!id) {
          if (!cancelled) {
            setItem(null)
            setLayerTitles([])
          }
          return
        }
        const meta = await getItem(id)
        if (cancelled) return
        setItem(meta)
        if (meta.type === 'Web Map') {
          const wm = await getWebMap(id)
          if (cancelled) return
          const titles: string[] = []
          const walk = (layers: { title?: string; layers?: unknown[] }[] = []) => {
            for (const layer of layers) {
              if (layer.title) titles.push(layer.title)
              if (Array.isArray(layer.layers)) walk(layer.layers as typeof layers)
            }
          }
          walk(wm.data.operationalLayers as { title?: string; layers?: unknown[] }[])
          setLayerTitles(titles)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Map laden mislukt')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [itemId, getItem, getWebMap, searchItems])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!item || item.type !== 'Web Map' || !mapRef.current) return
      try {
        const { loadModules, setDefaultOptions } = await import('esri-loader')
        setDefaultOptions({ version: '4.30', css: true })
        const [WebMap, MapView] = await loadModules([
          'esri/WebMap',
          'esri/views/MapView',
        ])
        if (cancelled || !mapRef.current) return
        viewRef.current?.destroy?.()
        const webmap = new WebMap({ portalItem: { id: item.id } })
        const view = new MapView({
          container: mapRef.current,
          map: webmap,
        })
        viewRef.current = view
      } catch {
        // Demo / offline: keep empty map chrome
      }
    })()
    return () => {
      cancelled = true
      viewRef.current?.destroy?.()
      viewRef.current = null
    }
  }, [item])

  return (
    <div className="ep-mapviewer">
      <header className="ep-mapviewer__top">
        <strong>{item?.title || 'Untitled map'}</strong>
        {item && onOpenItem && (
          <button type="button" className="ep-linkish" onClick={() => onOpenItem(item.id)}>
            Item details
          </button>
        )}
      </header>

      <div className="ep-mapviewer__body">
        <aside className="ep-map-rail ep-map-rail--dark">
          <button type="button" className="is-active" title="Layers">
            <Layers size={18} />
          </button>
          <button type="button" title="Tables" disabled>
            <Table2 size={18} />
          </button>
          <button type="button" title="Basemap" disabled>
            <MapIcon size={18} />
          </button>
          <button type="button" title="Legend" disabled>
            <List size={18} />
          </button>
          <button type="button" title="Bookmarks" disabled>
            <BookMarked size={18} />
          </button>
          <button type="button" title="Forms" disabled>
            <FormInput size={18} />
          </button>
          <button type="button" title="Settings" disabled>
            <Settings size={18} />
          </button>
          <button type="button" title="Share" disabled>
            <Share2 size={18} />
          </button>
          <button type="button" title="Print" disabled>
            <Printer size={18} />
          </button>
          <div className="ep-map-rail__spacer" />
          <button
            type="button"
            title={panelOpen ? 'Collapse' : 'Expand'}
            onClick={() => setPanelOpen((v) => !v)}
          >
            {panelOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </aside>

        {panelOpen && (
          <aside className="ep-map-panel">
            <header>
              <h2>Layers</h2>
              <button type="button" className="ep-icon-btn" onClick={() => setPanelOpen(false)}>
                ×
              </button>
            </header>
            {layerTitles.length === 0 ? (
              <div className="ep-map-panel__empty">
                <Layers size={40} strokeWidth={1} />
                <p>Add layers to your map and they will appear here.</p>
                <button type="button" className="ep-btn ep-btn--primary" disabled>
                  Add
                  <ChevronDownIcon />
                </button>
              </div>
            ) : (
              <ul className="ep-map-layers">
                {layerTitles.map((title) => (
                  <li key={title}>{title}</li>
                ))}
              </ul>
            )}
          </aside>
        )}

        <div className="ep-map-stage">
          {error && <p className="form-error">{error}</p>}
          <div ref={mapRef} className="ep-map-canvas" />
          {!item && !error && (
            <div className="ep-map-placeholder">
              <p>Open a Web Map from Content to view it here.</p>
            </div>
          )}
          <div className="ep-map-tools">
            <button type="button" title="Search" disabled>
              <Search size={16} />
            </button>
            <button type="button" title="Home" disabled>
              <Home size={16} />
            </button>
            <button type="button" title="Zoom in" disabled>
              <Plus size={16} />
            </button>
            <button type="button" title="Zoom out" disabled>
              <Minus size={16} />
            </button>
            <button type="button" title="Fullscreen" disabled>
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}
