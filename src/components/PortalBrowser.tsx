import { ArrowRightLeft, FileJson, FolderOpen, RefreshCw, Search, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import type { ContentScope, PortalGroup } from '../lib/content'
import type { PortalItem } from '../types/arcgis'

interface PortalBrowserProps {
  onOpenItem: (item: PortalItem) => void
  onCompareMaps: (leftId?: string, rightId?: string) => void
}

const TYPE_FILTERS = [
  { value: '', label: 'Alle types' },
  { value: 'Web Map', label: 'Web Maps' },
  { value: 'Web Scene', label: 'Web Scenes' },
  { value: 'Feature Service', label: 'Feature Services' },
  { value: 'Dashboard', label: 'Dashboards' },
  { value: 'Web Mapping Application', label: 'Apps' },
]

function formatDate(ms?: number) {
  if (!ms) return '—'
  return new Date(ms).toLocaleString('nl-NL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function PortalBrowser({ onOpenItem, onCompareMaps }: PortalBrowserProps) {
  const { browseContent, listGroups, browseGroupItems, mode, portal } = useAuth()
  const [scope, setScope] = useState<ContentScope>('mine')
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [items, setItems] = useState<PortalItem[]>([])
  const [groups, setGroups] = useState<PortalGroup[]>([])
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [queryUsed, setQueryUsed] = useState('')
  const [username, setUsername] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (scope === 'groups' && !activeGroupId) {
        const g = await listGroups()
        setGroups(g)
        setItems([])
        setTotal(g.length)
        setQueryUsed('community/self groups')
        return
      }

      if (scope === 'groups' && activeGroupId) {
        const result = await browseGroupItems(activeGroupId, {
          query: query || undefined,
          type: type || undefined,
        })
        setItems(result.results)
        setTotal(result.total)
        setQueryUsed(result.queryUsed)
        setUsername(result.username)
        return
      }

      const result = await browseContent({
        scope,
        query: query || undefined,
        type: type || undefined,
      })
      setItems(result.results)
      setTotal(result.total)
      setQueryUsed(result.queryUsed)
      setUsername(result.username)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laden mislukt')
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [scope, activeGroupId, query, type, browseContent, listGroups, browseGroupItems])

  useEffect(() => {
    void load()
  }, [load])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else {
        if (next.size >= 2) {
          const first = next.values().next().value as string
          next.delete(first)
        }
        next.add(id)
      }
      return next
    })
  }

  const selectedWebMaps = items.filter((i) => selected.has(i.id) && i.type === 'Web Map')
  const showingGroupList = scope === 'groups' && !activeGroupId

  return (
    <div className="browser">
      <header className="browser__header">
        <div>
          <h2>Portaalinhoud</h2>
          <p className="muted">
            Zoek items, open JSON, of selecteer twee webmaps om te vergelijken.
            {username ? ` Ingelogd als ${username}.` : ''}
            {portal?.name ? ` · ${portal.name}` : ''}
          </p>
        </div>
        <div className="browser__actions">
          <button
            type="button"
            className="btn btn--secondary"
            disabled={selectedWebMaps.length === 0}
            onClick={() => onCompareMaps(selectedWebMaps[0]?.id, selectedWebMaps[1]?.id)}
          >
            <ArrowRightLeft size={16} />
            Vergelijk webmaps
            {selectedWebMaps.length > 0 ? ` (${selectedWebMaps.length})` : ''}
          </button>
        </div>
      </header>

      <div className="tabs browser__scopes">
        <button
          type="button"
          className={`tabs__btn ${scope === 'mine' ? 'is-active' : ''}`}
          onClick={() => {
            setScope('mine')
            setActiveGroupId(null)
          }}
        >
          <FolderOpen size={14} />
          Mijn content
        </button>
        <button
          type="button"
          className={`tabs__btn ${scope === 'org' ? 'is-active' : ''}`}
          onClick={() => {
            setScope('org')
            setActiveGroupId(null)
          }}
        >
          Organisatie
        </button>
        <button
          type="button"
          className={`tabs__btn ${scope === 'groups' ? 'is-active' : ''}`}
          onClick={() => {
            setScope('groups')
            setActiveGroupId(null)
          }}
        >
          <Users size={14} />
          Groepen
        </button>
      </div>

      <form
        className="browser__filters"
        onSubmit={(e) => {
          e.preventDefault()
          void load()
        }}
      >
        <label className="search-field">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === 'demo'
                ? 'Zoek in demodata…'
                : showingGroupList
                  ? 'Filter groepen…'
                  : scope === 'mine'
                    ? 'Filter in mijn content…'
                    : 'Zoek in organisatie…'
            }
            disabled={showingGroupList}
          />
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          disabled={showingGroupList}
        >
          {TYPE_FILTERS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn--primary" disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : undefined} />
          Vernieuwen
        </button>
      </form>

      {activeGroupId && (
        <div className="browser__crumb">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setActiveGroupId(null)}
          >
            ← Alle groepen
          </button>
          <span className="muted">
            {groups.find((g) => g.id === activeGroupId)?.title ?? activeGroupId}
          </span>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="browser__meta">
        <span>
          {loading
            ? 'Laden…'
            : showingGroupList
              ? `${total} groep${total === 1 ? '' : 'en'}`
              : `${total} resultaat${total === 1 ? '' : 'en'}`}
        </span>
        {queryUsed && <span className="muted browser__query" title={queryUsed}>{queryUsed}</span>}
      </div>

      {showingGroupList ? (
        <div className="item-table">
          <div className="item-table__head item-table__head--groups">
            <span>Groep</span>
            <span>Owner</span>
            <span>Toegang</span>
            <span />
          </div>
          {groups
            .filter((g) => {
              const q = query.trim().toLowerCase()
              if (!q) return true
              return (
                g.title.toLowerCase().includes(q) ||
                g.owner.toLowerCase().includes(q) ||
                (g.snippet ?? '').toLowerCase().includes(q)
              )
            })
            .map((group) => (
              <div key={group.id} className="item-table__row item-table__row--groups">
                <button
                  type="button"
                  className="item-table__title"
                  onClick={() => setActiveGroupId(group.id)}
                >
                  <strong>{group.title}</strong>
                  <span className="muted">{group.snippet || group.id}</span>
                </button>
                <span className="muted">{group.owner}</span>
                <span className="type-pill">{group.access || '—'}</span>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setActiveGroupId(group.id)}
                >
                  Open
                </button>
              </div>
            ))}
          {!loading && groups.length === 0 && (
            <p className="muted empty-panel">Geen groepen gevonden voor deze gebruiker.</p>
          )}
        </div>
      ) : (
        <div className="item-table">
          <div className="item-table__head">
            <span />
            <span>Titel</span>
            <span>Type</span>
            <span>Gewijzigd</span>
            <span />
          </div>
          {items.map((item) => (
            <div key={item.id} className="item-table__row">
              <label className="item-check">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  disabled={item.type !== 'Web Map'}
                  onChange={() => toggleSelect(item.id)}
                  title={item.type === 'Web Map' ? 'Selecteer voor vergelijken' : 'Alleen webmaps'}
                />
              </label>
              <button type="button" className="item-table__title" onClick={() => onOpenItem(item)}>
                <strong>{item.title}</strong>
                <span className="muted">
                  {item.owner ? `${item.owner} · ` : ''}
                  {item.snippet || item.id}
                </span>
              </button>
              <span className="type-pill">{item.type}</span>
              <span className="muted">{formatDate(item.modified)}</span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => onOpenItem(item)}>
                <FileJson size={14} />
                Open
              </button>
            </div>
          ))}
          {!loading && items.length === 0 && (
            <p className="muted empty-panel">
              Geen items gevonden.
              {scope === 'mine'
                ? ' Probeer tabblad Organisatie of Groepen — content staat soms niet onder jouw owner.'
                : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
