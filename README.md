# Open Esri Assistant

Enterprise-portal-achtige interface voor ArcGIS Online / Enterprise: Content, Groups, Organization en Map Viewer — dezelfde navigatie en styling als een echt portaal.

Edit/compare-workflows (lagen kopiëren tussen webmaps) volgen later; de focus ligt nu op de portal-UI.

## Snel starten (lokaal)

```bash
git clone https://github.com/jobvdnoort/open_esri_assistanrt.git
cd open_esri_assistanrt
git checkout cursor/esri-portal-ux-6960
npm install
npm run dev
```

Open **http://localhost:5174/**. Kies **Probeer demomodus** of log in via OAuth.

### Inloggen op ArcGIS Enterprise (geen API key)

Username/password werkt alleen voor **ingebouwde** ArcGIS-accounts. Portals met **SAML/SSO** geven anders `COM_0019`.

Gebruik **OAuth**:

1. Portaal: **Content → Add item → Application**
2. Redirect URI: `http://127.0.0.1:5174/` (en eventueel `http://localhost:5174/`)
3. Plak de **Client ID** in het OAuth-tabblad
4. **Inloggen met portal (OAuth)** — full-page redirect, geen popup

## Navigatie

| Tab | Inhoud |
| --- | --- |
| Home | Eenvoudige landingspagina (later aanpasbaar; login is vóór sessie) |
| Map | Map Viewer-shell (webmap via ArcGIS JS API) |
| Groups | My groups / Featured / Organization groups |
| Content | My content (folders), Favorites, My groups, My organization |
| Organization | Overview, Members (basis), Status |

## Scripts

| Command | Beschrijving |
| --- | --- |
| `npm run dev` | Development server (poort **5174**) |
| `npm run build` | Productie-build |
| `npm test` | Unit tests |
| `npm run lint` | Lint |

## Tech

- React + Vite + TypeScript
- [`@esri/arcgis-rest-request`](https://developers.arcgis.com/arcgis-rest-js/) + `@esri/arcgis-rest-portal`
- `esri-loader` voor Map Viewer
