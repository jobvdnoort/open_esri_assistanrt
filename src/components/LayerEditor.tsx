import { useEffect, useState } from 'react'
import type { OperationalLayer } from '../types/arcgis'
import { isGroupLayer } from '../lib/webmap'
import { JsonViewer } from './JsonViewer'

interface LayerEditorProps {
  layer: OperationalLayer | null
  onChange: (next: OperationalLayer) => void
}

type Tab = 'general' | 'query' | 'popup' | 'style'

/**
 * Lightweight per-layer editor for title, visibility, definition query,
 * popup title/fields, and drawingInfo JSON — without requiring raw webmap surgery.
 */
export function LayerEditor({ layer, onChange }: LayerEditorProps) {
  const [tab, setTab] = useState<Tab>('general')
  const [popupJson, setPopupJson] = useState('')
  const [styleJson, setStyleJson] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)

  useEffect(() => {
    if (!layer) return
    setPopupJson(JSON.stringify(layer.popupInfo ?? {}, null, 2))
    setStyleJson(JSON.stringify(layer.drawingInfo ?? {}, null, 2))
    setJsonError(null)
  }, [layer])

  if (!layer) {
    return (
      <div className="layer-editor layer-editor--empty">
        <p className="muted">Selecteer een laag of groep om eigenschappen te bewerken.</p>
      </div>
    )
  }

  const group = isGroupLayer(layer)
  const definitionExpression =
    typeof layer.layerDefinition === 'object' && layer.layerDefinition
      ? String((layer.layerDefinition as { definitionExpression?: string }).definitionExpression ?? '')
      : typeof layer.definitionExpression === 'string'
        ? layer.definitionExpression
        : ''

  const patch = (partial: Partial<OperationalLayer>) => {
    onChange({ ...layer, ...partial })
  }

  const applyPopupJson = () => {
    try {
      const parsed = JSON.parse(popupJson || '{}') as unknown
      patch({ popupInfo: parsed })
      setJsonError(null)
    } catch {
      setJsonError('Popup JSON is ongeldig.')
    }
  }

  const applyStyleJson = () => {
    try {
      const parsed = JSON.parse(styleJson || '{}') as unknown
      patch({ drawingInfo: parsed })
      setJsonError(null)
    } catch {
      setJsonError('Style JSON is ongeldig.')
    }
  }

  return (
    <div className="layer-editor">
      <header className="layer-editor__head">
        <div>
          <h3>{layer.title || layer.id || 'Laag'}</h3>
          <p className="muted">{layer.layerType || (group ? 'GroupLayer' : 'Laag')}</p>
        </div>
      </header>

      <div className="tabs layer-editor__tabs">
        {(
          [
            ['general', 'Algemeen'],
            ['query', 'Query'],
            ['popup', 'Popup'],
            ['style', 'Styling'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tabs__btn ${tab === id ? 'is-active' : ''}`}
            onClick={() => setTab(id)}
            disabled={group && (id === 'query' || id === 'popup' || id === 'style')}
          >
            {label}
          </button>
        ))}
      </div>

      {jsonError && <p className="form-error">{jsonError}</p>}

      {tab === 'general' && (
        <div className="layer-editor__form">
          <label>
            Titel
            <input
              value={String(layer.title ?? '')}
              onChange={(e) => patch({ title: e.target.value })}
            />
          </label>
          <label className="layer-editor__check">
            <input
              type="checkbox"
              checked={layer.visibility !== false}
              onChange={(e) => patch({ visibility: e.target.checked })}
            />
            Zichtbaar
          </label>
          <label>
            Opacity (0–1)
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={typeof layer.opacity === 'number' ? layer.opacity : 1}
              onChange={(e) => patch({ opacity: Number(e.target.value) })}
            />
          </label>
          {typeof layer.url === 'string' && (
            <label>
              URL
              <input value={layer.url} readOnly />
            </label>
          )}
        </div>
      )}

      {tab === 'query' && !group && (
        <div className="layer-editor__form">
          <label>
            Definition expression
            <textarea
              rows={4}
              value={definitionExpression}
              placeholder={`bijv. STATUS = 'Actief'`}
              onChange={(e) => {
                const value = e.target.value
                const layerDefinition =
                  typeof layer.layerDefinition === 'object' && layer.layerDefinition
                    ? { ...(layer.layerDefinition as object), definitionExpression: value }
                    : { definitionExpression: value }
                patch({ layerDefinition, definitionExpression: value })
              }}
            />
          </label>
          <p className="muted">
            Filtert features in de webmap. Leeg = geen filter. Werkt het beste op feature layers.
          </p>
        </div>
      )}

      {tab === 'popup' && !group && (
        <div className="layer-editor__form">
          <label>
            Popup titel
            <input
              value={
                typeof layer.popupInfo === 'object' && layer.popupInfo
                  ? String((layer.popupInfo as { title?: string }).title ?? '')
                  : ''
              }
              onChange={(e) => {
                const popupInfo = {
                  ...((typeof layer.popupInfo === 'object' && layer.popupInfo) || {}),
                  title: e.target.value,
                }
                patch({ popupInfo })
              }}
            />
          </label>
          <label>
            popupInfo JSON
            <textarea rows={10} value={popupJson} onChange={(e) => setPopupJson(e.target.value)} />
          </label>
          <button type="button" className="btn btn--secondary btn--sm" onClick={applyPopupJson}>
            Popup JSON toepassen
          </button>
        </div>
      )}

      {tab === 'style' && !group && (
        <div className="layer-editor__form">
          <p className="muted">
            Bewerk <code>drawingInfo</code> (renderer/symbolen). Geavanceerd — valideer met preview.
          </p>
          <label>
            drawingInfo JSON
            <textarea rows={12} value={styleJson} onChange={(e) => setStyleJson(e.target.value)} />
          </label>
          <button type="button" className="btn btn--secondary btn--sm" onClick={applyStyleJson}>
            Styling JSON toepassen
          </button>
          {layer.drawingInfo != null && (
            <JsonViewer value={layer.drawingInfo} label="Huidige drawingInfo" />
          )}
        </div>
      )}
    </div>
  )
}
