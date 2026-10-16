import { Compass, KeyRound, MapPinned, Shield } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { getOAuthRedirectUri } from '../lib/portal'

type Tab = 'oauth' | 'password' | 'token'

export function LoginPage() {
  const {
    signIn,
    signInOAuth,
    signInToken,
    enterDemo,
    loading,
    error,
    loginPrefs,
    saveLoginPrefs,
  } = useAuth()
  const [tab, setTab] = useState<Tab>('oauth')
  const [portalUrl, setPortalUrl] = useState(loginPrefs.portalUrl)
  const [clientId, setClientId] = useState(loginPrefs.clientId)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const redirectUri = getOAuthRedirectUri()

  const onPortalBlur = () => saveLoginPrefs({ portalUrl })

  const onOAuth = async (e: FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    try {
      await signInOAuth(portalUrl, clientId)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'OAuth mislukt')
    }
  }

  const onPassword = async (e: FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    try {
      await signIn(portalUrl, username, password)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Inloggen mislukt')
    }
  }

  const onToken = async (e: FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    try {
      await signInToken(portalUrl, token, username || undefined)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Token-login mislukt')
    }
  }

  return (
    <div className="login">
      <div className="login__backdrop" aria-hidden="true" />
      <div className="login__panel login__panel--wide">
        <div className="login__brand">
          <MapPinned className="login__mark" size={36} strokeWidth={1.6} />
          <div>
            <p className="login__eyebrow">Open Esri Assistant</p>
            <h1>Je portaal, zonder JSON-gedoe</h1>
          </div>
        </div>
        <p className="login__lead">
          Geen API key nodig. Voor Enterprise-portals met SAML/SSO (zoals Boskalis) gebruik je OAuth
          met een App Client ID.
        </p>

        <div className="login__callout">
          <Shield size={16} />
          <div>
            <strong>COM_0019 / username-password werkt niet?</strong>
            <p>
              Dat is normaal bij SAML. Registreer in het portaal een Application-item, zet redirect
              URI op <code>{redirectUri}</code>, plak de Client ID hieronder en log in via OAuth.
            </p>
          </div>
        </div>

        <div className="tabs login__tabs">
          <button
            type="button"
            className={`tabs__btn ${tab === 'oauth' ? 'is-active' : ''}`}
            onClick={() => setTab('oauth')}
          >
            OAuth (aanbevolen)
          </button>
          <button
            type="button"
            className={`tabs__btn ${tab === 'password' ? 'is-active' : ''}`}
            onClick={() => setTab('password')}
          >
            Gebruiker / wachtwoord
          </button>
          <button
            type="button"
            className={`tabs__btn ${tab === 'token' ? 'is-active' : ''}`}
            onClick={() => setTab('token')}
          >
            Token
          </button>
        </div>

        <label className="login__portal">
          Portal URL
          <input
            value={portalUrl}
            onChange={(e) => setPortalUrl(e.target.value)}
            onBlur={onPortalBlur}
            placeholder="https://jouw-org.com/portal"
            autoComplete="url"
            required
          />
        </label>

        {tab === 'oauth' && (
          <form className="login__form" onSubmit={onOAuth}>
            <label>
              App Client ID
              <input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                onBlur={() => saveLoginPrefs({ clientId })}
                placeholder="bijv. abcdefghijklmnopqrstuvwxyz"
                required
              />
            </label>
            <p className="muted login__hint">
              Content → Add item → Application → Redirect URI exact:{' '}
              <code>{redirectUri}</code>
              {redirectUri.includes('127.0.0.1')
                ? ' (voeg ook http://localhost:5173/ toe als je die URL gebruikt)'
                : ' (voeg ook http://127.0.0.1:5173/ toe als je die URL gebruikt)'}
              . Na login kom je terug in dit tabblad — geen popup.
            </p>
            {(localError || error) && <p className="form-error">{localError || error}</p>}
            <button type="submit" className="btn btn--primary" disabled={loading}>
              <KeyRound size={16} />
              {loading ? 'Doorsturen…' : 'Inloggen met portal (OAuth)'}
            </button>
          </form>
        )}

        {tab === 'password' && (
          <form className="login__form" onSubmit={onPassword}>
            <p className="muted login__hint">
              Alleen voor <strong>ingebouwde</strong> ArcGIS-accounts. Bedrijfs-SSO-wachtwoorden werken
              hier niet.
            </p>
            <label>
              Gebruikersnaam
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              Wachtwoord
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {(localError || error) && <p className="form-error">{localError || error}</p>}
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Bezig…' : 'Inloggen'}
            </button>
          </form>
        )}

        {tab === 'token' && (
          <form className="login__form" onSubmit={onToken}>
            <p className="muted login__hint">
              Plak een geldige portal-token (bijv. via generateToken). Optioneel: username voor weergave.
            </p>
            <label>
              Gebruikersnaam (optioneel)
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </label>
            <label>
              Token
              <textarea
                value={token}
                onChange={(e) => setToken(e.target.value)}
                rows={3}
                required
                spellCheck={false}
              />
            </label>
            {(localError || error) && <p className="form-error">{localError || error}</p>}
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Bezig…' : 'Inloggen met token'}
            </button>
          </form>
        )}

        <div className="login__divider">
          <span>of</span>
        </div>

        <button type="button" className="btn btn--secondary" onClick={enterDemo}>
          <Compass size={16} />
          Probeer demomodus
        </button>
        <p className="muted login__hint">
          Demomodus gebruikt lokale voorbeeld-webmaps — ideaal om groepen te kopiëren zonder portal.
        </p>
      </div>
    </div>
  )
}
