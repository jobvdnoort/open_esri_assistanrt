import { Bell, Grid3x3, LogOut, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import { initials } from './format'

export type PortalSection = 'home' | 'map' | 'groups' | 'content' | 'organization'

interface PortalChromeProps {
  section: PortalSection
  onNavigate: (section: PortalSection) => void
  title: string
  tabs?: { id: string; label: string }[]
  activeTab?: string
  onTabChange?: (id: string) => void
  children: ReactNode
  /** Full-bleed pages (Map Viewer) skip the blue subhead + main padding */
  bare?: boolean
}

export function PortalChrome({
  section,
  onNavigate,
  title,
  tabs,
  activeTab,
  onTabChange,
  children,
  bare,
}: PortalChromeProps) {
  const { portal, mode, signOut } = useAuth()
  const displayName = portal?.user?.fullName || portal?.user?.username || 'Gebruiker'
  const username = portal?.user?.username || ''

  return (
    <div className={`ep ${bare ? 'ep--bare' : ''}`}>
      <header className="ep-topnav">
        <nav className="ep-topnav__links" aria-label="Hoofdnavigatie">
          {(
            [
              ['home', 'Home'],
              ['map', 'Map'],
              ['groups', 'Groups'],
              ['content', 'Content'],
              ['organization', 'Organization'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={section === id ? 'is-active' : ''}
              onClick={() => onNavigate(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="ep-topnav__right">
          <button type="button" className="ep-icon-btn" aria-label="Search" disabled>
            <Search size={18} />
          </button>
          <button type="button" className="ep-icon-btn" aria-label="Notifications" disabled>
            <Bell size={18} />
          </button>
          <button type="button" className="ep-icon-btn" aria-label="Apps" disabled>
            <Grid3x3 size={18} />
          </button>
          <div className="ep-user">
            <span className="ep-avatar" aria-hidden>
              {initials(displayName)}
            </span>
            <div className="ep-user__text">
              <strong>
                {displayName}
                {mode === 'demo' ? ' (Demo)' : ''}
              </strong>
              {username && <span>{username}</span>}
            </div>
            <button type="button" className="ep-icon-btn" onClick={signOut} aria-label="Sign out" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {!bare && (
        <div className="ep-subhead">
          <h1>{title}</h1>
          {tabs && tabs.length > 0 && (
            <div className="ep-subhead__tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={activeTab === tab.id ? 'is-active' : ''}
                  onClick={() => onTabChange?.(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={bare ? 'ep-body ep-body--bare' : 'ep-body'}>{children}</div>
    </div>
  )
}
