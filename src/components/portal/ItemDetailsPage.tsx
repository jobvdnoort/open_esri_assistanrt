import { ChevronDown, ChevronRight, Lock, Pencil, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { OperationalLayer, PortalItem, WebMapData } from '../../types/arcgis'
import { formatPortalDate, initials, itemTypeLabel } from './format'

interface ItemDetailsPageProps {
  itemId: string
  onBack: () => void
  onOpenMap: (item: PortalItem) => void
}

type DetailTab = 'overview' | 'settings'

export function ItemDetailsPage({ itemId, onBack, onOpenMap }: ItemDetailsPageProps) {
  const { getItem, getWebMap, getItemData, portal } = useAuth()
  const [item, setItem] = useState<PortalItem | null>(null)
  const [webMap, setWebMap] = useState<WebMapData | null>(null)
  const [layers, setLayers] = useState<OperationalLayer[]>([])
  const [tab, setTab] = useState<DetailTab>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const meta = await getItem(itemId)
        if (cancelled) return
        setItem(meta)
        if (meta.type === 'Web Map' || meta.type === 'Web Scene') {
          try {
            const wm = await getWebMap(itemId)
            if (cancelled) return
            setWebMap(wm.data)
            setLayers(wm.data.operationalLayers ?? [])
          } catch {
            const raw = await getItemData(itemId)
            if (cancelled) return
            const data = raw as WebMapData
            setWebMap(data)
            setLayers(data.operationalLayers ?? [])
          }
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
  }, [itemId, getItem, getWebMap, getItemData])

  if (loading) {
    return (
      <div className="ep-spinner-wrap">
        <div className="ep-spinner" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="ep-org-panel">
        <p className="form-error">{error || 'Item niet gevonden'}</p>
        <button type="button" className="ep-btn ep-btn--outline" onClick={onBack}>
          Back to Content
        </button>
      </div>
    )
  }

  const isMap = item.type === 'Web Map' || item.type === 'Web Scene'
  const openLabel =
    item.type === 'Web Scene' ? 'Open in Scene Viewer' : 'Open in Map Viewer'

  return (
    <div className="ep-item">
      <div className="ep-subhead ep-subhead--item">
        <div className="ep-subhead__title-row">
          <button type="button" className="ep-back" onClick={onBack}>
            Content
          </button>
          <h1>
            {item.title}
            <Pencil size={16} />
          </h1>
        </div>
        <div className="ep-subhead__tabs">
          <button
            type="button"
            className={tab === 'overview' ? 'is-active' : ''}
            onClick={() => setTab('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={tab === 'settings' ? 'is-active' : ''}
            onClick={() => setTab('settings')}
          >
            Settings
          </button>
        </div>
      </div>

      {tab === 'settings' ? (
        <div className="ep-org-panel">
          <p className="ep-side-muted">Item settings komen later.</p>
        </div>
      ) : (
        <div className="ep-item-grid">
          <div className="ep-item-main">
            <div className="ep-item-hero">
              <div className="ep-latest-thumb ep-latest-thumb--lg" />
              <button type="button" className="ep-btn ep-btn--ghost-sm" disabled>
                <Star size={14} />
                Add to Favorites
              </button>
            </div>

            <section className="ep-item-section">
              <header>
                <h2>{item.snippet || 'Add a brief summary about the item.'}</h2>
              </header>
              <p className="ep-item-byline">
                {itemTypeLabel(item.type)} by {item.owner}
              </p>
              <p className="muted">
                Item created: {formatPortalDate(item.created)}
                {'   '}
                Item updated: {formatPortalDate(item.modified)}
                {'   '}
                View count: {(item.numViews ?? 0).toLocaleString()}
              </p>
            </section>

            <section className="ep-item-section">
              <header>
                <h2>Description</h2>
              </header>
              <p>{item.description || 'Add an in-depth description of the item.'}</p>
            </section>

            {isMap && (
              <section className="ep-item-section">
                <header>
                  <h2>Layers</h2>
                </header>
                <LayerList
                  layers={layers}
                  openGroups={openGroups}
                  onToggle={(key) =>
                    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))
                  }
                />
                {layers.length === 0 && (
                  <p className="muted">
                    {webMap ? 'No operational layers.' : 'Layers unavailable.'}
                  </p>
                )}
              </section>
            )}
          </div>

          <aside className="ep-item-side">
            {isMap && (
              <button
                type="button"
                className="ep-btn ep-btn--primary ep-btn--block"
                onClick={() => onOpenMap(item)}
              >
                {openLabel}
              </button>
            )}
            <button type="button" className="ep-btn ep-btn--outline ep-btn--block" disabled>
              Share
            </button>

            <section className="ep-side-meta">
              <h3>Details</h3>
              <p>Size: {item.size ? `${(item.size / 1024).toFixed(3)} KB` : '—'}</p>
              <p>
                ID: <code>{item.id}</code>
              </p>
            </section>

            <section className="ep-side-meta">
              <header>
                <h3>Share</h3>
              </header>
              <p className="ep-share-row">
                <Lock size={16} />
                {item.access === 'public'
                  ? 'Everyone'
                  : item.access === 'org'
                    ? 'Organization'
                    : 'Owner'}
              </p>
            </section>

            <section className="ep-side-meta">
              <header>
                <h3>Owner</h3>
              </header>
              <div className="ep-contact">
                <span className="ep-avatar">{initials(item.owner)}</span>
                <strong>{item.owner || portal?.user?.username}</strong>
              </div>
            </section>

            {item.tags && item.tags.length > 0 && (
              <section className="ep-side-meta">
                <h3>Tags</h3>
                <p className="ep-tags">
                  {item.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </p>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

function LayerList({
  layers,
  openGroups,
  onToggle,
  depth = 0,
}: {
  layers: OperationalLayer[]
  openGroups: Record<string, boolean>
  onToggle: (key: string) => void
  depth?: number
}) {
  return (
    <ul className="ep-layer-list" style={{ paddingLeft: depth ? 16 : 0 }}>
      {layers.map((layer, index) => {
        const key = `${depth}-${index}-${layer.id || layer.title}`
        const kids = layer.layers ?? []
        const isGroup = kids.length > 0 || layer.layerType === 'GroupLayer'
        const open = openGroups[key] ?? true
        return (
          <li key={key}>
            <div className="ep-layer-row">
              {isGroup ? (
                <button type="button" className="ep-icon-btn" onClick={() => onToggle(key)}>
                  {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <span className="type-icon type-icon--mapimage" />
              )}
              <div>
                <div className="ep-layer-name">{layer.title || 'Untitled layer'}</div>
                <div className="muted">
                  {isGroup ? 'Group layer' : layer.layerType || 'Layer'}
                </div>
              </div>
            </div>
            {isGroup && open && (
              <LayerList
                layers={kids}
                openGroups={openGroups}
                onToggle={onToggle}
                depth={depth + 1}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}
