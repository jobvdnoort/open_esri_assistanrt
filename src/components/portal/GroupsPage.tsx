import { Building2, ChevronDown, Lock, MoreHorizontal, Plus, Search, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { PortalGroup } from '../../lib/content'
import { formatPortalDate, initials } from './format'

import type { GroupsTab } from './tabs'

interface GroupsPageProps {
  tab: GroupsTab
  onOpenGroupContent?: (groupId: string) => void
}

export function GroupsPage({ tab, onOpenGroupContent }: GroupsPageProps) {
  const { listGroups, listOrgGroups, portal } = useAuth()
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState<PortalGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (tab === 'featured') {
        setGroups([])
        return
      }
      const list =
        tab === 'org' ? await listOrgGroups(query || undefined) : await listGroups()
      const q = query.trim().toLowerCase()
      setGroups(
        q && tab === 'mine'
          ? list.filter(
              (g) =>
                g.title.toLowerCase().includes(q) ||
                (g.snippet ?? '').toLowerCase().includes(q),
            )
          : list,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laden mislukt')
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [tab, query, listGroups, listOrgGroups])

  useEffect(() => {
    void load()
  }, [load])

  const searchPlaceholder =
    tab === 'org' ? "Search my organization's groups" : 'Search my groups'

  return (
    <div className="ep-groups">
      <div className="ep-toolbar">
        <button type="button" className="ep-btn ep-btn--outline" disabled>
          <Plus size={14} />
          Create group
        </button>
        <label className="ep-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
          />
        </label>
      </div>

      <div className="ep-split">
        <aside className="ep-sidebar">
          <section className="ep-side-block">
            <div className="ep-side-block__head">
              <h2>Filters</h2>
            </div>
            <p className="ep-side-muted">Special groups, dates and visibility filters komen later.</p>
          </section>
        </aside>

        <section className="ep-main-list">
          <div className="ep-list-toolbar">
            <span>
              {loading
                ? 'Loading…'
                : groups.length > 0
                  ? `1-${groups.length} of ${groups.length}`
                  : '0 groups'}
            </span>
            <button type="button" className="ep-chip">
              Title
              <ChevronDown size={14} />
            </button>
          </div>

          {error && <p className="form-error">{error}</p>}

          {loading && groups.length === 0 ? (
            <div className="ep-spinner-wrap">
              <div className="ep-spinner" />
            </div>
          ) : (
            <div className="ep-group-cards">
              {groups.map((g) => (
                <article key={g.id} className="ep-group-card">
                  <div className="ep-group-card__body">
                    <div className="ep-group-thumb" aria-hidden>
                      {g.title.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="ep-group-card__meta">
                      <button
                        type="button"
                        className="ep-group-card__title"
                        onClick={() => onOpenGroupContent?.(g.id)}
                      >
                        {g.title}
                      </button>
                      <p>{g.snippet || g.description || 'No description.'}</p>
                      <div className="ep-group-card__stats">
                        <span>Last updated: {formatPortalDate(g.modified)}</span>
                        <span className="ep-group-access">
                          {g.access === 'org' || g.access === 'public' ? (
                            <Building2 size={13} />
                          ) : (
                            <Lock size={13} />
                          )}
                          Viewable by:{' '}
                          {g.access === 'public'
                            ? 'Everyone'
                            : g.access === 'org'
                              ? 'Organization'
                              : 'Group members'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <footer className="ep-group-card__foot">
                    <div className="ep-group-owner">
                      <span className="ep-avatar ep-avatar--sm">{initials(g.owner)}</span>
                      {g.owner || portal?.user?.fullName}
                    </div>
                    <div className="ep-row-actions">
                      <button
                        type="button"
                        className="ep-btn ep-btn--ghost-sm"
                        onClick={() => onOpenGroupContent?.(g.id)}
                      >
                        Preview
                      </button>
                      <button type="button" className="ep-icon-btn" disabled aria-label="More">
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                  </footer>
                </article>
              ))}
              {!loading && groups.length === 0 && (
                <div className="ep-empty">
                  <Users size={28} />
                  <p>
                    {tab === 'featured'
                      ? 'No featured groups configured.'
                      : 'No groups found.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
