/** Map ArcGIS / network errors to actionable Dutch messages. */
export function formatAuthError(err: unknown): string {
  const raw =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: string }).message)
      : err instanceof Error
        ? err.message
        : String(err)

  const details =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { error?: { messageCode?: string; details?: string[]; message?: string } } })
          .response?.error
      : undefined

  const code = details?.messageCode
  const detailText = details?.details?.join(' ') ?? ''
  const combined = `${raw} ${detailText} ${code ?? ''}`.toLowerCase()

  if (code === 'COM_0019' || combined.includes('not logged in')) {
    return (
      'Inloggen mislukt (COM_0019: Not logged in). ' +
      'Dit portaal gebruikt waarschijnlijk SAML/SSO — gebruik dan OAuth met een App Client ID, ' +
      'of een ingebouwd ArcGIS-account (geen bedrijfs-SSO-wachtwoord). Geen API key nodig.'
    )
  }

  if (combined.includes('invalid username or password') || combined.includes('unable to generate token')) {
    return (
      'Gebruikersnaam of wachtwoord ongeldig voor token-login. ' +
      'Bij SAML/SSO werkt dit formulier niet met je bedrijfsaccount — gebruik OAuth.'
    )
  }

  if (combined.includes('failed to fetch') || combined.includes('networkerror') || combined.includes('cors')) {
    return (
      'Geen verbinding met het portaal (netwerk/CORS). ' +
      'Controleer de portal-URL en of je vanaf dit domein mag verbinden.'
    )
  }

  if (combined.includes('access denied') || combined.includes('user denied')) {
    return 'OAuth geannuleerd of geweigerd in het portaal.'
  }

  if (combined.includes('redirect') && combined.includes('uri')) {
    return (
      'Redirect URI niet toegestaan. Voeg in de portal-app exact deze redirect toe: ' +
      `${typeof window !== 'undefined' ? window.location.origin + '/' : 'http://127.0.0.1:5173/'}`
    )
  }

  return raw || 'Inloggen mislukt'
}
