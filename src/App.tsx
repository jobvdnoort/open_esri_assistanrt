import { lazy, Suspense, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LoginPage } from './components/LoginPage'
import { PortalChrome, type PortalSection } from './components/portal/PortalChrome'
import {
  CONTENT_TABS,
  GROUPS_TABS,
  ORG_TABS,
  type ContentTab,
  type GroupsTab,
  type OrgTab,
} from './components/portal/tabs'
import { useAuth } from './context/AuthContext'
import type { PortalItem } from './types/arcgis'
import './App.css'
import './portal.css'

const ContentPage = lazy(() =>
  import('./components/portal/ContentPage').then((m) => ({ default: m.ContentPage })),
)
const GroupsPage = lazy(() =>
  import('./components/portal/GroupsPage').then((m) => ({ default: m.GroupsPage })),
)
const OrganizationPage = lazy(() =>
  import('./components/portal/OrganizationPage').then((m) => ({ default: m.OrganizationPage })),
)
const MapViewerPage = lazy(() =>
  import('./components/portal/MapViewerPage').then((m) => ({ default: m.MapViewerPage })),
)
const ItemDetailsPage = lazy(() =>
  import('./components/portal/ItemDetailsPage').then((m) => ({ default: m.ItemDetailsPage })),
)

type View =
  | { name: 'home' }
  | { name: 'content'; tab: ContentTab }
  | { name: 'groups'; tab: GroupsTab }
  | { name: 'organization'; tab: OrgTab }
  | { name: 'map'; itemId?: string }
  | { name: 'item'; itemId: string }

function ViewFallback() {
  return (
    <div className="ep-spinner-wrap">
      <div className="ep-spinner" />
    </div>
  )
}

export default function App() {
  const { mode, portal, loading, error } = useAuth()
  const [view, setView] = useState<View>({ name: 'content', tab: 'mine' })

  if (loading && !mode) {
    return (
      <div className="boot">
        <p>Sessie laden…</p>
      </div>
    )
  }

  if (!mode) {
    return (
      <>
        {error && (
          <div className="boot-banner">
            <p className="form-error">{error}</p>
          </div>
        )}
        <LoginPage />
      </>
    )
  }

  const navigate = (next: PortalSection) => {
    if (next === 'home') setView({ name: 'home' })
    else if (next === 'map') setView({ name: 'map' })
    else if (next === 'groups') setView({ name: 'groups', tab: 'mine' })
    else if (next === 'content') setView({ name: 'content', tab: 'mine' })
    else if (next === 'organization') setView({ name: 'organization', tab: 'overview' })
  }

  const openItem = (item: PortalItem) => setView({ name: 'item', itemId: item.id })
  const openMap = (_item?: PortalItem) => setView({ name: 'map' })

  if (view.name === 'map') {
    // Full Map Viewer chrome (no portal Content/Groups topnav) — Untitled map by default.
    return (
      <ErrorBoundary label="Map">
        <Suspense fallback={<ViewFallback />}>
          <MapViewerPage onLeave={() => setView({ name: 'content', tab: 'mine' })} />
        </Suspense>
      </ErrorBoundary>
    )
  }

  if (view.name === 'home') {
    return (
      <PortalChrome section="home" onNavigate={navigate} title={portal?.name || 'Home'}>
        <div className="ep-home">
          <h2>Welcome</h2>
          <p className="muted">
            Home is voorlopig een eenvoudige landingspagina. Pas deze later aan, of gebruik Content /
            Map / Groups / Organization zoals in het Enterprise-portaal.
          </p>
          <div className="ep-home__actions">
            <button
              type="button"
              className="ep-btn ep-btn--primary"
              onClick={() => setView({ name: 'content', tab: 'mine' })}
            >
              Go to Content
            </button>
            <button type="button" className="ep-btn ep-btn--outline" onClick={() => openMap()}>
              Open Map Viewer
            </button>
          </div>
        </div>
      </PortalChrome>
    )
  }

  if (view.name === 'item') {
    return (
      <PortalChrome section="content" onNavigate={navigate} title="Content" bare>
        <ErrorBoundary label="Item">
          <Suspense fallback={<ViewFallback />}>
            <ItemDetailsPage
              itemId={view.itemId}
              onBack={() => setView({ name: 'content', tab: 'mine' })}
              onOpenMap={() => openMap()}
            />
          </Suspense>
        </ErrorBoundary>
      </PortalChrome>
    )
  }

  if (view.name === 'groups') {
    return (
      <PortalChrome
        section="groups"
        onNavigate={navigate}
        title="Groups"
        tabs={[...GROUPS_TABS]}
        activeTab={view.tab}
        onTabChange={(id) => setView({ name: 'groups', tab: id as GroupsTab })}
      >
        <ErrorBoundary label="Groups">
          <Suspense fallback={<ViewFallback />}>
            <GroupsPage
              tab={view.tab}
              onOpenGroupContent={() => setView({ name: 'content', tab: 'groups' })}
            />
          </Suspense>
        </ErrorBoundary>
      </PortalChrome>
    )
  }

  if (view.name === 'organization') {
    return (
      <PortalChrome
        section="organization"
        onNavigate={navigate}
        title={portal?.name || 'Organization'}
        tabs={[...ORG_TABS]}
        activeTab={view.tab}
        onTabChange={(id) => setView({ name: 'organization', tab: id as OrgTab })}
      >
        <ErrorBoundary label="Organization">
          <Suspense fallback={<ViewFallback />}>
            <OrganizationPage
              tab={view.tab}
              onOpenItem={openItem}
              onViewAllContent={() => setView({ name: 'content', tab: 'org' })}
            />
          </Suspense>
        </ErrorBoundary>
      </PortalChrome>
    )
  }

  // content
  return (
    <PortalChrome
      section="content"
      onNavigate={navigate}
      title="Content"
      tabs={[...CONTENT_TABS]}
      activeTab={view.tab}
      onTabChange={(id) => setView({ name: 'content', tab: id as ContentTab })}
    >
      <ErrorBoundary label="Content">
        <Suspense fallback={<ViewFallback />}>
          <ContentPage tab={view.tab} onOpenItem={openItem} onOpenMap={() => openMap()} />
        </Suspense>
      </ErrorBoundary>
    </PortalChrome>
  )
}
