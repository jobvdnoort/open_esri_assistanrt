import {
  BarChart3,
  Bell,
  BookMarked,
  ChevronLeft,
  ChevronRight,
  Code2,
  Eye,
  EyeOff,
  FolderOpen,
  Grid3x3,
  Home,
  Layers,
  List,
  Map as MapIcon,
  Maximize2,
  Minus,
  MoreHorizontal,
  Plus,
  Printer,
  Search,
  Settings,
  Share2,
  Table2,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  LAYER_SEARCH_TYPES,
  addLayerToView,
  createLayerFromFile,
  createLayerFromPortalItem,
  createLayerFromUrl,
  type AddedLayerInfo,
  type LayerKind,
} from '../../lib/mapLayers'
import type { PortalItem } from '../../types/arcgis'
import { initials, itemTypeLabel, typeIconClass } from './format'

type LeftPanel =
  | 'layers'
  | 'tables'
  | 'basemap'
  | 'legend'
  | 'bookmarks'
  | 'charts'
  | 'properties'
  | 'browse'
  | null

type AddModal = 'url' | 'file' | null

interface MapViewerPageProps {
  itemId?: string
  onLeave?: () => void
}

type ViewHandle = {
  destroy?: () => void
  goTo?: (t: unknown) => Promise<unknown>
  zoom?: number
  map: {
    add: (layer: unknown) => void
    remove: (layer: unknown) => void
    findLayerById?: (id: string) => { visible?: boolean; destroy?: () => void } | null
  }
}

/**
 * Untitled Map Viewer with working Add: Browse layers / URL / file.
 */
