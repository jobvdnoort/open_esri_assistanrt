import {
  ChevronDown,
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

  const scope: ContentScope =
    tab === 'mine' ? 'mine' : tab === 'favorites' ? 'favorites' : tab === 'org' ? 'org' : 'groups'

  useEffect(() => {
    setQuery('')
    setType('')
    setFolderKey('all')
    setActiveGroupId('all')
  }, [tab])

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
    try {
      if (tab === 'groups') {
        let groupList = groups
        if (groupList.length === 0) {
          groupList = await listGroups()
          setGroups(groupList)
        }
        if (activeGroupId === 'all') {
          const all: PortalItem[] = []
          for (const group of groupList.slice(0, 3)) {
            const r = await browseGroupItems(group.id, {
              query: query || undefined,
              type: type || undefined,
            })
            all.push(...(Array.isArray(r.results) ? r.results.slice(0, 40) : []))
          }
          setItems(all.filter(Boolean))
          setTotal(all.length)
          return
        }
        const result = await browseGroupItems(activeGroupId, {
          query: query || undefined,
          type: type || undefined,
        })
        setItems(Array.isArray(result.results) ? result.results.filter(Boolean) : [])
        setTotal(typeof result.total === 'number' ? result.total : 0)
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
                    ? `1-${Math.min(items.length, total)} of ${total.toLocaleString()}`
                    : '0 items'}
              </span>
            </div>
            <div className="ep-list-toolbar__right">
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
          )}
        </section>
      </div>
    </div>
  )
}
