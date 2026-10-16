import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Search,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { ContentScope, PortalFolder, PortalGroup } from '../../lib/content'
import type { PortalItem } from '../../types/arcgis'
import { formatPortalDate, itemTypeLabel, typeIconClass } from './format'
import type { ContentTab } from './tabs'

type FolderKey = 'all' | 'root' | string
type PageSize = 30 | 50 | 100

const PAGE_SIZES: PageSize[] = [30, 50, 100]

const ITEM_TYPE_FILTERS = [
  { value: '', label: 'All types' },
  { value: 'Web Map', label: 'Web Map' },
  { value: 'Web Scene', label: 'Web Scene' },
  { value: 'Feature Service', label: 'Feature layer' },
  { value: 'Map Service', label: 'Map image layer' },
  { value: 'Web Mapping Application', label: 'Web mapping application' },
  { value: 'Dashboard', label: 'Dashboard' },
]

interface ContentPageProps {
  tab: ContentTab
  onOpenItem: (item: PortalItem) => void
  onOpenMap?: (item: PortalItem) => void
}

function pageNumbers(current: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const pages: (number | '…')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(totalPages - 1, current + 1)
  if (start > 2) pages.push('…')
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < totalPages - 1) pages.push('…')
  pages.push(totalPages)
  return pages
}

