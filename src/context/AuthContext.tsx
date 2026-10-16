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
import {
  DEMO_PORTAL,
  demoGetData,
  demoGetItem,
  demoSaveWebMap,
  demoSearch,
  resetDemoData,
} from '../lib/demo'
import {
  fetchItem,
  fetchItemData,
  fetchWebMap,
  getPortalSelf,
  normalizePortalUrl,
  saveWebMapData,
  searchPortalItems,
  signInWithPassword,
} from '../lib/portal'
import type { PortalItem, PortalSelf, WebMapData } from '../types/arcgis'

const SESSION_KEY = 'oea-session'

type SessionMode = 'live' | 'demo'

interface StoredSession {
  mode: SessionMode
  serializedAuth?: string
}

interface AuthContextValue {
  mode: SessionMode | null
  auth: ArcGISIdentityManager | null
  portal: PortalSelf | null
  portalUrl: string
  loading: boolean
  error: string | null
  signIn: (portalUrl: string, username: string, password: string) => Promise<void>
  enterDemo: () => void
  signOut: () => void
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SessionMode | null>(null)
  const [auth, setAuth] = useState<ArcGISIdentityManager | null>(null)
  const [portal, setPortal] = useState<PortalSelf | null>(null)
  const [portalUrl, setPortalUrl] = useState('https://www.arcgis.com/sharing/rest')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const stored = loadStored()
    if (!stored) {
      setLoading(false)
      return
    }
    if (stored.mode === 'demo') {
      setMode('demo')
      setPortal(DEMO_PORTAL)
      setPortalUrl('demo://local')
      setLoading(false)
      return
    }
    if (stored.mode === 'live' && stored.serializedAuth) {
      try {
        const manager = ArcGISIdentityManager.deserialize(stored.serializedAuth)
        setAuth(manager)
        setMode('live')
        setPortalUrl(manager.portal)
        getPortalSelf(manager)
          .then((self) => setPortal(self))
          .catch(() => {
            persist(null)
            setAuth(null)
            setMode(null)
            setPortal(null)
          })
          .finally(() => setLoading(false))
      } catch {
        persist(null)
        setLoading(false)
      }
      return
    }
    setLoading(false)
  }, [])

  const signIn = useCallback(async (portalInput: string, username: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const manager = await signInWithPassword(portalInput, username, password)
      const self = await getPortalSelf(manager)
      setAuth(manager)
      setPortal(self)
      setMode('live')
      setPortalUrl(manager.portal)
      persist({
        mode: 'live',
        serializedAuth: manager.serialize(),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Inloggen mislukt'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const enterDemo = useCallback(() => {
    resetDemoData()
    setAuth(null)
    setPortal(DEMO_PORTAL)
    setMode('demo')
    setPortalUrl('demo://local')
    setError(null)
    persist({ mode: 'demo' })
  }, [])

  const signOut = useCallback(() => {
    setAuth(null)
    setPortal(null)
    setMode(null)
    setError(null)
    persist(null)
  }, [])

  const searchItemsFn = useCallback(
    async (query: string, type?: string) => {
      if (mode === 'demo') {
        const result = demoSearch(query, type)
        return { results: result.results, total: result.total }
      }
      if (!auth) throw new Error('Niet ingelogd')
      const result = await searchPortalItems(auth, query, { type })
      return { results: result.results as PortalItem[], total: result.total }
    },
    [auth, mode],
  )

  const getItemFn = useCallback(
    async (id: string) => {
      if (mode === 'demo') return demoGetItem(id)
      if (!auth) throw new Error('Niet ingelogd')
      return fetchItem(auth, id)
    },
    [auth, mode],
  )

  const getItemDataFn = useCallback(
    async (id: string) => {
      if (mode === 'demo') return demoGetData(id)
      if (!auth) throw new Error('Niet ingelogd')
      return fetchItemData(auth, id)
    },
    [auth, mode],
  )

  const getWebMapFn = useCallback(
    async (id: string) => {
      if (mode === 'demo') {
        return {
          item: demoGetItem(id),
          data: demoGetData(id) as WebMapData,
        }
      }
      if (!auth) throw new Error('Niet ingelogd')
      return fetchWebMap(auth, id)
    },
    [auth, mode],
  )

  const saveWebMapFn = useCallback(
    async (id: string, data: WebMapData) => {
      if (mode === 'demo') {
        demoSaveWebMap(id, data)
        return
      }
      if (!auth) throw new Error('Niet ingelogd')
      await saveWebMapData(auth, id, data)
    },
    [auth, mode],
  )

  const resetDemo = useCallback(() => {
    resetDemoData()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      mode,
      auth,
      portal,
      portalUrl: mode === 'live' ? portalUrl : normalizePortalUrl('https://www.arcgis.com'),
      loading,
      error,
      signIn,
      enterDemo,
      signOut,
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
      signIn,
      enterDemo,
      signOut,
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