export function MapViewerPage({ onLeave }: MapViewerPageProps) {
  const { portal, mode, portalUrl, auth, browseContent } = useAuth()
  const [panel, setPanel] = useState<LeftPanel>('layers')
  const [addOpen, setAddOpen] = useState(false)
  const [addModal, setAddModal] = useState<AddModal>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [added, setAdded] = useState<AddedLayerInfo[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  // Browse layers state
  const [browseQuery, setBrowseQuery] = useState('')
  const [browseScope, setBrowseScope] = useState<'mine' | 'org'>('mine')
  const [browseType, setBrowseType] = useState('')
  const [browseResults, setBrowseResults] = useState<PortalItem[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [browseError, setBrowseError] = useState<string | null>(null)

  // URL modal
  const [urlValue, setUrlValue] = useState('https://')
  const [urlKind, setUrlKind] = useState<LayerKind>('auto')
  const [urlError, setUrlError] = useState<string | null>(null)

  // File modal
  const [fileError, setFileError] = useState<string | null>(null)

  const mapDivRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<ViewHandle | null>(null)
  const layerObjs = useRef<Map<string, unknown>>(new Map())

  const displayName = portal?.user?.fullName || portal?.user?.username || 'Gebruiker'
  const username = portal?.user?.username || ''

  const togglePanel = (id: LeftPanel) => {
    setPanel((prev) => (prev === id ? null : id))
    setAddOpen(false)
  }

  useEffect(() => {
    let cancelled = false
    const container = mapDivRef.current
    if (!container) return

    ;(async () => {
      setMapError(null)
      setMapReady(false)
      try {
        const { loadModules, setDefaultOptions } = await import('esri-loader')
        setDefaultOptions({ version: '4.31', css: true })
        const [esriConfig, IdentityManager, Map, MapView, Basemap] = await loadModules([
          'esri/config',
          'esri/identity/IdentityManager',
          'esri/Map',
          'esri/views/MapView',
          'esri/Basemap',
        ])

        if (cancelled || !mapDivRef.current) return

        const portalHome = portalUrl?.replace(/\/sharing\/rest\/?$/i, '') || ''
        if (portalHome && mode === 'live') {
          esriConfig.portalUrl = portalHome
        }
        if (mode === 'live' && auth && portalHome) {
          try {
            const token =
              typeof auth.token === 'string' && auth.token
                ? auth.token
                : await auth.getToken(portalUrl)
            if (token) {
              IdentityManager.registerToken({ server: portalHome, token })
            }
          } catch {
            /* public basemap still ok */
          }
        }

        viewRef.current?.destroy?.()
        let basemap: unknown = 'topo-vector'
        try {
          basemap = Basemap.fromId('topo-vector')
        } catch {
          basemap = 'streets-vector'
        }

        const map = new Map({ basemap })
        const view = new MapView({
          container: mapDivRef.current,
          map,
          center: [5.3, 52.1],
          zoom: 7,
          ui: { components: [] },
        })
        viewRef.current = view
        await view.when()
        if (!cancelled) setMapReady(true)
      } catch (err) {
        if (!cancelled) {
          setMapError(err instanceof Error ? err.message : 'Kaart kon niet geladen worden')
          setMapReady(false)
        }
      }
    })()

    return () => {
      cancelled = true
      viewRef.current?.destroy?.()
      viewRef.current = null
      layerObjs.current.clear()
    }
  }, [portalUrl, mode, auth])

  const runAdd = useCallback(
    async (factory: () => Promise<{ layer: unknown; info: AddedLayerInfo }>) => {
      const view = viewRef.current
      if (!view?.map) {
        setStatus('Kaart is nog niet klaar.')
        return
      }
      setBusy(true)
      setStatus(null)
      try {
        const { layer, info } = await factory()
        await addLayerToView(view as never, layer as never, true)
        layerObjs.current.set(info.id, layer)
        setAdded((prev) => [info, ...prev.filter((p) => p.id !== info.id)])
        setPanel('layers')
        setAddModal(null)
        setAddOpen(false)
        setStatus(`Toegevoegd: ${info.title}`)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Laag toevoegen mislukt'
        setStatus(message)
        throw err
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const addFromPortalItem = async (item: PortalItem) => {
    try {
      await runAdd(() =>
        createLayerFromPortalItem(item.id, {
          title: item.title,
          url: item.url,
          type: item.type,
        }),
      )
    } catch {
      /* status already set */
    }
  }

  const openBrowse = () => {
    setAddOpen(false)
    setPanel('browse')
    setBrowseError(null)
  }

  const openUrl = () => {
    setAddOpen(false)
    setAddModal('url')
    setUrlError(null)
    setUrlValue('https://')
    setUrlKind('auto')
  }

  const openFile = () => {
    setAddOpen(false)
    setAddModal('file')
    setFileError(null)
  }

  useEffect(() => {
    if (panel !== 'browse') return
    let cancelled = false
    setBrowseLoading(true)
    setBrowseError(null)
    void browseContent({
      scope: browseScope,
      query: browseQuery || undefined,
      type: browseType || undefined,
      num: 40,
      start: 1,
    })
      .then((r) => {
        if (cancelled) return
        const layerish = (r.results ?? []).filter((item) => {
          const t = (item.type || '').toLowerCase()
          return (
            t.includes('feature') ||
            t.includes('map service') ||
            t.includes('scene') ||
            t.includes('image') ||
            t.includes('tile') ||
            t.includes('layer') ||
            Boolean(item.url)
          )
        })
        setBrowseResults(browseType ? (r.results ?? []) : layerish.length ? layerish : r.results ?? [])
      })
      .catch((err) => {
        if (!cancelled) {
          setBrowseError(err instanceof Error ? err.message : 'Zoeken mislukt')
          setBrowseResults([])
        }
      })
      .finally(() => {
        if (!cancelled) setBrowseLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [panel, browseScope, browseQuery, browseType, browseContent])

  const submitUrl = async () => {
    setUrlError(null)
    const url = urlValue.trim()
    if (!/^https?:\/\//i.test(url) || url === 'https://') {
      setUrlError('Vul een geldige http(s) URL in.')
      return
    }
    try {
      await runAdd(() => createLayerFromUrl(url, { kind: urlKind }))
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : 'Toevoegen mislukt')
    }
  }

  const submitFile = async (file: File | null) => {
    setFileError(null)
    if (!file) {
      setFileError('Kies een bestand.')
      return
    }
    try {
      await runAdd(() => createLayerFromFile(file))
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Bestand laden mislukt')
    }
  }

  const removeLayer = (id: string) => {
    const view = viewRef.current
    const layer = layerObjs.current.get(id)
    if (view?.map && layer) {
      try {
        view.map.remove(layer)
      } catch {
        /* ignore */
      }
    }
    layerObjs.current.delete(id)
    setAdded((prev) => prev.filter((l) => l.id !== id))
  }

  const toggleVisibility = (id: string) => {
    const layer = layerObjs.current.get(id) as { visible?: boolean } | undefined
    if (!layer) return
    layer.visible = !layer.visible
    setAdded((prev) => [...prev])
  }

  const zoom = async (delta: number) => {
    const view = viewRef.current
    if (!view?.goTo || view.zoom == null) return
    try {
      await view.goTo({ zoom: view.zoom + delta })
    } catch {
      /* ignore */
    }
  }

  const goHome = async () => {
    const view = viewRef.current
    if (!view?.goTo) return
    try {
      await view.goTo({ center: [5.3, 52.1], zoom: 7 })
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mv">
      <header className="mv-top">
        <div className="mv-top__left">
          {onLeave && (
            <button type="button" className="mv-icon-btn" onClick={onLeave} title="Back to Content">
              <List size={18} />
            </button>
          )}
          <strong>Untitled map</strong>
          {status && <span className="mv-status">{status}</span>}
        </div>
        <div className="mv-top__right">
          <button type="button" className="mv-icon-btn" disabled aria-label="Notifications">
            <Bell size={18} />
          </button>
          <button type="button" className="mv-icon-btn" disabled aria-label="Apps">
            <Grid3x3 size={18} />
          </button>
          <div className="mv-user">
            <span className="ep-avatar ep-avatar--sm">{initials(displayName)}</span>
            <div className="ep-user__text">
              <strong>
                {displayName}
                {mode === 'demo' ? ' (Demo)' : ''}
              </strong>
              {username && <span>{username}</span>}
            </div>
          </div>
        </div>
      </header>

      <div className="mv-body">
        <aside className="mv-rail mv-rail--dark">
          <div className="mv-rail__add-wrap">
            <button
              type="button"
              className={addOpen || addModal || panel === 'browse' ? 'is-active' : ''}
              title="Add"
              onClick={() => {
                setAddOpen((v) => !v)
                setPanel('layers')
              }}
            >
              <Plus size={18} />
            </button>
            {addOpen && (
              <div className="mv-flyout">
                <button type="button" onClick={openBrowse}>
                  <Search size={14} /> Browse layers
                </button>
                <button type="button" onClick={openUrl}>
                  <MapIcon size={14} /> Add layer from URL
                </button>
                <button type="button" onClick={openFile}>
                  <FolderOpen size={14} /> Add layer from file
                </button>
                <button type="button" disabled>
                  Create sketch layer
                </button>
                <button type="button" disabled>
                  Add media layer
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className={panel === 'layers' ? 'is-active' : ''}
            title="Layers"
            onClick={() => togglePanel('layers')}
          >
            <Layers size={18} />
          </button>
          <button
            type="button"
            className={panel === 'tables' ? 'is-active' : ''}
            title="Tables"
            onClick={() => togglePanel('tables')}
          >
            <Table2 size={18} />
          </button>
          <button
            type="button"
            className={panel === 'basemap' ? 'is-active' : ''}
            title="Basemap"
            onClick={() => togglePanel('basemap')}
          >
            <MapIcon size={18} />
          </button>
          <button
            type="button"
            className={panel === 'legend' ? 'is-active' : ''}
            title="Legend"
            onClick={() => togglePanel('legend')}
          >
            <List size={18} />
          </button>
          <button
            type="button"
            className={panel === 'bookmarks' ? 'is-active' : ''}
            title="Bookmarks"
            onClick={() => togglePanel('bookmarks')}
          >
            <BookMarked size={18} />
          </button>
          <button
            type="button"
            className={panel === 'charts' ? 'is-active' : ''}
            title="Charts"
            onClick={() => togglePanel('charts')}
          >
            <BarChart3 size={18} />
          </button>
          <button
            type="button"
            className={panel === 'properties' ? 'is-active' : ''}
            title="Map properties"
            onClick={() => togglePanel('properties')}
          >
            <Settings size={18} />
          </button>
          <button type="button" title="Share" disabled>
            <Share2 size={18} />
          </button>
          <button type="button" title="Embed" disabled>
            <Code2 size={18} />
          </button>
          <button type="button" title="Print" disabled>
            <Printer size={18} />
          </button>
          <div className="mv-rail__spacer" />
          <button
            type="button"
            title={panel ? 'Collapse' : 'Expand'}
            onClick={() => setPanel((p) => (p ? null : 'layers'))}
          >
            {panel ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </aside>

        {panel && (
          <aside className={`mv-panel ${panel === 'browse' ? 'mv-panel--wide' : ''}`}>
            <header>
              <h2>
                {panel === 'layers' && 'Layers'}
                {panel === 'browse' && 'Browse layers'}
                {panel === 'tables' && 'Tables'}
                {panel === 'basemap' && 'Basemap'}
                {panel === 'legend' && 'Legend'}
                {panel === 'bookmarks' && 'Bookmarks'}
                {panel === 'charts' && 'Charts'}
                {panel === 'properties' && 'Map properties'}
              </h2>
              <button type="button" className="mv-icon-btn" onClick={() => setPanel(null)}>
                <X size={16} />
              </button>
            </header>

            {panel === 'layers' && (
              <>
                {added.length === 0 ? (
                  <div className="mv-panel__empty">
                    <Layers size={48} strokeWidth={1} />
                    <p>Add layers to your map and they will appear here.</p>
                    <div className="mv-add-split">
                      <button
                        type="button"
                        className="ep-btn ep-btn--outline"
                        onClick={() => setAddOpen(true)}
                      >
                        <Layers size={14} />
                        Add
                      </button>
                      <button
                        type="button"
                        className="ep-btn ep-btn--outline"
                        onClick={openBrowse}
                      >
                        Browse
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mv-panel__body">
                    <div className="mv-add-split" style={{ marginBottom: '0.75rem' }}>
                      <button type="button" className="ep-btn ep-btn--outline" onClick={() => setAddOpen(true)}>
                        Add
                      </button>
                      <button type="button" className="ep-btn ep-btn--outline" onClick={openBrowse}>
                        Browse
                      </button>
                    </div>
                    <ul className="mv-layer-list">
                      {added.map((lyr) => {
                        const obj = layerObjs.current.get(lyr.id) as { visible?: boolean } | undefined
                        const visible = obj?.visible !== false
                        return (
                          <li key={lyr.id}>
                            <button
                              type="button"
                              className="mv-icon-btn"
                              title={visible ? 'Hide' : 'Show'}
                              onClick={() => toggleVisibility(lyr.id)}
                            >
                              {visible ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                            <div className="mv-layer-meta">
                              <strong>{lyr.title}</strong>
                              <span className="muted">{lyr.kind}</span>
                            </div>
                            <button
                              type="button"
                              className="mv-icon-btn"
                              title="Remove"
                              onClick={() => removeLayer(lyr.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </>
            )}

            {panel === 'browse' && (
              <div className="mv-panel__body">
                <div className="mv-browse-scopes">
                  <button
                    type="button"
                    className={browseScope === 'mine' ? 'is-active' : ''}
                    onClick={() => setBrowseScope('mine')}
                  >
                    My content
                  </button>
                  <button
                    type="button"
                    className={browseScope === 'org' ? 'is-active' : ''}
                    onClick={() => setBrowseScope('org')}
                  >
                    My organization
                  </button>
                </div>
                <label className="ep-search ep-search--sm" style={{ margin: '0 0 0.65rem' }}>
                  <Search size={14} />
                  <input
                    value={browseQuery}
                    onChange={(e) => setBrowseQuery(e.target.value)}
                    placeholder="Search layers"
                  />
                </label>
                <select
                  className="mv-select"
                  value={browseType}
                  onChange={(e) => setBrowseType(e.target.value)}
                >
                  {LAYER_SEARCH_TYPES.map((t) => (
                    <option key={t.value || 'all'} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {browseError && <p className="form-error">{browseError}</p>}
                {browseLoading ? (
                  <div className="ep-spinner-wrap">
                    <div className="ep-spinner" />
                  </div>
                ) : (
                  <ul className="mv-browse-list">
                    {browseResults.map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{item.title}</strong>
                          <div className="ep-item-type">
                            <span className={`type-icon ${typeIconClass(item.type || '')}`} />
                            {itemTypeLabel(item.type || 'Layer')}
                          </div>
                          <div className="muted">{item.owner}</div>
                        </div>
                        <button
                          type="button"
                          className="ep-btn ep-btn--outline"
                          disabled={busy || !mapReady}
                          onClick={() => void addFromPortalItem(item)}
                        >
                          + Add
                        </button>
                      </li>
                    ))}
                    {browseResults.length === 0 && (
                      <li className="muted">Geen lagen gevonden. Probeer een andere zoekterm.</li>
                    )}
                  </ul>
                )}
              </div>
            )}

            {panel === 'tables' && (
              <div className="mv-panel__empty">
                <Table2 size={48} strokeWidth={1} />
                <p>Add tables to your map and they will appear here.</p>
              </div>
            )}
            {panel === 'basemap' && (
              <div className="mv-panel__body">
                <p className="muted">Current basemap</p>
                <div className="mv-basemap-current">Topo (vector)</div>
              </div>
            )}
            {panel === 'legend' && (
              <div className="mv-panel__empty">
                <p>{added.length ? 'Legend volgt als lagen geladen zijn.' : 'No legend'}</p>
              </div>
            )}
            {panel === 'bookmarks' && (
              <div className="mv-panel__empty">
                <BookMarked size={48} strokeWidth={1} />
                <p>No bookmarks</p>
              </div>
            )}
            {panel === 'charts' && (
              <div className="mv-panel__empty">
                <BarChart3 size={48} strokeWidth={1} />
                <p>Select a layer to configure charts (later).</p>
              </div>
            )}
            {panel === 'properties' && (
              <div className="mv-panel__body">
                <label className="mv-toggle">
                  <input type="checkbox" disabled /> Enable background color
                </label>
                <label className="mv-toggle">
                  <input type="checkbox" disabled /> Preserve map scale
                </label>
              </div>
            )}
          </aside>
        )}

        <div className="mv-stage">
          <div ref={mapDivRef} className="mv-canvas" />
          {!mapReady && !mapError && (
            <div className="mv-placeholder">
              <div className="ep-spinner" />
              <p>Kaart laden…</p>
            </div>
          )}
          {mapError && (
            <div className="mv-placeholder">
              <p className="form-error">{mapError}</p>
            </div>
          )}
          <div className="mv-tools">
            <button type="button" title="Search" disabled>
              <Search size={16} />
            </button>
            <button type="button" title="Home" onClick={() => void goHome()}>
              <Home size={16} />
            </button>
            <button type="button" title="Zoom in" onClick={() => void zoom(1)}>
              <Plus size={16} />
            </button>
            <button type="button" title="Zoom out" onClick={() => void zoom(-1)}>
              <Minus size={16} />
            </button>
            <button type="button" title="Fullscreen" disabled>
              <Maximize2 size={16} />
            </button>
          </div>
          <div className="mv-powered">Powered by Esri</div>
        </div>

        <aside className="mv-rail mv-rail--light">
          <button type="button" disabled title="More">
            <MoreHorizontal size={16} />
          </button>
          <div className="mv-rail__spacer" />
          <button type="button" title="Collapse" disabled>
            <ChevronLeft size={16} />
          </button>
        </aside>
      </div>

      {addModal === 'url' && (
        <div className="mv-modal-backdrop" role="presentation" onClick={() => setAddModal(null)}>
          <div
            className="mv-modal"
            role="dialog"
            aria-labelledby="add-url-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <h2 id="add-url-title">Add Layer</h2>
              <button type="button" className="mv-icon-btn" onClick={() => setAddModal(null)}>
                <X size={16} />
              </button>
            </header>
            <div className="mv-modal__body">
              <label>
                URL
                <input
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  placeholder="https://"
                />
              </label>
              <p className="muted">
                Supported: Feature Service, Map Service, CSV, GeoJSON, WMS, WMTS, ArcGIS Server web
                service.
              </p>
              <label>
                Type
                <select value={urlKind} onChange={(e) => setUrlKind(e.target.value as LayerKind)}>
                  <option value="auto">Select layer type (auto)</option>
                  <option value="Feature Service">Feature layer</option>
                  <option value="Map Service">Map image layer</option>
                  <option value="CSV">CSV</option>
                  <option value="GeoJSON">GeoJSON</option>
                  <option value="WMS">WMS</option>
                  <option value="WMTS">WMTS</option>
                </select>
              </label>
              {urlError && <p className="form-error">{urlError}</p>}
            </div>
            <footer>
              <button type="button" className="ep-btn ep-btn--outline" onClick={() => setAddModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="ep-btn ep-btn--primary"
                disabled={busy || !mapReady}
                onClick={() => void submitUrl()}
              >
                {busy ? 'Adding…' : 'Next'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {addModal === 'file' && (
        <div className="mv-modal-backdrop" role="presentation" onClick={() => setAddModal(null)}>
          <div
            className="mv-modal"
            role="dialog"
            aria-labelledby="add-file-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <h2 id="add-file-title">Add Layer</h2>
              <button type="button" className="mv-icon-btn" onClick={() => setAddModal(null)}>
                <X size={16} />
              </button>
            </header>
            <div className="mv-modal__body">
              <div className="mv-drop">
                <p>
                  <strong>Drag and drop your file or choose an option</strong>
                </p>
                <p className="muted">Supported file types: CSV, GeoJSON</p>
                <label className="ep-btn ep-btn--outline">
                  Your device
                  <input
                    type="file"
                    accept=".csv,.geojson,.json,application/geo+json,text/csv"
                    hidden
                    onChange={(e) => void submitFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              {fileError && <p className="form-error">{fileError}</p>}
            </div>
            <footer>
              <button type="button" className="ep-btn ep-btn--outline" onClick={() => setAddModal(null)}>
                Cancel
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
