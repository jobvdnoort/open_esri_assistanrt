# Open Esri Assistant

Portaal-browser voor ArcGIS Online / Enterprise, geïnspireerd op ArcGIS Assistant — met een extra workflow om **groepen en lagen tussen webmaps te kopiëren zonder JSON te bewerken**.

## Wat kun je ermee?

- Inloggen op ArcGIS Online of een Enterprise-portal
- Content zoeken en items openen
- Item-metadata en item-data JSON bekijken
- Webmap-lagen als boom bekijken
- **Twee webmaps naast elkaar openen** en groepen/lagen over en weer kopiëren
- Wijzigingen terugschrijven naar het portaal (of lokaal in demomodus)

## Snel starten

```bash
npm install
npm run dev
```

Open de getoonde URL. Kies **Probeer demomodus** om zonder portal te testen, of log in op je portal.

### Inloggen op ArcGIS Enterprise (geen API key)

Username/password werkt alleen voor **ingebouwde** ArcGIS-accounts. Portals met **SAML/SSO** (zoals veel Enterprise-omgevingen) geven anders `COM_0019: Not logged in`.

Gebruik dan **OAuth**:

1. In het portaal: **Content → Add item → Application**
2. Type: Web mapping / Application
3. Redirect URI: `http://127.0.0.1:5173/` (en eventueel `http://localhost:5173/`)
4. Kopieer de **Client ID** naar het OAuth-tabblad in de app
5. Klik **Inloggen met portal (OAuth)** — je gaat in hetzelfde tabblad naar de portal-login (incl. SAML) en komt daarna terug

Alternatief: tab **Token** met een handmatig gegenereerde portal-token.

## Workflow: groep verplaatsen / kopiëren

1. Ga naar **Inhoud**, selecteer één of twee Web Maps, klik **Vergelijk webmaps**
2. Of open **Vergelijk** in de navigatie en kies links/rechts een webmap
3. Selecteer een groep of laag
4. Klik **→** / **←** (of de knoppen *Links → rechts* / *Rechts → links*)
5. Optioneel: selecteer op de doelkaart een **groep** om erín te plakken; anders landt de kopie op root-niveau
6. Klik **Opslaan** op de gewijzigde kant

Layer-`id`s worden automatisch vernieuwd om conflicten te voorkomen.

## Scripts

| Command | Beschrijving |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Productie-build |
| `npm test` | Unit tests (webmap helpers) |
| `npm run lint` | Lint |

## Tech

- React + Vite + TypeScript
- [`@esri/arcgis-rest-request`](https://developers.arcgis.com/arcgis-rest-js/) + `@esri/arcgis-rest-portal`
- Token-login via `ArcGISIdentityManager.signIn`
