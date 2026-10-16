import { loadModules, setDefaultOptions } from 'esri-loader'
import { ExternalLink, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { WebMapData } from '../types/arcgis'

setDefaultOptions({ version: '4.31', css: true })

interface MapPreviewProps {
  open: boolean
  title: string
  itemId?: string
  portalHomeUrl?: string
  webMapData: WebMapData | null
  dirty?: boolean
  token?: string
  onClose: () => void
}

function toPortalHome(portalRestUrl?: string): string {
  if (!portalRestUrl) return 'https://www.arcgis.com'
  return portalRestUrl.replace(/\/sharing\/rest\/?$/i, '')
}

/**
 * Preview modal: tries ArcGIS JS API from current (possibly unsaved) JSON.
 * Falls back to the portal map viewer for saved items.
 */
export function MapPreview({
  open,
  title,
  itemId,
  portalHomeUrl,
  webMapData,
  dirty,
  token,
  onClose,
}: MapPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<{ destroy: () => void } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'live' | 'portal'>('live')

  const home = toPortalHome(portalHomeUrl)
  const portalViewerUrl = itemId
    ? `${home}/home/webmap/viewer.html?webmap=${encodeURIComponent(itemId)}`
    : null

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open || mode !== 'live' || !webMapData || !containerRef.current) return
    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const [esriConfig, IdentityManager, WebMap, MapView] = await loadModules([
          'esri/config',
          'esri/identity/IdentityManager',
          'esri/WebMap',
          'esri/views/MapView',
        ])

        if (portalHomeUrl) {
          esriConfig.portalUrl = toPortalHome(portalHomeUrl)
        }
        if (token && portalHomeUrl) {
          IdentityManager.registerToken({
            server: portalHomeUrl,
            token,
          })
        }

        const map = WebMap.fromJSON
          ? WebMap.fromJSON(structuredClone(webMapData))
          : new WebMap(structuredClone(webMapData))

        if (cancelled || !containerRef.current) return
        const view = new MapView({
          container: containerRef.current,
          map,
          ui: { components: ['zoom', 'attribution'] },
        })
        viewRef.current = view
        await view.when()
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Preview laden mislukt. Probeer de portal-viewer (opgeslagen versie).',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      if (viewRef.current) {
        viewRef.current.destroy()
        viewRef.current = null
      }
    }
  }, [open, mode, webMapData, portalHomeUrl, token])

  if (!open) return null

  return (
    <div className="map-preview" role="presentation" onClick={onClose}>
      <div
        className="map-preview__panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="map-preview__header">
          <div>
            <h3>{title}</h3>
            <p className="muted">
              {mode === 'live'
                ? dirty
                  ? 'Live preview van huidige (niet-opgeslagen) JSON'
                  : 'Live preview van webmap JSON'
                : 'Portal map viewer (laatst opgeslagen versie)'}
            </p>
          </div>
          <div className="map-preview__actions">
            <div className="tabs">
              <button
                type="button"
                className={`tabs__btn ${mode === 'live' ? 'is-active' : ''}`}
                onClick={() => setMode('live')}
              >
                Live JSON
              </button>
              <button
                type="button"
                className={`tabs__btn ${mode === 'portal' ? 'is-active' : ''}`}
                onClick={() => setMode('portal')}
                disabled={!portalViewerUrl}
              >
                Portal viewer
              </button>
            </div>
            {portalViewerUrl && (
              <a
                className="btn btn--ghost btn--sm"
                href={portalViewerUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={14} />
                Open
              </a>
            )}
            <button type="button" className="btn btn--ghost btn--icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>

        {error && <p className="form-error map-preview__error">{error}</p>}

        <div className="map-preview__body">
          {mode === 'live' ? (
            <>
              {loading && <p className="muted map-preview__loading">Kaart laden…</p>}
              <div ref={containerRef} className="map-preview__canvas" />
            </>
          ) : portalViewerUrl ? (
            <iframe title="Portal map viewer" src={portalViewerUrl} className="map-preview__frame" />
          ) : (
            <p className="muted empty-panel">Geen item-id voor portal viewer.</p>
          )}
        </div>
      </div>
    </div>
  )
}
