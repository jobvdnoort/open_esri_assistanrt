import { ArrowRightLeft, FileJson, RefreshCw, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
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

function formatDate(ms: number) {
  return new Date(ms).toLocaleString('nl-NL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function PortalBrowser({ onOpenItem, onCompareMaps }: PortalBrowserProps) {
  const { searchItems, mode } = useAuth()
  const [query, setQuery] = useState('')
  const [type, setType] = useState(mode === 'demo' ? 'Web Map' : '')
  const [items, setItems] = useState<PortalItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const load = async (q = query, t = type) => {
    setLoading(true)
    setError(null)
    try {
      const result = await searchItems(q, t || undefined)
      setItems(result.results)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zoeken mislukt')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  return (
    <div className="browser">
      <header className="browser__header">
        <div>
          <h2>Portaalinhoud</h2>
          <p className="muted">Zoek items, open JSON, of selecteer twee webmaps om te vergelijken.</p>
        </div>
        <div className="browser__actions">
          <button
            type="button"
            className="btn btn--secondary"
            disabled={selectedWebMaps.length === 0}
            onClick={() =>
              onCompareMaps(selectedWebMaps[0]?.id, selectedWebMaps[1]?.id)
            }
          >
            <ArrowRightLeft size={16} />
            Vergelijk webmaps
            {selectedWebMaps.length > 0 ? ` (${selectedWebMaps.length})` : ''}
          </button>
        </div>
      </header>

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
            placeholder={mode === 'demo' ? 'Zoek in demodata…' : 'Zoek in je content (leeg = owner:me)'}
          />
        </label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {TYPE_FILTERS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn--primary" disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : undefined} />
          Zoeken
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}

      <div className="browser__meta">
        <span>
          {loading ? 'Laden…' : `${total} resultaat${total === 1 ? '' : 'en'}`}
        </span>
        {selected.size > 0 && (
          <span className="muted">{selected.size} geselecteerd voor vergelijken</span>
        )}
      </div>

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
              <span className="muted">{item.snippet || item.id}</span>
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
          <p className="muted empty-panel">Geen items gevonden.</p>
        )}
      </div>
    </div>
  )
}
