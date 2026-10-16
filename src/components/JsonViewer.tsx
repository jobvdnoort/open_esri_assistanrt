import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

interface JsonViewerProps {
  value: unknown
  label?: string
}

export function JsonViewer({ value, label }: JsonViewerProps) {
  const [copied, setCopied] = useState(false)
  const text = JSON.stringify(value, null, 2) ?? 'null'

  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="json-viewer">
      <div className="json-viewer__bar">
        <span>{label ?? 'JSON'}</span>
        <button type="button" className="btn btn--ghost btn--sm" onClick={copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Gekopieerd' : 'Kopieer'}
        </button>
      </div>
      <pre className="json-viewer__pre">{text}</pre>
    </div>
  )
}