export function ContentPage({ tab, onOpenItem, onOpenMap }: ContentPageProps) {
  const { browseContent, listFolders, listGroups, browseGroupItems, portal } = useAuth()
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [folderKey, setFolderKey] = useState<FolderKey>('all')
  const [folders, setFolders] = useState<PortalFolder[]>([])
  const [folderFilter, setFolderFilter] = useState('')
  const [groups, setGroups] = useState<PortalGroup[]>([])
  const [activeGroupId, setActiveGroupId] = useState<string | 'all'>('all')
  const [groupFilter, setGroupFilter] = useState('')
  const [items, setItems] = useState<PortalItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typeOpen, setTypeOpen] = useState(true)
  const [pageSize, setPageSize] = useState<PageSize>(30)
  const [page, setPage] = useState(1)

  const scope: ContentScope =
    tab === 'mine' ? 'mine' : tab === 'favorites' ? 'favorites' : tab === 'org' ? 'org' : 'groups'

  useEffect(() => {
    setQuery('')
    setType('')
    setFolderKey('all')
    setActiveGroupId('all')
    setPage(1)
  }, [tab])

  useEffect(() => {
    setPage(1)
  }, [query, type, folderKey, activeGroupId, pageSize])

  useEffect(() => {
    if (tab === 'mine') {
      void listFolders()
        .then(setFolders)
        .catch(() => setFolders([]))
    }
    if (tab === 'groups') {
      void listGroups()
        .then(setGroups)
        .catch(() => setGroups([]))
    }
  }, [tab, listFolders, listGroups])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const start = (page - 1) * pageSize + 1
    try {
      if (tab === 'groups') {
        let groupList = groups
        if (groupList.length === 0) {
          groupList = await listGroups()
          setGroups(groupList)
        }
        if (activeGroupId === 'all') {
          const all: PortalItem[] = []
          for (const group of groupList.slice(0, 5)) {
            const r = await browseGroupItems(group.id, {
              query: query || undefined,
              type: type || undefined,
            })
            all.push(...(Array.isArray(r.results) ? r.results : []))
          }
          const filtered = all.filter(Boolean)
          setTotal(filtered.length)
          setItems(filtered.slice(start - 1, start - 1 + pageSize))
          return
        }
        const result = await browseGroupItems(activeGroupId, {
          query: query || undefined,
          type: type || undefined,
        })
        const list = Array.isArray(result.results) ? result.results.filter(Boolean) : []
        setTotal(typeof result.total === 'number' ? result.total : list.length)
        setItems(list.slice(start - 1, start - 1 + pageSize))
        return
      }

      const folderId =
        tab !== 'mine'
          ? undefined
          : folderKey === 'all'
            ? undefined
            : folderKey === 'root'
              ? null
              : folderKey

      const result = await browseContent({
        scope,
        query: query || undefined,
        type: type || undefined,
        folderId,
        start,
        num: pageSize,
      })
      setItems(Array.isArray(result.results) ? result.results.filter(Boolean) : [])
      setTotal(typeof result.total === 'number' ? result.total : 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laden mislukt')
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [
    tab,
    scope,
    query,
    type,
    folderKey,
    activeGroupId,
    groups,
    page,
    pageSize,
    browseContent,
    browseGroupItems,
    listGroups,
  ])

  useEffect(() => {
    void load()
  }, [load])

  const filteredFolders = useMemo(() => {
    const q = folderFilter.trim().toLowerCase()
    if (!q) return folders
    return folders.filter((f) => f.title.toLowerCase().includes(q))
  }, [folders, folderFilter])

  const filteredGroups = useMemo(() => {
    const q = groupFilter.trim().toLowerCase()
    if (!q) return groups
    return groups.filter((g) => g.title.toLowerCase().includes(q))
  }, [groups, groupFilter])

  const searchPlaceholder =
    tab === 'mine'
      ? 'Search All my content'
      : tab === 'favorites'
        ? 'Search My Favorites'
        : tab === 'groups'
          ? 'Search My Groups'
          : 'Search My Organization'

  const username = portal?.user?.username || 'My content'
  const showOwner = tab === 'org' || tab === 'groups'
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = total === 0 ? 0 : Math.min(page * pageSize, total)

  return (
    <div className="ep-content">
      <div className="ep-toolbar">
        {tab === 'mine' && (
          <div className="ep-toolbar__actions">
            <button type="button" className="ep-btn ep-btn--outline" disabled>
              <Plus size={14} />
              New item
            </button>
            <button type="button" className="ep-btn ep-btn--outline" disabled>
              <LayoutGrid size={14} />
              Create app
            </button>
          </div>
        )}
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
          {tab === 'mine' && (
            <section className="ep-side-block">
              <div className="ep-side-block__head">
                <h2>Folders</h2>
              </div>
              <label className="ep-search ep-search--sm">
                <Search size={14} />
                <input
                  value={folderFilter}
                  onChange={(e) => setFolderFilter(e.target.value)}
                  placeholder="Filter folders"
                />
              </label>
              <ul className="ep-folder-list">
                <li>
                  <button
                    type="button"
                    className={folderKey === 'all' ? 'is-active' : ''}
                    onClick={() => setFolderKey('all')}
                  >
                    <Folder size={15} />
                    All my content
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={folderKey === 'root' ? 'is-active' : ''}
                    onClick={() => setFolderKey('root')}
                  >
                    <Folder size={15} />
                    {username}
                  </button>
                </li>
                {filteredFolders.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      className={folderKey === f.id ? 'is-active' : ''}
                      onClick={() => setFolderKey(f.id)}
                    >
                      <Folder size={15} />
                      <span>{f.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === 'groups' && (
            <section className="ep-side-block">
              <div className="ep-side-block__head">
                <h2>My groups</h2>
              </div>
              <label className="ep-search ep-search--sm">
                <Search size={14} />
                <input
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  placeholder="Filter groups"
                />
              </label>
              <ul className="ep-folder-list">
                <li>
                  <button
                    type="button"
                    className={activeGroupId === 'all' ? 'is-active' : ''}
                    onClick={() => setActiveGroupId('all')}
                  >
                    All my groups&apos; content
                  </button>
                </li>
                {filteredGroups.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      className={activeGroupId === g.id ? 'is-active' : ''}
                      onClick={() => setActiveGroupId(g.id)}
                    >
                      <span>{g.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="ep-side-block">
            <div className="ep-side-block__head">
              <h2>Filters</h2>
            </div>
            <button
              type="button"
              className="ep-filter-toggle"
              onClick={() => setTypeOpen((v) => !v)}
            >
              {typeOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Item type
            </button>
            {typeOpen && (
              <ul className="ep-filter-list">
                {ITEM_TYPE_FILTERS.map((f) => (
                  <li key={f.value || 'all'}>
                    <button
                      type="button"
                      className={type === f.value ? 'is-active' : ''}
                      onClick={() => setType(f.value)}
                    >
                      {f.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <section className="ep-main-list">
          <div className="ep-list-toolbar">
            <div className="ep-list-toolbar__left">
              <input type="checkbox" disabled aria-label="Select all" />
              <span>
                {loading
                  ? 'Loading…'
                  : total > 0
                    ? `${rangeStart}-${rangeEnd} of ${total.toLocaleString()}`
                    : '0 items'}
              </span>
            </div>
            <div className="ep-list-toolbar__right">
              <label className="ep-page-size">
                <span>Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="ep-chip is-active">
                <LayoutGrid size={14} />
                Table
              </button>
              <button type="button" className="ep-chip">
                Date modified
                <ChevronDown size={14} />
              </button>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          {loading && items.length === 0 ? (
            <div className="ep-spinner-wrap">
              <div className="ep-spinner" />
            </div>
          ) : (
            <>
              <table className="ep-table">
                <thead>
                  <tr>
                    <th className="ep-table__check" />
                    <th>Title</th>
                    <th className="ep-table__sort">Modified</th>
                    {showOwner && <th>Owner</th>}
                    <th className="ep-table__actions" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id || item.title}>
                      <td>
                        <input type="checkbox" aria-label={`Select ${item.title || 'item'}`} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ep-item-title"
                          onClick={() => onOpenItem(item)}
                        >
                          {item.title || '(untitled)'}
                        </button>
                        <div className="ep-item-type">
                          <span className={`type-icon ${typeIconClass(item.type || '')}`} />
                          {itemTypeLabel(item.type || 'Item')}
                        </div>
                      </td>
                      <td>{formatPortalDate(item.modified)}</td>
                      {showOwner && <td>{item.owner || '—'}</td>}
                      <td className="ep-row-actions">
                        {(item.type === 'Web Map' || item.type === 'Web Scene') && onOpenMap && (
                          <button
                            type="button"
                            className="ep-btn ep-btn--ghost-sm"
                            onClick={() => onOpenMap(item)}
                          >
                            Preview
                          </button>
                        )}
                        <button type="button" className="ep-icon-btn" aria-label="More" disabled>
                          <MoreHorizontal size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loading && items.length === 0 && (
                    <tr>
                      <td colSpan={showOwner ? 5 : 4} className="ep-empty">
                        No items found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {total > 0 && (
                <nav className="ep-pagination" aria-label="Pagination">
                  <button
                    type="button"
                    className="ep-page-btn"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {pageNumbers(page, totalPages).map((p, idx) =>
                    p === '…' ? (
                      <span key={`e-${idx}`} className="ep-page-ellipsis">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        className={`ep-page-btn ${page === p ? 'is-active' : ''}`}
                        onClick={() => setPage(p)}
                        disabled={loading}
                      >
                        {p}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    className="ep-page-btn"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Next page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
