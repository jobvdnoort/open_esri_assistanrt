import { ChevronDown, LoaderCircle, Search, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import type { PortalItem } from '../types/arcgis'

interface ItemPickerProps {
  value: string
  label?: string
  placeholder?: string
  itemTypes?: string[]
  onChange: (itemId: string, item?: PortalItem | null) => void
}

/**
 * Fast searchable picker — queries the portal only after typing (debounced).
 * Never loads the full content catalog into a <select>.
 */
export function ItemPicker({
  value,
  label = 'Item',
  placeholder = 'Zoek op titel…',
  itemTypes = ['Web Map'],
  onChange,
}: ItemPickerProps) {
  const { browseContent, getItem, mode } = useAuth()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PortalItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTitle, setSelectedTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!value) {
      setSelectedTitle('')
      return
    }
    let cancelled = false
    void getItem(value)
      .then((item) => {
        if (!cancelled) setSelectedTitle(item.title)
      })
      .catch(() => {
        if (!cancelled) setSelectedTitle(value)
      })
    return () => {
      cancelled = true
    }
  }, [value, getItem])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handle = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        setError(null)
        try {
          const type = itemTypes.length === 1 ? itemTypes[0] : undefined
          // Prefer org search so users find shared maps; mine first for empty query in demo
          const scope = mode === 'demo' || !query.trim() ? 'mine' : 'org'
          const primary = await browseContent({
            scope,
            query: query.trim() || undefined,
            type,
          })
          let items = primary.results
          if (items.length < 8 && scope === 'mine' && mode !== 'demo') {
            const org = await browseContent({
              scope: 'org',
              query: query.trim() || undefined,
              type,
            })
            const seen = new Set(items.map((i) => i.id))
            items = [...items, ...org.results.filter((i) => !seen.has(i.id))]
          }
          if (itemTypes.length > 1) {
            items = items.filter((i) => itemTypes.includes(i.type))
          }
          setResults(items.slice(0, 40))
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Zoeken mislukt')
          setResults([])
        } finally {
          setLoading(false)
        }
      })()
    }, query.trim() ? 220 : 0)
    return () => window.clearTimeout(handle)
  }, [open, query, browseContent, itemTypes, mode])

  return (
    <div className="item-picker" ref={rootRef}>
      {label && <span className="item-picker__label">{label}</span>}
      <button
        type="button"
        className="item-picker__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={selectedTitle ? '' : 'is-placeholder'}>
          {selectedTitle || placeholder}
        </span>
        <ChevronDown size={16} />
      </button>

      {value && (
        <button
          type="button"
          className="item-picker__clear"
          title="Wis selectie"
          onClick={() => onChange('', null)}
        >
          <X size={14} />
        </button>
      )}

      {open && (
        <div className="item-picker__menu" id={listId} role="listbox">
          <label className="item-picker__search">
            <Search size={14} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
            />
            {loading && <LoaderCircle size={14} className="spin" />}
          </label>
          {error && <p className="form-error item-picker__error">{error}</p>}
          <ul className="item-picker__list">
            {results.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={item.id === value}
                  className={item.id === value ? 'is-selected' : ''}
                  onClick={() => {
                    onChange(item.id, item)
                    setSelectedTitle(item.title)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <strong>{item.title}</strong>
                  <span>
                    {item.type}
                    {item.owner ? ` · ${item.owner}` : ''}
                  </span>
                </button>
              </li>
            ))}
            {!loading && results.length === 0 && (
              <li className="item-picker__empty">Geen resultaten — typ om te zoeken</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
