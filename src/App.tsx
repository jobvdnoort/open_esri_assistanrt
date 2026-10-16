import { ArrowRightLeft, FolderOpen, LogOut, MapPinned } from 'lucide-react'
import { useState } from 'react'
import { ItemDetail } from './components/ItemDetail'
import { LoginPage } from './components/LoginPage'
import { PortalBrowser } from './components/PortalBrowser'
import { WebmapCompare } from './components/WebmapCompare'
import { useAuth } from './context/AuthContext'
import type { PortalItem } from './types/arcgis'
import './App.css'

type View =
  | { name: 'browser' }
  | { name: 'item'; itemId: string }
  | { name: 'compare'; leftId?: string; rightId?: string }

export default function App() {
  const { mode, portal, loading, signOut } = useAuth()
  const [view, setView] = useState<View>({ name: 'browser' })

  if (loading && !mode) {
    return (
      <div className="boot">
        <MapPinned size={28} />
        <p>Sessie laden…</p>
      </div>
    )
  }

  if (!mode) {
    return <LoginPage />
  }

  return (
    <div className="shell">
      <aside className="shell__nav">
        <div className="shell__brand">
          <MapPinned size={22} strokeWidth={1.7} />
          <div>
            <strong>Open Esri Assistant</strong>
            <span>{portal?.name ?? 'Portaal'}</span>
          </div>
        </div>

        <nav className="shell__links">
          <button
            type="button"
            className={view.name === 'browser' || view.name === 'item' ? 'is-active' : ''}
            onClick={() => setView({ name: 'browser' })}
          >
            <FolderOpen size={16} />
            Inhoud
          </button>
          <button
            type="button"
            className={view.name === 'compare' ? 'is-active' : ''}
            onClick={() => setView({ name: 'compare' })}
          >
            <ArrowRightLeft size={16} />
            Vergelijk
          </button>
        </nav>

        <div className="shell__user">
          {mode === 'demo' && <span className="demo-badge">Demo</span>}
          <span>{portal?.user?.fullName || portal?.user?.username || 'Gebruiker'}</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={signOut}>
            <LogOut size={14} />
            Uitloggen
          </button>
        </div>
      </aside>

      <main className="shell__main">
        {view.name === 'browser' && (
          <PortalBrowser
            onOpenItem={(item: PortalItem) => setView({ name: 'item', itemId: item.id })}
            onCompareMaps={(leftId, rightId) =>
              setView({ name: 'compare', leftId, rightId })
            }
          />
        )}
        {view.name === 'item' && (
          <ItemDetail
            itemId={view.itemId}
            onBack={() => setView({ name: 'browser' })}
            onCompare={(id) => setView({ name: 'compare', leftId: id })}
          />
        )}
        {view.name === 'compare' && (
          <WebmapCompare
            initialLeftId={view.leftId}
            initialRightId={view.rightId}
            onBack={() => setView({ name: 'browser' })}
          />
        )}
      </main>
    </div>
  )
}
