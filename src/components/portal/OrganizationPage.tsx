import { ExternalLink, LayoutGrid, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { PortalItem } from '../../types/arcgis'
import { formatPortalDate, initials, itemTypeLabel, typeIconClass } from './format'

import type { OrgTab } from './tabs'

interface OrganizationPageProps {
  tab: OrgTab
  onOpenItem: (item: PortalItem) => void
  onViewAllContent: () => void
}

export function OrganizationPage({ tab, onOpenItem, onViewAllContent }: OrganizationPageProps) {
  const { portal, browseContent } = useAuth()
  const [latest, setLatest] = useState<PortalItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (tab !== 'overview') return
    let cancelled = false
    setLoading(true)
    void browseContent({ scope: 'org' })
      .then((r) => {
        if (!cancelled) setLatest(r.results.slice(0, 5))
      })
      .catch(() => {
        if (!cancelled) setLatest([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, browseContent])

  if (tab === 'status') {
    return (
      <div className="ep-org-panel">
        <p className="ep-side-muted">Organization status metrics komen later.</p>
      </div>
    )
  }

  if (tab === 'members') {
    return (
      <div className="ep-org">
        <div className="ep-toolbar ep-toolbar--gray">
          <button type="button" className="ep-btn ep-btn--outline" disabled>
            Add Members
          </button>
          <label className="ep-search">
            <Search size={16} />
            <input placeholder="Search members" disabled />
          </label>
          <button type="button" className="ep-chip is-active">
            <LayoutGrid size={14} />
            Table
          </button>
        </div>
        <div className="ep-split">
          <aside className="ep-sidebar">
            <section className="ep-side-block">
              <div className="ep-side-block__head">
                <h2>Filters</h2>
              </div>
              <p className="ep-side-muted">Role- en groupfilters komen later.</p>
            </section>
          </aside>
          <section className="ep-main-list">
            <div className="ep-member-row">
              <span className="ep-avatar">{initials(portal?.user?.fullName)}</span>
              <div>
                <strong className="ep-linkish">{portal?.user?.fullName || 'You'}</strong>
                <div className="muted">{portal?.user?.username}</div>
              </div>
              <span>Today</span>
              <span>Publisher</span>
            </div>
            <p className="ep-side-muted" style={{ padding: '1rem' }}>
              Volledige memberlijst vereist portal admin API — nu alleen jij zichtbaar.
            </p>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="ep-org-overview">
      <div className="ep-org-cards">
        <article className="ep-card">
          <header>
            <h2>Administrative contacts</h2>
            <span className="ep-linkish">View all</span>
          </header>
          <div className="ep-contact">
            <span className="ep-avatar">{initials(portal?.user?.fullName)}</span>
            <div>
              <strong>{portal?.user?.fullName || 'Portal Admin'}</strong>
              <div className="muted">{portal?.user?.email || '—'}</div>
            </div>
          </div>
        </article>
        <article className="ep-card">
          <header>
            <h2>Members</h2>
            <span>
              <span className="ep-linkish">Add Members</span>
              <span className="ep-pipe">|</span>
              <span className="ep-linkish">Manage members</span>
            </span>
          </header>
          <p className="ep-stat-label">Total members</p>
          <p className="ep-stat-value">—</p>
        </article>
      </div>

      <section className="ep-latest">
        <header>
          <h2>Latest content</h2>
          <button type="button" className="ep-linkish" onClick={onViewAllContent}>
            View all content
            <ExternalLink size={13} />
          </button>
        </header>
        {loading ? (
          <div className="ep-spinner-wrap">
            <div className="ep-spinner" />
          </div>
        ) : (
          <div className="ep-latest-grid">
            {latest.map((item) => (
              <article key={item.id} className="ep-latest-card">
                <div className="ep-latest-thumb" />
                <button type="button" className="ep-item-title" onClick={() => onOpenItem(item)}>
                  {item.title}
                </button>
                <div className="ep-item-type">
                  <span className={`type-icon ${typeIconClass(item.type)}`} />
                  {itemTypeLabel(item.type)}
                </div>
                <p className="muted">
                  Created: {formatPortalDate(item.created)}
                  <br />
                  Updated: {formatPortalDate(item.modified)}
                </p>
                <footer>{item.owner}</footer>
              </article>
            ))}
            {latest.length === 0 && <p className="ep-empty">No recent content.</p>}
          </div>
        )}
      </section>
    </div>
  )
}
