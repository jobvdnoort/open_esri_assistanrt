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

  const userLabel = portal?.user?.fullName || portal?.user?.username || 'Gebruiker'

  return (
    <div className="shell">
      <header className="topnav">
        <div className="topnav__brand">
          <MapPinned size={20} strokeWidth={1.8} />
          <strong>Open Esri Assistant</strong>
          <span className="topnav__org">{portal?.name ?? 'Portaal'}</span>
        </div>
        <nav className="topnav__links">
          <button
            type="button"
            className={view.name === 'browser' || view.name === 'item' ? 'is-active' : ''}
            onClick={() => setView({ name: 'browser' })}
          >
            <FolderOpen size={15} />
            Content
          </button>
          <button
            type="button"
            className={view.name === 'compare' ? 'is-active' : ''}
            onClick={() => setView({ name: 'compare' })}
          >
            <ArrowRightLeft size={15} />
            Compare
          </button>
        </nav>
        <div className="topnav__user">
          {mode === 'demo' && <span className="demo-badge">Demo</span>}
          <span>{userLabel}</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={signOut}>
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </header>

      <div className="subhead">
        <h1>
          {view.name === 'compare'
            ? 'Compare webmaps'
            : view.name === 'item'
              ? 'Item'
              : 'Content'}
        </h1>
        <p>
          {view.name === 'compare'
            ? 'Sleep lagen tussen webmaps, bewerk popups/queries, preview en undo.'
            : 'Blader door items, open JSON, of selecteer webmaps om te vergelijken.'}
        </p>
      </div>

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
