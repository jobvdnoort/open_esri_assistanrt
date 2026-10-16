import { ArcGISIdentityManager } from '@esri/arcgis-rest-request'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { formatAuthError } from '../lib/authErrors'
import type { ContentResult, ContentScope, PortalGroup } from '../lib/content'
import {
  beginPortalOAuth,
  completePortalOAuth,
  getPortalSelf,
  isOAuthCallbackUrl,
  loadOAuthPending,
  normalizePortalUrl,
  signInWithPassword,
  signInWithToken,
} from '../lib/portalAuth'
import type { PortalItem, PortalSelf, WebMapData } from '../types/arcgis'

const SESSION_KEY = 'oea-session'
const PREFS_KEY = 'oea-login-prefs'

type SessionMode = 'live' | 'demo'

interface StoredSession {
  mode: SessionMode
  serializedAuth?: string
}

export interface LoginPrefs {
  portalUrl: string
  clientId: string
}

interface AuthContextValue {
  mode: SessionMode | null
  auth: ArcGISIdentityManager | null
  portal: PortalSelf | null
  portalUrl: string
  loading: boolean
  error: string | null
  loginPrefs: LoginPrefs
  saveLoginPrefs: (prefs: Partial<LoginPrefs>) => void
  signIn: (portalUrl: string, username: string, password: string) => Promise<void>
  signInOAuth: (portalUrl: string, clientId: string) => Promise<void>
  signInToken: (portalUrl: string, token: string, username?: string) => Promise<void>
  enterDemo: () => void
  signOut: () => void
  browseContent: (options: {
    scope: ContentScope
    query?: string
    type?: string
  }) => Promise<ContentResult>
  listGroups: () => Promise<PortalGroup[]>
  browseGroupItems: (
    groupId: string,
    options?: { query?: string; type?: string },
  ) => Promise<ContentResult>
  /** Convenience: webmaps from my content, falling back to org search. */
  searchItems: (query: string, type?: string) => Promise<{ results: PortalItem[]; total: number }>
  getItem: (id: string) => Promise<PortalItem>
  getItemData: (id: string) => Promise<unknown>
  getWebMap: (id: string) => Promise<{ item: PortalItem; data: WebMapData }>
  saveWebMap: (id: string, data: WebMapData) => Promise<void>
  resetDemo: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadStored(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as StoredSession) : null
  } catch {
    return null
  }
}

function persist(session: StoredSession | null) {
  if (!session) {
    sessionStorage.removeItem(SESSION_KEY)
    return
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

function loadPrefs(): LoginPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) return JSON.parse(raw) as LoginPrefs
  } catch {
    /* ignore */
  }
  return {
    portalUrl: 'https://gisportal-test.boskalis.com/portal',
    clientId: '',
  }
}

