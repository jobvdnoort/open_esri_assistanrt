import {
  BarChart3,
  Bell,
  BookMarked,
  ChevronLeft,
  ChevronRight,
  Code2,
  FolderOpen,
  Grid3x3,
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
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { initials } from './format'

type LeftPanel =
  | 'layers'
  | 'tables'
  | 'basemap'
  | 'legend'
  | 'bookmarks'
  | 'charts'
  | 'properties'
  | null

interface MapViewerPageProps {
  /** Optional: open an existing webmap. Omit for new Untitled map. */
  itemId?: string
  onLeave?: () => void
}

/**
 * Map Viewer shell: new unsaved "Untitled map" with basemap only (no layers).
 * Matches ArcGIS Enterprise Map Viewer chrome from the user's screenshots.
 */
export function MapViewerPage({ itemId, onLeave }: MapViewerPageProps) {
  const { portal, mode, portalUrl, auth } = useAuth()
  const [panel, setPanel] = useState<LeftPanel>('layers')
  const [addOpen, setAddOpen] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<{ destroy?: () => void; goTo?: (t: unknown) => Promise<unknown> } | null>(
    null,
  )

  const displayName = portal?.user?.fullName || portal?.user?.username || 'Gebruiker'
  const username = portal?.user?.username || ''
  const title = itemId ? 'Web map' : 'Untitled map'

  const togglePanel = (id: LeftPanel) => {
    setPanel((prev) => (prev === id ? null : id))
    setAddOpen(false)
  }

  // New map (or optional item): MapView + basemap only — never auto-load a portal WebMap for Map tab.
  useEffect(() => {
    let cancelled = false
    const container = mapRef.current
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

        if (cancelled || !mapRef.current) return

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
              IdentityManager.registerToken({
                server: portalHome,
                token,
              })
            }
          } catch {
            /* basemap may still work from public tiles */
          }
        }

        viewRef.current?.destroy?.()

        // Untitled / new map: light topo basemap, no operational layers.
        // Prefer a simple world topo so we don't depend on org basemap gallery.
        let basemap: unknown = 'topo-vector'
        try {
          basemap = Basemap.fromId('topo-vector')
        } catch {
          basemap = 'streets-vector'
        }

        const map = new Map({ basemap })
        const view = new MapView({
          container: mapRef.current,
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
    }
  }, [itemId, portalUrl, mode, auth])

  const zoom = async (delta: number) => {
    const view = viewRef.current as { zoom?: number; goTo?: (t: unknown) => Promise<unknown> } | null
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
          <strong>{title}</strong>
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
              className={addOpen ? 'is-active' : ''}
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
                <button type="button" disabled>
                  <Search size={14} /> Browse layers
                </button>
                <button type="button" disabled>
                  <MapIcon size={14} /> Add layer from URL
                </button>
                <button type="button" disabled>
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
          <aside className="mv-panel">
            <header>
              <h2>
                {panel === 'layers' && 'Layers'}
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
              <div className="mv-panel__empty">
                <Layers size={48} strokeWidth={1} />
                <p>Add layers to your map and they will appear here.</p>
                <button
                  type="button"
                  className="ep-btn ep-btn--outline"
                  onClick={() => setAddOpen(true)}
                >
                  <Layers size={14} />
                  Add
                </button>
              </div>
            )}
            {panel === 'tables' && (
              <div className="mv-panel__empty">
                <Table2 size={48} strokeWidth={1} />
                <p>Add tables to your map and they will appear here.</p>
                <button type="button" className="ep-btn ep-btn--outline" disabled>
                  Add table
                </button>
              </div>
            )}
            {panel === 'basemap' && (
              <div className="mv-panel__body">
                <p className="muted">Current basemap</p>
                <div className="mv-basemap-current">Topo (vector)</div>
                <p className="ep-side-muted">Org basemap gallery komt later.</p>
              </div>
            )}
            {panel === 'legend' && (
              <div className="mv-panel__empty">
                <p>No legend</p>
              </div>
            )}
            {panel === 'bookmarks' && (
              <div className="mv-panel__empty">
                <BookMarked size={48} strokeWidth={1} />
                <p>No bookmarks</p>
                <p className="muted">Add bookmarks to your map and they will appear here.</p>
                <button type="button" className="ep-btn ep-btn--outline" disabled>
                  + Add bookmark
                </button>
              </div>
            )}
            {panel === 'charts' && (
              <div className="mv-panel__empty">
                <BarChart3 size={48} strokeWidth={1} />
                <p>
                  To add charts, select a layer or table in your map and then click Configure charts
                  on the Settings toolbar.
                </p>
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
                <p className="muted" style={{ marginTop: '1rem' }}>
                  Time zone
                </p>
                <label className="mv-radio">
                  <input type="radio" name="tz" defaultChecked disabled /> Device time zone
                </label>
                <label className="mv-radio">
                  <input type="radio" name="tz" disabled /> Specific time zone
                </label>
              </div>
            )}
          </aside>
        )}

        <div className="mv-stage">
          <div ref={mapRef} className="mv-canvas" />
          {!mapReady && !mapError && (
            <div className="mv-placeholder">
              <div className="ep-spinner" />
              <p>Kaart laden…</p>
            </div>
          )}
          {mapError && (
            <div className="mv-placeholder">
              <p className="form-error">{mapError}</p>
              <p className="muted">UI blijft beschikbaar; basemap kon niet starten.</p>
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
          <button type="button" disabled title="Properties">
            <Settings size={16} />
          </button>
          <div className="mv-rail__spacer" />
          <button type="button" title="Collapse" disabled>
            <ChevronLeft size={16} />
          </button>
        </aside>
      </div>
    </div>
  )
}
