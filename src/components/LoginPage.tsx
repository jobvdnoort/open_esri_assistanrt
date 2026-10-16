import { Compass, MapPinned } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { signIn, enterDemo, loading, error } = useAuth()
  const [portalUrl, setPortalUrl] = useState('https://www.arcgis.com')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    try {
      await signIn(portalUrl, username, password)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Inloggen mislukt')
    }
  }

  return (
    <div className="login">
      <div className="login__backdrop" aria-hidden="true" />
      <div className="login__panel">
        <div className="login__brand">
          <MapPinned className="login__mark" size={36} strokeWidth={1.6} />
          <div>
            <p className="login__eyebrow">Open Esri Assistant</p>
            <h1>Je portaal, zonder JSON-gedoe</h1>
          </div>
        </div>
        <p className="login__lead">
          Blader door items, bekijk webmap-JSON, en kopieer groepen en lagen tussen twee webmaps naast
          elkaar.
        </p>

        <form className="login__form" onSubmit={onSubmit}>
          <label>
            Portal URL
            <input
              value={portalUrl}
              onChange={(e) => setPortalUrl(e.target.value)}
              placeholder="https://www.arcgis.com of je Enterprise portal"
              autoComplete="url"
              required
            />
          </label>
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