function persistPrefs(prefs: LoginPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timeout na ${ms}ms`)), ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        window.clearTimeout(timer)
        reject(err)
      },
    )
  })
}

function needsBootRestore(): boolean {
  if (typeof window === 'undefined') return false
  if (isOAuthCallbackUrl() && loadOAuthPending()) return true
  const stored = loadStored()
  return Boolean(stored && (stored.mode === 'demo' || stored.serializedAuth))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SessionMode | null>(null)
  const [auth, setAuth] = useState<ArcGISIdentityManager | null>(null)
  const [portal, setPortal] = useState<PortalSelf | null>(null)
  const [portalUrl, setPortalUrl] = useState('https://www.arcgis.com/sharing/rest')
  // Only block the UI when we actually have a session/OAuth callback to restore.
  const [loading, setLoading] = useState(() => needsBootRestore())
  const [error, setError] = useState<string | null>(null)
  const [loginPrefs, setLoginPrefs] = useState<LoginPrefs>(() => loadPrefs())

  const applySession = useCallback(async (manager: ArcGISIdentityManager) => {
    const self = await withTimeout(getPortalSelf(manager), 8000, 'Portal self')
    setAuth(manager)
    setPortal(self)
    setMode('live')
    setPortalUrl(manager.portal)
    persist({
      mode: 'live',
      serializedAuth: manager.serialize(),
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      // Full-page OAuth return: exchange ?code= once (shared promise), then continue into the app.
      if (isOAuthCallbackUrl() && loadOAuthPending()) {
        setLoading(true)
        try {
          const manager = await withTimeout(completePortalOAuth(), 20000, 'OAuth')
          await applySession(manager)
        } catch (err) {
          if (!cancelled) {
            setError(formatAuthError(err))
            const clean = `${window.location.origin}${window.location.pathname}`
            window.history.replaceState(window.history.state, '', clean)
          }
        } finally {
          if (!cancelled) setLoading(false)
        }
        return
      }

      const stored = loadStored()
      if (!stored) {
        if (!cancelled) setLoading(false)
        return
      }
      if (stored.mode === 'demo') {
        try {
          const { DEMO_PORTAL } = await import('../lib/demo')
          if (!cancelled) {
            setMode('demo')
            setPortal(DEMO_PORTAL)
            setPortalUrl('demo://local')
            setLoading(false)
          }
        } catch {
          persist(null)
          if (!cancelled) {
            setLoading(false)
            setError('Demomodus kon niet geladen worden. Log opnieuw in.')
          }
        }
        return
      }
      if (stored.mode === 'live' && stored.serializedAuth) {
        setLoading(true)
        try {
          const manager = ArcGISIdentityManager.deserialize(stored.serializedAuth)
          if (cancelled) return
          // Show app shell quickly; validate token with a hard timeout.
          setAuth(manager)
          setMode('live')
          setPortalUrl(manager.portal)
          setLoading(false)
          const self = await withTimeout(getPortalSelf(manager), 6000, 'Portal self')
          if (!cancelled) setPortal(self)
        } catch {
          persist(null)
          if (!cancelled) {
            setAuth(null)
            setMode(null)
            setPortal(null)
            setLoading(false)
            setError('Sessie verlopen of portaal reageert niet. Log opnieuw in.')
          }
        }
        return
      }
      if (!cancelled) setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [applySession])

  const saveLoginPrefs = useCallback((partial: Partial<LoginPrefs>) => {
    setLoginPrefs((prev) => {
      const next = { ...prev, ...partial }
      persistPrefs(next)
      return next
    })
  }, [])

  const signIn = useCallback(
    async (portalInput: string, username: string, password: string) => {
      setLoading(true)
      setError(null)
      saveLoginPrefs({ portalUrl: portalInput })
      try {
        const manager = await signInWithPassword(portalInput, username, password)
        await applySession(manager)
      } catch (err) {
        const message = formatAuthError(err)
        setError(message)
        throw new Error(message)
      } finally {
        setLoading(false)
      }
    },
    [applySession, saveLoginPrefs],
  )

  const signInOAuth = useCallback(
    async (portalInput: string, clientId: string) => {
      setLoading(true)
      setError(null)
      saveLoginPrefs({ portalUrl: portalInput, clientId })
      try {
        // Navigates away to the portal; session is applied on return via completePortalOAuth.
        await beginPortalOAuth(portalInput, clientId)
      } catch (err) {
        const message = formatAuthError(err)
        setError(message)
        setLoading(false)
        throw new Error(message)
      }
    },
    [saveLoginPrefs],
  )

  const signInToken = useCallback(
    async (portalInput: string, token: string, username?: string) => {
      setLoading(true)
      setError(null)
      saveLoginPrefs({ portalUrl: portalInput })
      try {
        const manager = await signInWithToken(portalInput, token, username)
        await applySession(manager)
      } catch (err) {
        const message = formatAuthError(err)
        setError(message)
        throw new Error(message)
      } finally {
        setLoading(false)
      }
    },
    [applySession, saveLoginPrefs],
  )

  const enterDemo = useCallback(() => {
    void import('../lib/demo').then(({ DEMO_PORTAL, resetDemoData }) => {
      resetDemoData()
      setAuth(null)
      setPortal(DEMO_PORTAL)
      setMode('demo')
      setPortalUrl('demo://local')
      setError(null)
      persist({ mode: 'demo' })
    })
  }, [])

  const signOut = useCallback(() => {
    setAuth(null)
    setPortal(null)
    setMode(null)
    setError(null)
    persist(null)
  }, [])

  const browseContentFn = useCallback(
    async (options: { scope: ContentScope; query?: string; type?: string }) => {
      if (mode === 'demo') {
        const { demoSearch } = await import('../lib/demo')
        const result = demoSearch(options.query ?? '', options.type)
        return {
          results: result.results,
          total: result.total,
          queryUsed: `demo ${options.scope}`,
          username: 'demo.user',
        }
      }
      if (!auth) throw new Error('Niet ingelogd')
      const { searchPortalContent } = await import('../lib/content')
      return searchPortalContent(auth, portal, options)
    },
    [auth, mode, portal],
  )

  const listGroupsFn = useCallback(async () => {
    if (mode === 'demo') {
      return [
        {
          id: 'demo-group-1',
          title: 'Demo projectgroep',
          owner: 'demo.user',
          access: 'private',
          snippet: 'Voorbeeldgroep in demomodus',
          modified: Date.now(),
        },
      ] satisfies PortalGroup[]
    }
    if (!auth) throw new Error('Niet ingelogd')
    const { listUserGroups } = await import('../lib/content')
    return listUserGroups(auth)
  }, [auth, mode])

  const browseGroupItemsFn = useCallback(
    async (groupId: string, options?: { query?: string; type?: string }) => {
      if (mode === 'demo') {
        const { demoSearch } = await import('../lib/demo')
        const result = demoSearch(options?.query ?? '', options?.type)
        return {
          results: result.results,
          total: result.total,
          queryUsed: `demo group:${groupId}`,
        }
      }
      if (!auth) throw new Error('Niet ingelogd')
      const { searchGroupItems } = await import('../lib/content')
      return searchGroupItems(auth, groupId, options)
    },
    [auth, mode],
  )

  const searchItemsFn = useCallback(
    async (query: string, type?: string) => {
      const mine = await browseContentFn({ scope: 'mine', query, type })
      if (mine.results.length > 0 || mode === 'demo') {
        return { results: mine.results, total: mine.total }
      }
      const org = await browseContentFn({ scope: 'org', query, type })
      return { results: org.results, total: org.total }
    },
    [browseContentFn, mode],
  )

  const getItemFn = useCallback(
    async (id: string) => {
      if (mode === 'demo') {
        const { demoGetItem } = await import('../lib/demo')
        return demoGetItem(id)
      }
      if (!auth) throw new Error('Niet ingelogd')
      const { fetchItem } = await import('../lib/portal')
      return fetchItem(auth, id)
    },
    [auth, mode],
  )

  const getItemDataFn = useCallback(
    async (id: string) => {
      if (mode === 'demo') {
        const { demoGetData } = await import('../lib/demo')
        return demoGetData(id)
      }
      if (!auth) throw new Error('Niet ingelogd')
      const { fetchItemData } = await import('../lib/portal')
      return fetchItemData(auth, id)
    },
    [auth, mode],
  )

  const getWebMapFn = useCallback(
    async (id: string) => {
      if (mode === 'demo') {
        const { demoGetItem, demoGetData } = await import('../lib/demo')
        return {
          item: demoGetItem(id),
          data: demoGetData(id) as WebMapData,
        }
      }
      if (!auth) throw new Error('Niet ingelogd')
      const { fetchWebMap } = await import('../lib/portal')
      return fetchWebMap(auth, id)
    },
    [auth, mode],
  )

  const saveWebMapFn = useCallback(
    async (id: string, data: WebMapData) => {
      if (mode === 'demo') {
        const { demoSaveWebMap } = await import('../lib/demo')
        demoSaveWebMap(id, data)
        return
      }
      if (!auth) throw new Error('Niet ingelogd')
      const { saveWebMapData } = await import('../lib/portal')
      await saveWebMapData(auth, id, data)
    },
    [auth, mode],
  )

  const resetDemo = useCallback(() => {
    void import('../lib/demo').then(({ resetDemoData }) => resetDemoData())
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      mode,
      auth,
      portal,
      portalUrl: mode === 'live' ? portalUrl : normalizePortalUrl('https://www.arcgis.com'),
      loading,
      error,
      loginPrefs,
      saveLoginPrefs,
      signIn,
      signInOAuth,
      signInToken,
      enterDemo,
      signOut,
      browseContent: browseContentFn,
      listGroups: listGroupsFn,
      browseGroupItems: browseGroupItemsFn,
      searchItems: searchItemsFn,
      getItem: getItemFn,
      getItemData: getItemDataFn,
      getWebMap: getWebMapFn,
      saveWebMap: saveWebMapFn,
      resetDemo,
    }),
    [
      mode,
      auth,
      portal,
      portalUrl,
      loading,
      error,
      loginPrefs,
      saveLoginPrefs,
      signIn,
      signInOAuth,
      signInToken,
      enterDemo,
      signOut,
      browseContentFn,
      listGroupsFn,
      browseGroupItemsFn,
      searchItemsFn,
      getItemFn,
      getItemDataFn,
      getWebMapFn,
      saveWebMapFn,
      resetDemo,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth moet binnen AuthProvider gebruikt worden')
  return ctx
}
